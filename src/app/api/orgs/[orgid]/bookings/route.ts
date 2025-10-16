import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPropertyMemberEmails, sendNewBookingEmail } from '@/lib/email';
export const runtime = 'nodejs';

function uuidOf(s?: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0].toLowerCase() : null;
}
function isDate(s?: unknown) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function statusOf(s?: unknown) {
  const v = typeof s === 'string' ? s.toLowerCase() : '';
  return ['upcoming','completed','cancelled'].includes(v) ? v : 'upcoming';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('bookings')
    .select('*, properties(name)')
    .eq('org_id', orgId)
    .order('check_in', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, bookings: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const property_id = uuidOf(body.property_id as string);
  const check_in    = body.check_in;
  const check_out   = body.check_out;
  const status      = statusOf(body.status);

  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!isDate(check_in) || !isDate(check_out)) {
    return NextResponse.json({ error: 'check_in and check_out must be YYYY-MM-DD' }, { status: 400 });
  }

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('bookings')
    .insert([{ org_id: orgId, property_id, check_in, check_out, status }])
    .select('*, properties(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Send email notifications to members assigned to this property
  try {
    const members = await getPropertyMemberEmails(property_id);
    if (members.length > 0) {
      const propertyName = (data.properties as any)?.name || 'Unknown Property';
      const checkIn = new Date(data.check_in as string);
      const checkOut = new Date(data.check_out as string);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      await sendNewBookingEmail({
        recipientEmails: members.map(m => m.email),
        recipientName: members[0].name, // First member's name for personalization
        propertyName,
        guestName: (data.guest_name as string) || 'Guest',
        checkIn: checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        checkOut: checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        nights,
        orgId,
      });
    }
  } catch (emailError) {
    console.error('Failed to send booking notification email:', emailError);
  }

  return NextResponse.json({ ok: true, booking: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const booking_id = uuidOf(body.booking_id as string);
  const status = body.status as string;

  if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
  if (!status || !['upcoming', 'completed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const admin = createClient(url, key);

  // Get the booking details first
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('*, properties(org_id)')
    .eq('id', booking_id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Get the previous status
  const oldStatus = booking.status;

  // Update the booking status
  const { error: updateError } = await admin
    .from('bookings')
    .update({ status })
    .eq('id', booking_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // If status changed to "completed", update KPIs
  if (status === 'completed' && oldStatus !== 'completed') {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Get the month from check-in date (YYYY-MM-01)
    const month = booking.check_in.slice(0, 7) + '-01';

    // Get the user who owns this property
    const { data: userProperty } = await admin
      .from('user_properties')
      .select('user_id')
      .eq('property_id', booking.property_id)
      .maybeSingle();

    const userId = userProperty?.user_id;

    if (userId) {
      // Check if KPI record exists for this user and month
      const { data: existingKpi } = await admin
        .from('kpis')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle();

      // Calculate days in month for occupancy rate
      const [year, monthNum] = month.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      if (existingKpi) {
        // Update existing KPI - add nights and recalculate occupancy
        const newNightsBooked = (existingKpi.nights_booked || 0) + nights;
        const newOccupancyRate = newNightsBooked / daysInMonth;
        const newVacancyRate = 1 - newOccupancyRate;

        await admin
          .from('kpis')
          .update({
            nights_booked: newNightsBooked,
            occupancy_rate: newOccupancyRate,
            vacancy_rate: newVacancyRate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingKpi.id);
      } else {
        // Create new KPI record for this user
        const occupancyRate = nights / daysInMonth;
        const vacancyRate = 1 - occupancyRate;

        await admin
          .from('kpis')
          .insert({
            org_id: orgId,
            user_id: userId,
            month: month,
            nights_booked: nights,
            gross_revenue_cents: 0,
            expenses_cents: 0,
            net_revenue_cents: 0,
            properties: 0,
            occupancy_rate: occupancyRate,
            vacancy_rate: vacancyRate
          });
      }
    }
  }

  // If status changed from "completed" to something else, subtract the nights
  if (oldStatus === 'completed' && status !== 'completed') {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const month = booking.check_in.slice(0, 7) + '-01';

    // Get the user who owns this property
    const { data: userProperty } = await admin
      .from('user_properties')
      .select('user_id')
      .eq('property_id', booking.property_id)
      .maybeSingle();

    const userId = userProperty?.user_id;

    if (userId) {
      const { data: existingKpi } = await admin
        .from('kpis')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle();

      if (existingKpi) {
        // Calculate days in month for occupancy rate
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        const newNightsBooked = Math.max(0, (existingKpi.nights_booked || 0) - nights);
        const newOccupancyRate = newNightsBooked / daysInMonth;
        const newVacancyRate = 1 - newOccupancyRate;

        await admin
          .from('kpis')
          .update({
            nights_booked: newNightsBooked,
            occupancy_rate: newOccupancyRate,
            vacancy_rate: newVacancyRate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingKpi.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const { orgid } = await params;
  const orgId = uuidOf(orgid);
  if (!orgId) return NextResponse.json({ error: 'Bad org id' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const booking_id = uuidOf(body.booking_id as string);

  if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

  const admin = createClient(url, key);

  // Get the booking details before deletion (to update KPIs if needed)
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('*, properties(org_id)')
    .eq('id', booking_id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // If the booking was completed, we need to subtract from KPIs
  if (booking.status === 'completed') {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const month = booking.check_in.slice(0, 7) + '-01';

    // Get the user who owns this property
    const { data: userProperty } = await admin
      .from('user_properties')
      .select('user_id')
      .eq('property_id', booking.property_id)
      .maybeSingle();

    const userId = userProperty?.user_id;

    if (userId) {
      const { data: existingKpi } = await admin
        .from('kpis')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle();

      if (existingKpi) {
        // Calculate days in month for occupancy rate
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        const newNightsBooked = Math.max(0, (existingKpi.nights_booked || 0) - nights);
        const newOccupancyRate = newNightsBooked / daysInMonth;
        const newVacancyRate = 1 - newOccupancyRate;

        // Subtract the nights from KPI and recalculate occupancy
        await admin
          .from('kpis')
          .update({
            nights_booked: newNightsBooked,
            occupancy_rate: newOccupancyRate,
            vacancy_rate: newVacancyRate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingKpi.id);
      }
    }
  }

  // Delete the booking
  const { error: deleteError } = await admin
    .from('bookings')
    .delete()
    .eq('id', booking_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Booking deleted successfully' });
}
