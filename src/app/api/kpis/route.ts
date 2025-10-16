// src/app/api/kpis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function extractUUID(s: string | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = extractUUID(url.searchParams.get('org'));
  const month = (url.searchParams.get('month') ?? new Date().toISOString().slice(0,7)) + '-01';
  if (!orgId) return NextResponse.json({ error: 'Missing or bad ?org=UUID' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Get the authenticated user from the Authorization header
  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user } } = await admin.auth.getUser(token);
      userId = user?.id || null;
    } catch (err) {
      console.error('Error getting user from token:', err);
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized - user not found' }, { status: 401 });
  }

  // Fetch user-specific KPIs for this org and month
  const { data, error } = await admin
    .from('kpis')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('month', month);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Dynamically calculate nights_booked, occupancy_rate, and vacancy_rate from bookings
  if (data && data.length > 0) {
    const kpi = data[0];
    const monthStr = month.slice(0, 7); // YYYY-MM

    // Get user's properties
    const { data: userProps } = await admin
      .from('user_properties')
      .select('property_id')
      .eq('user_id', userId);

    const propertyIds = userProps?.map(up => up.property_id) || [];

    if (propertyIds.length > 0) {
      // Calculate start and end dates for the month
      const [year, monthNum] = monthStr.split('-').map(Number);
      const startDate = `${monthStr}-01`;
      const endDate = new Date(year, monthNum, 1).toISOString().slice(0, 10); // First day of next month

      // Get completed bookings for user's properties in this month
      const { data: bookings } = await admin
        .from('bookings')
        .select('check_in, check_out')
        .in('property_id', propertyIds)
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .gte('check_in', startDate)
        .lt('check_in', endDate);

      // Calculate nights booked
      let nightsBooked = 0;
      (bookings || []).forEach((booking: any) => {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        nightsBooked += nights;
      });

      // Calculate days in month
      const monthDate = new Date(month);
      const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const daysInMonth = lastDayOfMonth.getDate();

      // Calculate occupancy and vacancy rates per property
      const occupancyRate = nightsBooked / (daysInMonth * propertyIds.length);
      const vacancyRate = 1 - occupancyRate;

      // Update KPI with calculated values
      kpi.nights_booked = nightsBooked;
      kpi.occupancy_rate = occupancyRate;
      kpi.vacancy_rate = vacancyRate;
    }
  }

  return NextResponse.json({ ok: true, kpis: data || [] });
}
