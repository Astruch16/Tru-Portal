import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type PaymentMethod = 'bank' | 'card' | 'cash' | 'other';

function extractUuid(s: string): string | null {
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // --- validate invoice id ---
  const { id: rawId } = await params;
  const raw = rawId ?? '';
  const id = extractUuid(raw);
  if (!id) return NextResponse.json({ error: `Bad invoice id: "${raw}"` }, { status: 400 });

  // --- env check ---
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  // --- parse body (no 'any') ---
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    bodyUnknown = {};
  }
  const b = (typeof bodyUnknown === 'object' && bodyUnknown !== null)
    ? (bodyUnknown as Record<string, unknown>)
    : {};

  // amount_cents
  const amtRaw = b['amount_cents'];
  const amount_cents =
    typeof amtRaw === 'number' ? Math.trunc(amtRaw) :
    typeof amtRaw === 'string' ? Number(amtRaw) :
    NaN;
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 });
  }

  // method
  const methodRaw = typeof b['method'] === 'string' ? b['method'].toLowerCase() : 'bank';
  const allowed: PaymentMethod[] = ['bank', 'card', 'cash', 'other'];
  const method: PaymentMethod = (allowed as readonly string[]).includes(methodRaw) ? (methodRaw as PaymentMethod) : 'bank';

  // payment_date: optional, defaults to NOW() in DB
  const payment_date =
    (typeof b['payment_date'] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b['payment_date']))
      ? (b['payment_date'] as string)
      : undefined;

  const payload: Record<string, unknown> = {
    invoice_id: id,
    amount_cents,
    payment_method: method,
  };
  if (payment_date) payload.payment_date = payment_date;

  // --- insert payment ---
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: payment, error: insErr } = await admin
    .from('invoice_payments')
    .insert([payload])
    .select('*')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  // --- update invoice status to 'paid' ---
  const { error: updateErr } = await admin
    .from('invoices')
    .update({ status: 'paid' })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // --- return updated invoice summary ---
  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select('id, invoice_number, amount_due_cents, status, bill_month')
    .eq('id', id)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, payment, invoice: inv });
}
