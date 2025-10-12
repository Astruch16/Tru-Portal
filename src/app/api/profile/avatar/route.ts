import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('=== Avatar Upload API Called ===');
    const formData = await req.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      console.log('No file provided in formData');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('File received:', { name: file.name, type: file.type, size: file.size });

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      console.log('File too large:', file.size);
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Get authenticated user
    console.log('Getting authenticated user...');
    const sb = await supabaseServer();
    const { data: { user }, error: userError } = await sb.auth.getUser();

    if (userError || !user) {
      console.log('Authentication failed:', userError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('User authenticated:', user.id);
    const userId = user.id;
    const admin = supabaseAdmin();

    // Delete old avatar if exists
    console.log('Checking for existing avatar...');
    const { data: profile } = await admin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profile?.avatar_url) {
      console.log('Found existing avatar:', profile.avatar_url);
      // Extract path from URL and delete
      const oldPath = profile.avatar_url.split('/').pop();
      if (oldPath) {
        console.log('Deleting old avatar:', `${userId}/${oldPath}`);
        await admin.storage.from('avatars').remove([`${userId}/${oldPath}`]);
      }
    }

    // Upload new avatar
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('Uploading file to:', filePath);

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('Buffer created, size:', buffer.length);

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.log('Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    console.log('File uploaded successfully');

    // Get public URL
    const { data: { publicUrl } } = admin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    console.log('Public URL:', publicUrl);

    // Update profile
    console.log('Updating profile with new avatar URL...');
    const { error: updateError } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.log('Profile update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('Avatar upload complete!');
    return NextResponse.json({ avatar_url: publicUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
