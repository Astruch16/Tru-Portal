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

  // Load invoice
  const { data: inv, error } = await admin.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
  if (!inv) return new Response(`Invoice not found for id=${id}`, { status: 404 });
  const row = inv as InvoiceRow;

  // (Optional) fetch client's org name for "Bill To"
  let orgName = 'Member';
  const org = await admin.from('organizations').select('name').eq('id', row.org_id).maybeSingle();
  if (org.data?.name) orgName = org.data.name;

  // Build branded PDF
  const pdfArrayBuffer = await buildBrandedInvoicePDF(row, {
    companyName: 'TruHost',                  // ⬅️ your brand
    logoPath: 'public/logo.png',             // ⬅️ put logo in /public/logo.png (optional)
    primary: '#cbfabfff',                      // ⬅️ brand color
    accent: '#dae0c0ff',
    contactLines: ['hello@truhost.com', '(555) 555-5555', '123 Main St, City'],
    billToName: orgName,
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


