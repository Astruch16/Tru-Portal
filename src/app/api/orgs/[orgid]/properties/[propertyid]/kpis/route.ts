import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function extractUUID(s: string | undefined | null) {
  if (!s) return null;
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0].toLowerCase() : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgid: string; propertyid: string }> }
) {
  const resolvedParams = await params;
  const orgId = extractUUID(resolvedParams.orgid);
  const propertyId = extractUUID(resolvedParams.propertyid);

  if (!orgId || !propertyId) {
    return NextResponse.json({ error: 'Invalid org or property ID' }, { status: 400 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const month = monthParam + '-01';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Verify property belongs to org
    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('id, name, org_id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Get bookings for this property and month
    const startDate = new Date(month);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const { data: bookings, error: bookingsError } = await admin
      .from('bookings')
      .select('gross_revenue_cents, expenses_cents, nights, check_in, check_out')
      .eq('property_id', propertyId)
      .gte('check_in', startDate.toISOString().split('T')[0])
      .lte('check_in', endDate.toISOString().split('T')[0]);

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 400 });
    }

    // Calculate KPIs from bookings
    let grossRevenueCents = 0;
    let expensesCents = 0;
    let nightsBooked = 0;

    (bookings || []).forEach((booking) => {
      grossRevenueCents += booking.gross_revenue_cents || 0;
      expensesCents += booking.expenses_cents || 0;
      nightsBooked += booking.nights || 0;
    });

    const netRevenueCents = grossRevenueCents - expensesCents;

    // Calculate occupancy rate (assuming 30 days per month for simplicity)
    const daysInMonth = endDate.getDate();
    const occupancyRate = nightsBooked / daysInMonth;
    const vacancyRate = 1 - occupancyRate;

    const kpi = {
      property_id: propertyId,
      property_name: property.name,
      org_id: orgId,
      month: monthParam,
      gross_revenue_cents: grossRevenueCents,
      expenses_cents: expensesCents,
      net_revenue_cents: netRevenueCents,
      nights_booked: nightsBooked,
      properties: 1,
      occupancy_rate: occupancyRate,
      vacancy_rate: vacancyRate,
    };

    return NextResponse.json({ ok: true, kpi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
