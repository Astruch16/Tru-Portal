import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgid: string; propertyid: string }> }
) {
  const resolvedParams = await params;
  const orgId = extractUUID(resolvedParams.orgid);
  const propertyId = extractUUID(resolvedParams.propertyid);

  if (!orgId || !propertyId) {
    return NextResponse.json({ error: 'Invalid org or property ID' }, { status: 400 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const month = monthParam + '-01';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Verify property belongs to org
    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('id, name, org_id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Get the organization's plan to calculate TruHost fees
    const { data: plan } = await admin
      .from('plans')
      .select('percent')
      .eq('org_id', orgId)
      .lte('effective_date', month)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const feePercent = plan?.percent ?? 12; // Default to 12% if no plan

    // Get ledger entries for this property and month
    const { data: ledgerEntries, error: ledgerError } = await admin
      .from('ledger_entries')
      .select('amount_cents')
      .eq('property_id', propertyId)
      .gte('entry_date', monthParam + '-01')
      .lt('entry_date', new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1).toISOString().split('T')[0]);

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 400 });
    }

    // Calculate revenue and expenses from ledger entries
    let grossRevenueCents = 0;
    let expensesCents = 0;

    (ledgerEntries || []).forEach((entry) => {
      if (entry.amount_cents > 0) {
        grossRevenueCents += entry.amount_cents;
      } else {
        expensesCents += Math.abs(entry.amount_cents);
      }
    });

    // Get bookings for nights calculation
    const { data: bookings } = await admin
      .from('bookings')
      .select('check_in, check_out')
      .eq('property_id', propertyId)
      .eq('status', 'completed')
      .gte('check_in', monthParam + '-01')
      .lt('check_in', new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1).toISOString().split('T')[0]);

    let nightsBooked = 0;
    (bookings || []).forEach((booking) => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      nightsBooked += nights;
    });

    // Calculate TruHost fees
    const truHostFees = Math.floor((grossRevenueCents * feePercent) / 100);

    // Calculate net revenue: Gross - Expenses - TruHost Fees
    const netRevenueCents = grossRevenueCents - expensesCents - truHostFees;

    // Calculate occupancy rate (days in month)
    const startDate = new Date(month);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const daysInMonth = endDate.getDate();
    const occupancyRate = nightsBooked / daysInMonth;
    const vacancyRate = 1 - occupancyRate;

    const kpi = {
      property_id: propertyId,
      property_name: property.name,
      org_id: orgId,
      month: monthParam,
      gross_revenue_cents: grossRevenueCents,
      expenses_cents: expensesCents,
      net_revenue_cents: netRevenueCents,
      nights_booked: nightsBooked,
      properties: 1,
      occupancy_rate: occupancyRate,
      vacancy_rate: vacancyRate,
      fee_percent: feePercent,
    };

    return NextResponse.json({ ok: true, kpi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
