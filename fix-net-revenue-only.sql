-- ============================================================================
-- Fix Net Revenue Calculation for Existing KPIs
-- ============================================================================
-- This only updates the net_revenue_cents field using the correct formula
-- It doesn't rebuild KPIs, just fixes the calculation
-- ============================================================================

-- Update net_revenue for all KPIs with user-specific plan percentages
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

-- For KPIs where user doesn't have a plan, use default 12%
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

-- Display the corrected values
SELECT
  k.month,
  u.email as user_email,
  pl.tier as plan_tier,
  pl.percent as plan_percent,
  k.gross_revenue_cents / 100.0 as gross_revenue,
  k.expenses_cents / 100.0 as expenses,
  FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100) / 100.0 as truhost_fees,
  k.net_revenue_cents / 100.0 as net_revenue,
  -- Show the calculation breakdown
  (k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100)) / 100.0 as calculated_net
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id
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
ORDER BY k.month DESC;
