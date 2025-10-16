import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function extractUUID(val: string): string {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(val);
  return match ? match[1] : val;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgid: string }> }
) {
  try {
    const resolvedParams = await params;
    const orgId = extractUUID(resolvedParams.orgid);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const propertyId = extractUUID(formData.get('propertyId') as string);
    const receiptDate = formData.get('receiptDate') as string | null;
    const amountCents = formData.get('amountCents') as string | null;
    const description = formData.get('description') as string | null;
    const note = formData.get('note') as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'Property ID is required' }, { status: 400 });
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid file type. Only images (JPEG, PNG, WebP) and PDFs are allowed.'
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        ok: false,
        error: 'File size exceeds 10MB limit'
      }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify property belongs to org
    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('id, org_id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({
        ok: false,
        error: 'Property not found or does not belong to this organization'
      }, { status: 404 });
    }

    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExt = file.name.split('.').pop();
    const fileName = `${orgId}/${propertyId}/${timestamp}-${randomString}.${fileExt}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await admin
      .storage
      .from('receipts')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
      console.error('Attempted fileName:', fileName);
      return NextResponse.json({
        ok: false,
        error: `Failed to upload file to storage: ${uploadError.message || JSON.stringify(uploadError)}`
      }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin
      .storage
      .from('receipts')
      .getPublicUrl(fileName);

    // Insert receipt record into database
    const { data: receipt, error: dbError } = await admin
      .from('receipts')
      .insert({
        org_id: orgId,
        property_id: propertyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
        receipt_date: receiptDate || null,
        amount_cents: amountCents ? parseInt(amountCents, 10) : null,
        description: description || null,
        note: note || null,
        date_added: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded file
      await admin.storage.from('receipts').remove([fileName]);
      return NextResponse.json({
        ok: false,
        error: 'Failed to save receipt record'
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      receipt
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
