-- ============================================================================
-- Fix Occupancy Rates by Recalculating from Bookings
-- ============================================================================
-- This script recalculates nights_booked, occupancy_rate, and vacancy_rate
-- for all KPI records based on actual completed bookings.

-- Step 1: Calculate actual nights booked per user per month from bookings
WITH booking_nights AS (
  SELECT
    b.org_id,
    up.user_id,
    DATE_TRUNC('month', b.check_in::date)::date as month,
    SUM((b.check_out::date - b.check_in::date)) as total_nights
  FROM bookings b
  LEFT JOIN user_properties up ON up.property_id = b.property_id
  WHERE b.status = 'completed'
    AND up.user_id IS NOT NULL
  GROUP BY b.org_id, up.user_id, DATE_TRUNC('month', b.check_in::date)::date
)
-- Step 2: Update KPI records with correct nights_booked and recalculated occupancy/vacancy
UPDATE kpis k
SET
  nights_booked = COALESCE(bn.total_nights, 0),
  occupancy_rate = COALESCE(bn.total_nights, 0)::numeric / EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE),
  vacancy_rate = 1 - (COALESCE(bn.total_nights, 0)::numeric / EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE)),
  updated_at = NOW()
FROM booking_nights bn
WHERE k.org_id = bn.org_id
  AND k.user_id = bn.user_id
  AND k.month = bn.month;

-- Show results
SELECT
  k.month,
  u.email as user_email,
  k.nights_booked,
  EXTRACT(DAY FROM (DATE_TRUNC('month', k.month) + INTERVAL '1 month - 1 day')::DATE) as days_in_month,
  ROUND((k.occupancy_rate * 100)::numeric, 2) as occupancy_percent,
  ROUND((k.vacancy_rate * 100)::numeric, 2) as vacancy_percent
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id
WHERE k.user_id IS NOT NULL
ORDER BY k.month DESC;
