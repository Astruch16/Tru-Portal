-- ============================================================================
-- Add Organization Plan with Fee Percentage
-- ============================================================================
-- This script adds a plan record for your organization with the TruHost fee
-- percentage that should be deducted from gross revenue.
-- ============================================================================

-- First, let's see what organizations exist
SELECT id, name FROM organizations ORDER BY created_at DESC;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Run the SELECT query above to find your organization ID
-- 2. Update the INSERT statement below with:
--    - YOUR_ORG_ID: Your organization's UUID
--    - YOUR_FEE_PERCENT: The percentage (e.g., 10, 12, 15 for 10%, 12%, 15%)
-- 3. Run the INSERT statement
-- ============================================================================

-- Example: If your fee is 12%, insert like this:
-- INSERT INTO plans (org_id, percent, effective_date, created_at)
-- VALUES (
--   'YOUR_ORG_ID_HERE',  -- Replace with actual org ID
--   12,                   -- Replace with your fee percentage
--   '2025-01-01',        -- When this plan starts (adjust as needed)
--   NOW()
-- );

-- Uncomment and modify this INSERT statement:
-- INSERT INTO plans (org_id, percent, effective_date, created_at)
-- VALUES (
--   'REPLACE_WITH_YOUR_ORG_ID',
--   12,
--   '2025-01-01',
--   NOW()
-- );

-- After inserting, verify the plan was created:
-- SELECT
--   p.id,
--   o.name as org_name,
--   p.percent,
--   p.effective_date,
--   p.created_at
-- FROM plans p
-- JOIN organizations o ON o.id = p.org_id
-- ORDER BY p.created_at DESC;
