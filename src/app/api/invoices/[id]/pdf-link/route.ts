import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // sanitize & validate id (tolerate stray quotes/brackets/spaces)
  const raw = params.id ?? '';
  const id = raw.replace(/[<>"'\s]/g, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: `Bad invoice id: "${raw}"` }, { status: 400 });
  }

  // env checks
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  // service-role client (backend-only)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // find invoice
  const { data: inv, error } = await admin
    .from('invoices')
    .select('id, org_id, invoice_number')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!inv)  return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const filePath = `${inv.org_id}/${inv.invoice_number ?? inv.id}.pdf`;

  // create 1-hour signed URL to Storage object
  const { data: signed, error: sErr } = await admin
    .storage
    .from('invoices')
    .createSignedUrl(filePath, 60 * 60);

  if (sErr) {
    // Most likely the PDF hasn't been archived yet.
    return NextResponse.json({
      ok: false,
      needsArchive: true,
      message: 'File not found in Storage. First generate & archive the PDF by hitting /api/invoices/{id}/pdf with upload enabled.',
      filePath
    }, { status: 404 });
  }

  return NextResponse.json({ ok: true, url: signed?.signedUrl, filePath });
}
