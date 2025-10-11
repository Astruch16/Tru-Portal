import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendInvoiceNotification } from '@/lib/email/resend';
import { format } from 'date-fns';

export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(req: NextRequest, { params }: { params: { orgid?: string } }) {
  const url = new URL(req.url);

  // org id from path, query (?org=), or body { org }
  const pathOrg = extractUUID(params?.orgid ?? '');
  let bodyObj: Record<string, unknown> = {};
  try { bodyObj = await req.json(); } catch { /* no body */ }
  const bodyOrg = extractUUID(typeof bodyObj.org === 'string' ? (bodyObj.org as string) : null);
  const queryOrg = extractUUID(url.searchParams.get('org'));
  const orgId = pathOrg ?? queryOrg ?? bodyOrg;

  if (!orgId) {
    return NextResponse.json(
      { error: 'No org id. Provide as path /api/orgs/{uuid}/..., or ?org=UUID, or body { "org": "UUID" }' },
      { status: 400 }
    );
  }

  // month from body, query (?month=YYYY-MM), or default to current
  const bodyMonth = typeof bodyObj.month === 'string' ? (bodyObj.month as string) : undefined;
  const queryMonth = url.searchParams.get('month') ?? undefined;
  const ym = (bodyMonth || queryMonth || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const monthDate = `${ym}-01`;

  // property_id from body or query (optional)
  const bodyPropertyId = extractUUID(typeof bodyObj.property_id === 'string' ? (bodyObj.property_id as string) : null);
  const queryPropertyId = extractUUID(url.searchParams.get('property_id'));
  const propertyId = bodyPropertyId ?? queryPropertyId ?? null;

  // Supabase admin client
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const admin = createClient(supaUrl, serviceKey);

  // Use the SAFE wrapper that always returns the invoice row
  const { data, error } = await admin.rpc('api_admin_generate_monthly_invoice_safe', {
    p_org_id: orgId,
    p_month: monthDate,
    p_property_id: propertyId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const invoice = data as Record<string, unknown> | null;
  const wasNewlyCreated = invoice && !invoice.sent_at;

  // Send email notification if this is a newly generated invoice
  if (wasNewlyCreated && invoice) {
    try {
      // Get organization details and user email
      const { data: orgData } = await admin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      const { data: membership } = await admin
        .from('org_memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .single();

      let userEmail = '';
      if (membership) {
        const { data: { user } } = await admin.auth.admin.getUserById(
          (membership as { user_id: string }).user_id
        );
        userEmail = user?.email || '';
      }

      if (userEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const invoiceId = invoice.id as string;
        const invoiceNumber = (invoice.invoice_number as string) || invoiceId;
        const amountCents = (invoice.amount_due_cents as number) || 0;
        const amountFormatted = `$${(amountCents / 100).toFixed(2)} CAD`;
        const monthFormatted = format(new Date(monthDate), 'MMMM yyyy');

        await sendInvoiceNotification({
          to: userEmail,
          orgName: (orgData as { name?: string } | null)?.name || 'Valued Client',
          invoiceNumber,
          month: monthFormatted,
          amountDue: amountFormatted,
          invoiceUrl: `${baseUrl}/api/invoices/${invoiceId}/pdf`,
          portalUrl: `${baseUrl}/portal/${orgId}?month=${ym}`,
        });

        // Update invoice to mark email as sent
        await admin
          .from('invoices')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', invoiceId);

        return NextResponse.json({
          ok: true,
          invoice: data,
          orgId,
          month: monthDate,
          emailSent: true,
        });
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the request if email fails
      return NextResponse.json({
        ok: true,
        invoice: data,
        orgId,
        month: monthDate,
        emailSent: false,
        emailError: (emailError as Error).message,
      });
    }
  }

  return NextResponse.json({ ok: true, invoice: data ?? null, orgId, month: monthDate });
}

