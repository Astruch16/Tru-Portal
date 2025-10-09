import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // env checks
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  // validate id
  const raw = params.id ?? '';
  const id = raw.replace(/[<>"'\s]/g, '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: `Bad invoice id: "${raw}"` }, { status: 400 });
  }

  // read desired status
  const { status } = await req.json().catch(() => ({}));
  if (!['due', 'paid', 'void'].includes(status)) {
    return NextResponse.json({ error: 'status must be "due" | "paid" | "void"' }, { status: 400 });
  }

  // service-role client (bypasses RLS while you build backend)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // update
  const { data, error } = await admin
    .from('invoices')
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)  return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  return NextResponse.json({ ok: true, invoice: data });
}
