-- ============================================================================
-- Debug: Check Plans Assignment
-- ============================================================================

-- Check all plans in the database
SELECT
  p.id,
  p.org_id,
  p.user_id,
  u.email as user_email,
  p.tier,
  p.percent,
  p.effective_date,
  p.created_at
FROM plans p
LEFT JOIN auth.users u ON u.id = p.user_id
ORDER BY p.created_at DESC;

-- Check if the user has properties assigned
SELECT
  up.id,
  up.user_id,
  u.email as user_email,
  up.property_id,
  prop.name as property_name
FROM user_properties up
LEFT JOIN auth.users u ON u.id = up.user_id
LEFT JOIN properties prop ON prop.id = up.property_id
ORDER BY up.created_at DESC;

-- Check KPIs and what plan they should be using
SELECT
  k.id as kpi_id,
  k.org_id,
  k.user_id,
  u.email as user_email,
  k.month,
  k.gross_revenue_cents / 100.0 as gross_revenue,
  k.net_revenue_cents / 100.0 as net_revenue,
  -- Check for matching plan
  (SELECT tier FROM plans WHERE user_id = k.user_id AND org_id = k.org_id ORDER BY effective_date DESC LIMIT 1) as plan_tier,
  (SELECT percent FROM plans WHERE user_id = k.user_id AND org_id = k.org_id ORDER BY effective_date DESC LIMIT 1) as plan_percent
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id
ORDER BY k.month DESC;
