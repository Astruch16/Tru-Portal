-- ============================================================================
-- Recalculate User-Level KPIs with Correct Plan Percentages
-- ============================================================================
-- This script recalculates all KPI records to use user-specific plan percentages
-- Run this AFTER you've assigned plans to all your users
-- ============================================================================

-- Step 1: Delete old org-level KPIs (without user_id)
-- These are from before the migration to user-level tracking
DELETE FROM kpis WHERE user_id IS NULL;

-- Step 2: Recalculate KPIs for each user/property combination
-- This creates new KPI records with correct user_id and net_revenue

INSERT INTO kpis (org_id, user_id, month, gross_revenue_cents, expenses_cents, net_revenue_cents, nights_booked, properties, occupancy_rate, vacancy_rate, created_at, updated_at)
SELECT
  le.org_id,
  up.user_id,
  DATE_TRUNC('month', le.entry_date::date)::date as month,

  -- Gross revenue (positive amounts)
  COALESCE(SUM(CASE WHEN le.amount_cents > 0 THEN le.amount_cents ELSE 0 END), 0) as gross_revenue_cents,

  -- Expenses (negative amounts, make positive)
  COALESCE(SUM(CASE WHEN le.amount_cents < 0 THEN ABS(le.amount_cents) ELSE 0 END), 0) as expenses_cents,

  -- Net revenue calculation will be done in next step (after we have gross revenue)
  0 as net_revenue_cents_temp,

  -- Nights booked (will be updated separately)
  0 as nights_booked,

  -- Property count
  COUNT(DISTINCT le.property_id) as properties,

  -- Occupancy/vacancy (calculated after nights booked)
  0 as occupancy_rate,
  0 as vacancy_rate,

  NOW() as created_at,
  NOW() as updated_at
FROM ledger_entries le
INNER JOIN user_properties up ON up.property_id = le.property_id
GROUP BY le.org_id, up.user_id, DATE_TRUNC('month', le.entry_date::date)
ON CONFLICT (org_id, user_id, month)
DO UPDATE SET
  gross_revenue_cents = EXCLUDED.gross_revenue_cents,
  expenses_cents = EXCLUDED.expenses_cents,
  properties = EXCLUDED.properties,
  updated_at = NOW();

-- Step 3: Update nights_booked from completed bookings
UPDATE kpis k
SET
  nights_booked = COALESCE((
    SELECT SUM((b.check_out::date - b.check_in::date))
    FROM bookings b
    INNER JOIN user_properties up ON up.property_id = b.property_id
    WHERE up.user_id = k.user_id
      AND b.org_id = k.org_id
      AND b.status = 'completed'
      AND DATE_TRUNC('month', b.check_in::date) = k.month
  ), 0),
  updated_at = NOW()
WHERE k.user_id IS NOT NULL;

-- Step 4: Calculate net_revenue with user-specific TruHost fees
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(p.percent, 12)) / 100),
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (org_id, user_id)
    org_id,
    user_id,
    percent,
    effective_date
  FROM plans
  WHERE user_id IS NOT NULL
  ORDER BY org_id, user_id, effective_date DESC
) p
WHERE k.org_id = p.org_id
  AND k.user_id = p.user_id
  AND k.month >= p.effective_date
  AND k.user_id IS NOT NULL;

-- Step 5: For KPIs where user doesn't have a plan, use default 12%
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * 12) / 100),
  updated_at = NOW()
WHERE k.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM plans p
    WHERE p.org_id = k.org_id
      AND p.user_id = k.user_id
      AND p.effective_date <= k.month
  );

-- Step 6: Calculate occupancy and vacancy rates (assuming 30 days per month)
UPDATE kpis
SET
  occupancy_rate = CASE
    WHEN nights_booked > 0 THEN LEAST(nights_booked::FLOAT / 30.0, 1.0)
    ELSE 0
  END,
  vacancy_rate = CASE
    WHEN nights_booked > 0 THEN GREATEST(1.0 - (nights_booked::FLOAT / 30.0), 0.0)
    ELSE 1.0
  END,
  updated_at = NOW()
WHERE user_id IS NOT NULL;

-- Step 7: Display results grouped by user
SELECT
  o.name as organization,
  p.email as user_email,
  CONCAT(pr.first_name, ' ', pr.last_name) as user_name,
  pl.tier as plan_tier,
  pl.percent as plan_percent,
  k.month,
  k.gross_revenue_cents / 100.0 as gross_revenue_dollars,
  k.expenses_cents / 100.0 as expenses_dollars,
  FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100) / 100.0 as truhost_fees_dollars,
  k.net_revenue_cents / 100.0 as net_revenue_dollars,
  k.nights_booked
FROM kpis k
JOIN organizations o ON o.id = k.org_id
LEFT JOIN auth.users p ON p.id = k.user_id
LEFT JOIN profiles pr ON pr.id = k.user_id
LEFT JOIN LATERAL (
  SELECT tier, percent
  FROM plans
  WHERE org_id = k.org_id
    AND user_id = k.user_id
    AND effective_date <= k.month
  ORDER BY effective_date DESC
  LIMIT 1
) pl ON true
WHERE k.user_id IS NOT NULL
ORDER BY o.name, user_email, k.month DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that all KPIs have user_id set
SELECT
  COUNT(*) as total_kpis,
  COUNT(user_id) as kpis_with_user,
  COUNT(*) - COUNT(user_id) as kpis_without_user
FROM kpis;

-- This should show:
-- - total_kpis: Your total KPI records
-- - kpis_with_user: Should equal total_kpis
-- - kpis_without_user: Should be 0
