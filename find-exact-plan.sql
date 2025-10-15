-- ============================================================================
-- Find if plan exists for this exact user and org
-- ============================================================================

-- Search for plans with the exact org_id and user_id from the KPI
SELECT
  p.id,
  p.org_id,
  p.user_id,
  u.email,
  p.tier,
  p.percent,
  p.effective_date,
  p.created_at,
  -- Check if it matches what we're looking for
  CASE
    WHEN p.org_id = '9f2d435f-e0be-4995-addc-3524527e637b' AND p.user_id = '033275e9-de8c-4b42-9525-00900384420a' THEN 'EXACT MATCH ✓'
    WHEN p.org_id = '9f2d435f-e0be-4995-addc-3524527e637b' THEN 'ORG MATCHES, USER DIFFERENT'
    WHEN p.user_id = '033275e9-de8c-4b42-9525-00900384420a' THEN 'USER MATCHES, ORG DIFFERENT'
    ELSE 'NO MATCH'
  END as match_status
FROM plans p
LEFT JOIN auth.users u ON u.id = p.user_id
ORDER BY p.created_at DESC;

-- Show ALL plans regardless of filters
SELECT
  'All Plans' as note,
  COUNT(*) as total_plans
FROM plans;

-- Show if ANY plan exists for this user
SELECT
  'Plans for user 033275e9-de8c-4b42-9525-00900384420a' as note,
  COUNT(*) as count
FROM plans
WHERE user_id = '033275e9-de8c-4b42-9525-00900384420a';

-- Show if ANY plan exists for this org
SELECT
  'Plans for org 9f2d435f-e0be-4995-addc-3524527e637b' as note,
  COUNT(*) as count
FROM plans
WHERE org_id = '9f2d435f-e0be-4995-addc-3524527e637b';
