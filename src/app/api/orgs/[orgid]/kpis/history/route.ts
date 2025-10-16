// src/app/api/orgs/[orgid]/kpis/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgid?: string }> }) {
  const url = new URL(req.url);
  const resolvedParams = await params;
  const orgId = extractUUID(resolvedParams?.orgid ?? '');

  if (!orgId) {
    return NextResponse.json({ error: 'Missing or invalid org id' }, { status: 400 });
  }

  // Get number of months to fetch (default 12)
  const months = parseInt(url.searchParams.get('months') || '12', 10);
  const validMonths = Math.min(Math.max(months, 1), 36); // Limit between 1-36 months

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(supaUrl, serviceKey);

  // Get authenticated user
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data } = await admin.auth.getUser(token);
    userId = data.user?.id || null;
  }

  // If no bearer token, try to get user from cookies (SSR context)
  if (!userId) {
    try {
      const { supabaseServer } = await import('@/lib/supabase/server');
      const sb = await supabaseServer();
      const { data: { user } } = await sb.auth.getUser();
      userId = user?.id || null;
    } catch (e) {
      // Ignore cookie errors, userId will remain null
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Call the RPC function to get historical KPIs
  const { data, error } = await admin.rpc('api_get_org_kpis_history', {
    p_org_id: orgId,
    p_months: validMonths,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Get user's properties
  const { data: userProps } = await admin
    .from('user_properties')
    .select('property_id')
    .eq('user_id', userId);

  const propertyIds = userProps?.map(up => up.property_id) || [];

  if (propertyIds.length === 0) {
    return NextResponse.json({ ok: true, kpis: data || [], orgId });
  }

  // Filter KPIs to only include user's data and recalculate booking-related metrics
  const userKpis = (data || []).filter((kpi: any) => kpi.user_id === userId);

  // Dynamically calculate nights_booked, occupancy_rate, and vacancy_rate for each month
  for (const kpi of userKpis) {
    const monthStr = kpi.month.slice(0, 7); // YYYY-MM

    // Calculate start and end dates for the month
    const [year, monthNum] = monthStr.split('-').map(Number);
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, monthNum, 1).toISOString().slice(0, 10);

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
    const monthDate = new Date(kpi.month);
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

  return NextResponse.json({ ok: true, kpis: userKpis, orgId });
}
