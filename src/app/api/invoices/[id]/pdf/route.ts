// src/app/api/invoices/[id]/pdf/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildBrandedInvoicePDF, type InvoiceRow } from '@/lib/pdf/invoice';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const raw = rawId ?? '';
  const id = raw.replace(/[<>"'\s]/g, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(`Bad invoice id: "${raw}"`, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Supabase env missing', { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Load invoice with plan details and organization info
  const { data: inv, error } = await admin
    .from('invoices')
    .select('*, org:organizations(name)')
    .eq('id', id)
    .maybeSingle();

  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
  if (!inv) return new Response(`Invoice not found for id=${id}`, { status: 404 });

  // Get the owner/member name for "Bill To"
  const { data: membership } = await admin
    .from('org_memberships')
    .select('user_id')
    .eq('org_id', inv.org_id)
    .eq('role', 'owner')
    .maybeSingle();

  let memberName = (inv as any).org?.name || 'Member';
  if (membership) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', (membership as { user_id: string }).user_id)
      .maybeSingle();

    if (profile?.full_name) {
      memberName = profile.full_name;
    }
  }

  // Get the active plan for this invoice's month
  const invoiceMonth = new Date(inv.bill_month);
  const { data: plan } = await admin
    .from('plans')
    .select('*')
    .eq('org_id', inv.org_id)
    .lte('effective_date', inv.bill_month)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get KPIs to calculate gross revenue and expenses
  const { data: kpis } = await admin
    .from('kpis')
    .select('*')
    .eq('org_id', inv.org_id)
    .eq('month', inv.bill_month);

  // Calculate totals from KPIs
  const grossRevenue = kpis?.reduce((sum, k) => sum + (k.gross_revenue_cents || 0), 0) || 0;
  const expenses = kpis?.reduce((sum, k) => sum + (k.expenses_cents || 0), 0) || 0;

  // Calculate PM fee
  const pmFee = plan ? Math.floor(grossRevenue * (plan.percent / 100)) : 0;

  // Build the invoice row with all required data
  // Use plan name (Launch, Elevate, Maximize) or fallback to Standard
  const planName = plan?.tier
    ? plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1).toLowerCase()
    : 'Standard';

  const row: InvoiceRow = {
    id: inv.id,
    org_id: inv.org_id,
    bill_month: inv.bill_month,
    plan_code: planName,
    plan_percent: plan?.percent || 0,
    gross_revenue_cents: grossRevenue,
    expenses_cents: expenses,
    pm_fee_cents: pmFee,
    amount_due_cents: inv.amount_due_cents,
    status: inv.status,
    invoice_number: inv.invoice_number,
  };

  // Build branded PDF with sage green theme
  const pdfArrayBuffer = await buildBrandedInvoicePDF(row, {
    companyName: 'TruHost',
    logoPath: 'truhost-logo.png',            // Logo in public folder
    primary: '#9db896',                       // Sage green
    accent: '#E1ECDB',                        // Light sage
    contactLines: ['info@truhost.ca', '604-991-6393', 'Chilliwack, BC'],
    billToName: memberName,
  });

  // (Optional) archive to Storage
  try {
    const filePath = `${row.org_id}/${row.invoice_number ?? row.id}.pdf`;
    await admin.storage.from('invoices').upload(filePath, pdfArrayBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  } catch {}

  return new Response(pdfArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${row.invoice_number ?? row.id}.pdf"`,
    },
  });
}


