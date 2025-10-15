-- ============================================================================
-- Test Occupancy and Vacancy Rate Calculations
-- ============================================================================

-- Show current KPIs with occupancy/vacancy breakdown
SELECT
  k.month,
  u.email as user_email,
  k.nights_booked,
  -- Calculate days in the month
  EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE) as days_in_month,
  -- Current stored rates
  ROUND((k.occupancy_rate * 100)::numeric, 2) as occupancy_percent,
  ROUND((k.vacancy_rate * 100)::numeric, 2) as vacancy_percent,
  -- Manually calculated to verify
  ROUND((k.nights_booked::numeric / EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE) * 100), 2) as calculated_occupancy_percent,
  ROUND(((1 - (k.nights_booked::numeric / EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE))) * 100), 2) as calculated_vacancy_percent
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id
WHERE k.user_id IS NOT NULL
ORDER BY k.month DESC;

-- Show all completed bookings and their nights
SELECT
  b.property_id,
  p.name as property_name,
  DATE_TRUNC('month', b.check_in::date)::date as month,
  b.check_in,
  b.check_out,
  (b.check_out::date - b.check_in::date) as nights,
  b.status
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
WHERE b.status = 'completed'
ORDER BY b.check_in DESC;

-- Show expected vs actual nights booked per month
WITH monthly_bookings AS (
  SELECT
    DATE_TRUNC('month', b.check_in::date)::date as month,
    up.user_id,
    u.email as user_email,
    COUNT(*) as total_bookings,
    SUM((b.check_out::date - b.check_in::date)) as total_nights
  FROM bookings b
  LEFT JOIN user_properties up ON up.property_id = b.property_id
  LEFT JOIN auth.users u ON u.id = up.user_id
  WHERE b.status = 'completed'
  GROUP BY DATE_TRUNC('month', b.check_in::date)::date, up.user_id, u.email
)
SELECT
  mb.month,
  mb.user_id,
  mb.user_email,
  mb.total_bookings,
  mb.total_nights,
  k.nights_booked as kpi_nights_booked,
  CASE
    WHEN mb.total_nights = k.nights_booked THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as status
FROM monthly_bookings mb
LEFT JOIN kpis k ON k.user_id = mb.user_id AND k.month = mb.month
ORDER BY mb.month DESC;
