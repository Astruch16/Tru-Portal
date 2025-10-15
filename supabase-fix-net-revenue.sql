-- ============================================================================
-- Fix Net Revenue Calculation for All Existing KPIs
-- ============================================================================
-- This script recalculates net_revenue_cents for all existing KPI records
-- Formula: Net Revenue = Gross Revenue - Expenses - TruHost Fees
-- TruHost Fees = Gross Revenue × Plan Percentage
-- ============================================================================

-- Update all KPI records with correct net revenue calculation
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(p.percent, 0)) / 100),
  updated_at = NOW()
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

-- For KPIs without a plan, set net revenue = gross revenue - expenses (no TruHost fees)
UPDATE kpis k
SET
  net_revenue_cents = k.gross_revenue_cents - k.expenses_cents,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM plans p
  WHERE p.org_id = k.org_id
    AND p.effective_date <= k.month
);

-- Display results
SELECT
  k.month,
  k.gross_revenue_cents / 100.0 as gross_revenue_dollars,
  k.expenses_cents / 100.0 as expenses_dollars,
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
