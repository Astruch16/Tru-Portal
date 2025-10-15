-- ============================================================================
-- Recalculate All KPIs from Scratch Based on Current Data
-- ============================================================================
-- This script recalculates KPIs by:
-- 1. Summing all revenue/expense entries from ledger_entries
-- 2. Counting nights from completed bookings
-- 3. Calculating net revenue with TruHost fees
-- ============================================================================

-- Step 1: Update KPIs based on ledger entries and bookings
UPDATE kpis k
SET
  -- Calculate gross revenue from ledger entries (positive amounts)
  gross_revenue_cents = COALESCE((
    SELECT SUM(amount_cents)
    FROM ledger_entries
    WHERE org_id = k.org_id
      AND amount_cents > 0
      AND DATE_TRUNC('month', entry_date::date) = k.month
  ), 0),

  -- Calculate expenses from ledger entries (negative amounts, make positive)
  expenses_cents = COALESCE((
    SELECT ABS(SUM(amount_cents))
    FROM ledger_entries
    WHERE org_id = k.org_id
      AND amount_cents < 0
      AND DATE_TRUNC('month', entry_date::date) = k.month
  ), 0),

  -- Calculate nights booked from completed bookings
  nights_booked = COALESCE((
    SELECT SUM((check_out::date - check_in::date))
    FROM bookings
    WHERE org_id = k.org_id
      AND status = 'completed'
      AND DATE_TRUNC('month', check_in::date) = k.month
  ), 0),

  updated_at = NOW();

-- Step 2: Recalculate net_revenue with TruHost fees
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(p.percent, 0)) / 100)
FROM (
  SELECT DISTINCT ON (org_id)
    org_id,
    percent,
    effective_date
  FROM plans
  ORDER BY org_id, effective_date DESC
) p
WHERE k.org_id = p.org_id
  AND k.month >= p.effective_date;

-- For KPIs without a plan, set net revenue = gross revenue - expenses
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents
WHERE NOT EXISTS (
  SELECT 1
  FROM plans p
  WHERE p.org_id = k.org_id
    AND p.effective_date <= k.month
);

-- Step 3: Delete KPI records that have no data
DELETE FROM kpis
WHERE gross_revenue_cents = 0
  AND expenses_cents = 0
  AND nights_booked = 0;

-- Step 4: Display results
SELECT
  k.month,
  k.gross_revenue_cents / 100.0 as gross_revenue_dollars,
  k.expenses_cents / 100.0 as expenses_dollars,
  k.nights_booked,
  COALESCE(p.percent, 0) as plan_percent,
  FLOOR((k.gross_revenue_cents * COALESCE(p.percent, 0)) / 100) / 100.0 as truhost_fees_dollars,
  k.net_revenue_cents / 100.0 as net_revenue_dollars
FROM kpis k
LEFT JOIN LATERAL (
  SELECT percent
  FROM plans
  WHERE org_id = k.org_id
    AND effective_date <= k.month
  ORDER BY effective_date DESC
  LIMIT 1
) p ON true
ORDER BY k.month DESC;
