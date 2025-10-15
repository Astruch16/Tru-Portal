-- ============================================================================
-- Debug Plan Assignment Mismatch
-- ============================================================================

-- Show the KPI with its org_id and user_id
SELECT
  'KPI Record' as record_type,
  k.id,
  k.org_id,
  k.user_id,
  u.email as user_email,
  k.month
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id;

-- Show all plans with their org_id and user_id
SELECT
  'PLAN Record' as record_type,
  p.id,
  p.org_id,
  p.user_id,
  u.email as user_email,
  p.tier,
  p.percent,
  p.effective_date
FROM plans p
LEFT JOIN auth.users u ON u.id = p.user_id;

-- Check if org_id and user_id match between KPI and PLAN
SELECT
  k.id as kpi_id,
  k.org_id as kpi_org_id,
  k.user_id as kpi_user_id,
  p.id as plan_id,
  p.org_id as plan_org_id,
  p.user_id as plan_user_id,
  CASE
    WHEN k.org_id = p.org_id AND k.user_id = p.user_id THEN 'MATCH ✓'
    WHEN k.org_id != p.org_id THEN 'ORG_ID MISMATCH'
    WHEN k.user_id != p.user_id THEN 'USER_ID MISMATCH'
    ELSE 'NO PLAN FOUND'
  END as status
FROM kpis k
LEFT JOIN plans p ON p.user_id = k.user_id AND p.org_id = k.org_id;

-- Show what the JOIN condition is looking for
SELECT
  k.org_id as looking_for_org_id,
  k.user_id as looking_for_user_id,
  k.month as looking_for_month_lte,
  u.email as user_email
FROM kpis k
LEFT JOIN auth.users u ON u.id = k.user_id;
