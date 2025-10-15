-- ============================================================================
-- Check Current KPIs Status
-- ============================================================================

-- View all KPIs with user and plan information
SELECT
  k.id,
  k.org_id,
  k.user_id,
  p.email as user_email,
  pr.first_name || ' ' || pr.last_name as user_name,
  k.month,
  k.gross_revenue_cents / 100.0 as gross_revenue,
  k.expenses_cents / 100.0 as expenses,
  k.net_revenue_cents / 100.0 as net_revenue,
  k.nights_booked,
  -- Check if user has a plan
  (SELECT COUNT(*) FROM plans WHERE user_id = k.user_id AND org_id = k.org_id) as has_plan,
  -- Get user's current plan
  (SELECT tier FROM plans WHERE user_id = k.user_id AND org_id = k.org_id ORDER BY effective_date DESC LIMIT 1) as plan_tier,
  (SELECT percent FROM plans WHERE user_id = k.user_id AND org_id = k.org_id ORDER BY effective_date DESC LIMIT 1) as plan_percent
FROM kpis k
LEFT JOIN auth.users p ON p.id = k.user_id
LEFT JOIN profiles pr ON pr.id = k.user_id
ORDER BY k.month DESC;

-- Show all users and their plan assignments
SELECT
  p.id as user_id,
  p.email,
  pr.first_name || ' ' || pr.last_name as name,
  pl.tier,
  pl.percent,
  pl.effective_date,
  -- Check if they have properties assigned
  (SELECT COUNT(*) FROM user_properties WHERE user_id = p.id) as properties_assigned
FROM auth.users p
LEFT JOIN profiles pr ON pr.id = p.id
LEFT JOIN plans pl ON pl.user_id = p.id
ORDER BY p.email;
