import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function extractUuid(s: string): string | null {
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = extractUuid(rawId);

  if (!id) {
    return NextResponse.json({ error: 'Invalid payment id' }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the invoice_id before deleting
  const { data: payment } = await admin
    .from('invoice_payments')
    .select('invoice_id')
    .eq('id', id)
    .single();

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  // Delete the payment
  const { error: deleteError } = await admin
    .from('invoice_payments')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Check if there are any remaining payments for this invoice
  const { data: remainingPayments } = await admin
    .from('invoice_payments')
    .select('id')
    .eq('invoice_id', payment.invoice_id);

  // If no payments remain, set invoice status back to 'due'
  if (!remainingPayments || remainingPayments.length === 0) {
    await admin
      .from('invoices')
      .update({ status: 'due' })
      .eq('id', payment.invoice_id);
  }

  return NextResponse.json({ ok: true, message: 'Payment deleted successfully' });
}
