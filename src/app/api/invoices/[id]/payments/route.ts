import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type PaymentMethod = 'bank' | 'card' | 'cash' | 'other';

function extractUuid(s: string): string | null {
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // --- validate invoice id ---
  const raw = params.id ?? '';
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

  // note
  const note = typeof b['note'] === 'string' ? b['note'] : null;

  // Fix A: only include received_on if valid YYYY-MM-DD; otherwise omit to use DB default
  const received_on =
    (typeof b['received_on'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b['received_on']))
      ? (b['received_on'] as string)
      : undefined;

  const payload: Record<string, unknown> = {
    invoice_id: id,
    amount_cents,
    method,
    note,
  };
  if (received_on) payload.received_on = received_on;

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

  // --- return updated invoice summary ---
  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select('id, amount_due_cents, paid_total_cents, paid_at, status')
    .eq('id', id)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, payment, invoice: inv });
}
