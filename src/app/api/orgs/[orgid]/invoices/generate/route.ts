import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOrgMemberEmails, getPropertyMemberEmails, sendNewInvoiceEmail } from '@/lib/email';
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

  // Get user_id if property_id is provided
  let userId: string | null = null;
  if (propertyId) {
    const { data: userProperty } = await admin
      .from('user_properties')
      .select('user_id')
      .eq('property_id', propertyId)
      .maybeSingle();

    userId = userProperty?.user_id || null;
  }

  // Use the SAFE wrapper that always returns the invoice row
  const { data, error } = await admin.rpc('api_admin_generate_monthly_invoice_safe', {
    p_org_id: orgId,
    p_month: monthDate,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let invoice = data as Record<string, unknown> | null;
  const wasNewlyCreated = invoice && !invoice.sent_at;

  // If this is a new invoice and we have a user_id, update the invoice to set the user_id
  if (wasNewlyCreated && invoice && userId) {
    const { data: updatedInvoice } = await admin
      .from('invoices')
      .update({ user_id: userId })
      .eq('id', invoice.id as string)
      .select()
      .single();

    if (updatedInvoice) {
      invoice = updatedInvoice as Record<string, unknown>;
    }
  }

  // Send email notification if this is a newly generated invoice
  if (wasNewlyCreated && invoice) {
    try {
      // Get members based on whether this is property-specific or org-wide
      const members = propertyId
        ? await getPropertyMemberEmails(propertyId)
        : await getOrgMemberEmails(orgId);

      if (members.length > 0) {
        // Get organization name
        const { data: orgData } = await admin
          .from('orgs')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();

        const invoiceId = invoice.id as string;
        const invoiceNumber = (invoice.invoice_number as string) || invoiceId;
        const amountCents = (invoice.amount_due_cents as number) || 0;
        const amountFormatted = `$${(amountCents / 100).toFixed(2)}`;
        const monthFormatted = format(new Date(monthDate), 'MMMM yyyy');
        const status = (invoice.status as string) || 'due';

        // Send to property-specific members or all org members
        await sendNewInvoiceEmail({
          recipientEmails: members.map(m => m.email),
          recipientName: members[0].name,
          organizationName: orgData?.name || 'Your Organization',
          invoiceNumber,
          billMonth: monthFormatted,
          amountDue: amountFormatted,
          status: status.charAt(0).toUpperCase() + status.slice(1),
          orgId,
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

