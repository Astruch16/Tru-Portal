import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const raw = params.id ?? '';
  const id = raw.replace(/[<>"'\s]/g, ''); // tolerate extra chars

  const env = {
    url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!env.url || !env.serviceKey) {
    return NextResponse.json({ ok: false, reason: 'Missing env', env }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from('invoices')
    .select('id, invoice_number, org_id, bill_month, amount_due_cents, status')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({ ok: !!data, id, env, data, error });
}
