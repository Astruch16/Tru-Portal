-- ============================================================================
-- Show Exact Calculation Breakdown
-- ============================================================================

SELECT
  k.id as kpi_id,
  u.email as user_email,
  pl.tier as plan_tier,
  pl.percent as plan_percent,
  k.month,

  -- Current values in database
  k.gross_revenue_cents / 100.0 as gross_revenue,
  k.expenses_cents / 100.0 as expenses,
  k.net_revenue_cents / 100.0 as net_revenue_in_db,

  -- What it SHOULD be calculated as
  FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100) / 100.0 as truhost_fees_should_be,
  (k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100)) / 100.0 as net_revenue_should_be,

  -- The difference
  ((k.gross_revenue_cents - k.expenses_cents - FLOOR((k.gross_revenue_cents * COALESCE(pl.percent, 12)) / 100)) / 100.0) - (k.net_revenue_cents / 100.0) as difference

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
