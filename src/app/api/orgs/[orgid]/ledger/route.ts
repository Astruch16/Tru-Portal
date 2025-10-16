import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPropertyMemberEmails, sendNewLedgerEntryEmail } from '@/lib/email';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}
function isDate(s?: unknown) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function kindOf(s?: unknown) {
  const v = typeof s === 'string' ? s.toLowerCase() : '';
  // If your column is enum entry_kind, Supabase accepts string values matching enum labels
  return v === 'expense' ? 'expense' : 'revenue';
}

export async function GET(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const orgId = uuidOf(params?.orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);

  // Get authenticated user to filter by their properties
  const { supabaseServer } = await import('@/lib/supabase/server');
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const userId = user?.id;

  // Check if request has admin flag (only admins can see all entries)
  const searchParams = req.nextUrl.searchParams;
  const isAdmin = searchParams.get('admin') === 'true';

  // Fetch ledger entries with property info
  let query = admin
    .from('ledger_entries')
    .select(`
      *,
      properties (
        id,
        name
      )
    `)
    .eq('org_id', orgId);

  // If not admin and user is logged in, only show entries for their properties
  if (!isAdmin && userId) {
    // Get user's property IDs
    const { data: userProps } = await admin
      .from('user_properties')
      .select('property_id')
      .eq('user_id', userId);

    const propertyIds = userProps?.map(up => up.property_id) || [];

    // Filter by user's properties
    if (propertyIds.length > 0) {
      query = query.in('property_id', propertyIds);
    } else {
      // User has no properties, return empty
      return NextResponse.json({ ok: true, entries: [] });
    }
  }

  const { data, error } = await query.order('entry_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, entries: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const orgId = uuidOf(params?.orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const property_id   = uuidOf(body.property_id as string);
  const kind          = kindOf(body.kind);
  let amount_cents    = typeof body.amount_cents === 'string' ? Number(body.amount_cents) : Number(body.amount_cents);
  const entry_date    = body.entry_date;
  const description   = typeof body.description === 'string' ? body.description : null;
  const category      = typeof body.category === 'string' ? body.category : null;

  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 });
  }
  if (!isDate(entry_date)) {
    return NextResponse.json({ error: 'entry_date must be YYYY-MM-DD' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  // Make expenses negative
  if (kind === 'expense') {
    amount_cents = -Math.abs(amount_cents);
  }

  const admin = createClient(url, key);

  // Insert the ledger entry
  const { data, error } = await admin
    .from('ledger_entries')
    .insert([{ org_id: orgId, property_id, amount_cents, entry_date, description, category }])
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update KPIs for the month of this entry
  const month = entry_date.slice(0, 7) + '-01'; // Convert YYYY-MM-DD to YYYY-MM-01

  // Get the user who owns this property
  const { data: userProperty } = await admin
    .from('user_properties')
    .select('user_id')
    .eq('property_id', property_id)
    .maybeSingle();

  const userId = userProperty?.user_id;

  if (!userId) {
    return NextResponse.json({ error: 'Property must be assigned to a user' }, { status: 400 });
  }

  // Get or create KPI record for this user and month
  const { data: existingKpi } = await admin
    .from('kpis')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  // Get the user's current plan to calculate TruHost fees
  const { data: plan } = await admin
    .from('plans')
    .select('percent')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .lte('effective_date', month)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planPercent = plan?.percent ?? 12; // Default to 12% if no plan

  if (existingKpi) {
    // Update existing KPI
    let newGrossRevenue = existingKpi.gross_revenue_cents;
    let newExpenses = existingKpi.expenses_cents;

    if (kind === 'revenue') {
      newGrossRevenue += amount_cents;
    } else {
      newExpenses += Math.abs(amount_cents);
    }

    // Calculate net revenue: Gross Revenue - Expenses - TruHost Fees
    const truHostFees = Math.floor((newGrossRevenue * planPercent) / 100);
    const newNetRevenue = newGrossRevenue - newExpenses - truHostFees;

    await admin
      .from('kpis')
      .update({
        gross_revenue_cents: newGrossRevenue,
        expenses_cents: newExpenses,
        net_revenue_cents: newNetRevenue,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingKpi.id);
  } else {
    // Create new KPI record
    let grossRevenue = 0;
    let expenses = 0;

    if (kind === 'revenue') {
      grossRevenue = amount_cents;
    } else {
      expenses = Math.abs(amount_cents);
    }

    // Calculate net revenue: Gross Revenue - Expenses - TruHost Fees
    const truHostFees = Math.floor((grossRevenue * planPercent) / 100);
    const netRevenue = grossRevenue - expenses - truHostFees;

    await admin
      .from('kpis')
      .insert([{
        org_id: orgId,
        user_id: userId,
        month,
        gross_revenue_cents: grossRevenue,
        expenses_cents: expenses,
        net_revenue_cents: netRevenue,
        nights_booked: 0,
        properties: 0,
        occupancy_rate: 0,
        vacancy_rate: 0
      }]);
  }

  // Send email notifications to members assigned to this property
  try {
    const members = await getPropertyMemberEmails(property_id);
    if (members.length > 0) {
      // Get property name
      const { data: propertyData } = await admin.from('properties').select('name').eq('id', property_id).single();
      const propertyName = propertyData?.name || 'Unknown Property';

      const isRevenue = amount_cents > 0;

      await sendNewLedgerEntryEmail({
        recipientEmails: members.map(m => m.email),
        recipientName: members[0].name,
        type: isRevenue ? 'revenue' : 'expense',
        propertyName,
        amount: `$${Math.abs(amount_cents / 100).toFixed(2)}`,
        date: new Date(entry_date as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        description: description || undefined,
        orgId,
      });
    }
  } catch (emailError) {
    console.error('Failed to send ledger entry notification:', emailError);
  }

  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const orgId = uuidOf(params?.orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const entry_id = uuidOf(body.entry_id as string);

  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });

  const admin = createClient(url, key);

  // Get the entry details before deletion
  const { data: entry, error: fetchError } = await admin
    .from('ledger_entries')
    .select('*')
    .eq('id', entry_id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // Delete the entry
  const { error: deleteError } = await admin
    .from('ledger_entries')
    .delete()
    .eq('id', entry_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Update KPIs by subtracting this entry's amount
  const month = entry.entry_date.slice(0, 7) + '-01';

  // Get the user who owns this property
  const { data: userProperty } = await admin
    .from('user_properties')
    .select('user_id')
    .eq('property_id', entry.property_id)
    .maybeSingle();

  const userId = userProperty?.user_id;

  if (!userId) {
    // If no user assigned, just return success (can't update KPIs)
    return NextResponse.json({ ok: true, message: 'Entry deleted successfully (no user assigned)' });
  }

  const { data: existingKpi } = await admin
    .from('kpis')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (existingKpi) {
    // Get the user's plan
    const { data: plan } = await admin
      .from('plans')
      .select('percent')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .lte('effective_date', month)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const planPercent = plan?.percent ?? 12;

    // Subtract the entry amount from KPIs
    let newGrossRevenue = existingKpi.gross_revenue_cents;
    let newExpenses = existingKpi.expenses_cents;

    if (entry.amount_cents > 0) {
      // It was revenue
      newGrossRevenue -= entry.amount_cents;
    } else {
      // It was expense
      newExpenses -= Math.abs(entry.amount_cents);
    }

    // Recalculate net revenue
    const truHostFees = Math.floor((newGrossRevenue * planPercent) / 100);
    const newNetRevenue = newGrossRevenue - newExpenses - truHostFees;

    await admin
      .from('kpis')
      .update({
        gross_revenue_cents: Math.max(0, newGrossRevenue),
        expenses_cents: Math.max(0, newExpenses),
        net_revenue_cents: newNetRevenue,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingKpi.id);
  }

  return NextResponse.json({ ok: true, message: 'Entry deleted successfully' });
}
