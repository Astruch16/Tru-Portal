import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function extractUUID(val: string): string {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(val);
  return match ? match[1] : val;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgid: string }> }
) {
  try {
    const resolvedParams = await params;
    const orgId = extractUUID(resolvedParams.orgid);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const month = searchParams.get('month'); // Format: YYYY-MM

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Build query
    let query = admin
      .from('receipts')
      .select('*')
      .eq('org_id', orgId)
      .order('date_added', { ascending: false });

    // Filter by property if specified
    if (propertyId) {
      query = query.eq('property_id', extractUUID(propertyId));
    }

    // Filter by month if specified (using receipt_date, not date_added)
    if (month) {
      // month is in format YYYY-MM, we need to match against receipt_date (DATE type)
      // Convert the DATE column to text to do pattern matching
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

      query = query.gte('receipt_date', startDate).lte('receipt_date', endDate);
    }

    const { data: receipts, error } = await query;

    if (error) {
      console.error('Fetch receipts error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({
        ok: false,
        error: `Failed to fetch receipts: ${error.message || JSON.stringify(error)}`
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      receipts: receipts || []
    });

  } catch (error) {
    console.error('Fetch receipts error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgid: string }> }
) {
  try {
    const resolvedParams = await params;
    const orgId = extractUUID(resolvedParams.orgid);

    const { searchParams } = new URL(req.url);
    const receiptId = searchParams.get('receiptId');

    if (!receiptId) {
      return NextResponse.json({
        ok: false,
        error: 'Receipt ID is required'
      }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get receipt to verify it belongs to org and get file path
    const { data: receipt, error: fetchError } = await admin
      .from('receipts')
      .select('*')
      .eq('id', extractUUID(receiptId))
      .eq('org_id', orgId)
      .single();

    if (fetchError || !receipt) {
      return NextResponse.json({
        ok: false,
        error: 'Receipt not found'
      }, { status: 404 });
    }

    // Extract file path from URL
    const urlParts = receipt.file_url.split('/receipts/');
    const filePath = urlParts.length > 1 ? urlParts[1] : null;

    // Delete from storage
    if (filePath) {
      const { error: storageError } = await admin
        .storage
        .from('receipts')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }
    }

    // Delete from database
    const { error: deleteError } = await admin
      .from('receipts')
      .delete()
      .eq('id', receipt.id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json({
        ok: false,
        error: 'Failed to delete receipt'
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Delete receipt error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
