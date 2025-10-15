-- ============================================================================
-- Create Plan for Specific User
-- ============================================================================
-- This creates a plan for the exact user who owns properties and has KPIs
-- ============================================================================

-- First, show what we're about to create
SELECT
  '9f2d435f-e0be-4995-addc-3524527e637b' as org_id,
  '033275e9-de8c-4b42-9525-00900384420a' as user_id,
  u.email as user_email,
  'Will create plan for this user' as action
FROM auth.users u
WHERE u.id = '033275e9-de8c-4b42-9525-00900384420a';

-- Delete any existing plan for this exact user+org combination
-- (to avoid duplicates)
DELETE FROM plans
WHERE org_id = '9f2d435f-e0be-4995-addc-3524527e637b'
  AND user_id = '033275e9-de8c-4b42-9525-00900384420a';

-- Create the plan with your desired tier
-- CHANGE THE VALUES BELOW:
-- tier: 'launch' (12%), 'elevate' (18%), or 'maximize' (22%)
-- percent: 12, 18, or 22

INSERT INTO plans (org_id, user_id, tier, percent, effective_date, created_at)
VALUES (
  '9f2d435f-e0be-4995-addc-3524527e637b',  -- org_id
  '033275e9-de8c-4b42-9525-00900384420a',  -- user_id
  'elevate',                                 -- CHANGE THIS: 'launch', 'elevate', or 'maximize'
  18,                                        -- CHANGE THIS: 12, 18, or 22
  '2025-01-01',                             -- effective_date
  NOW()
)
RETURNING id, org_id, user_id, tier, percent;

-- Verify it was created
SELECT
  p.id,
  p.org_id,
  p.user_id,
  u.email as user_email,
  p.tier,
  p.percent,
  p.effective_date,
  'Plan created successfully!' as status
FROM plans p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.org_id = '9f2d435f-e0be-4995-addc-3524527e637b'
  AND p.user_id = '033275e9-de8c-4b42-9525-00900384420a';
