-- ============================================================================
-- ADD USER-SPECIFIC PLANS MIGRATION
-- ============================================================================
-- This migration adds user_id to the plans table to support per-user plans
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Add user_id column to plans table (nullable at first)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);

-- Step 3: Drop the old unique constraint (org_id, effective_date)
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_org_id_effective_date_key;

-- Step 4: Add new unique constraint including user_id
-- This allows multiple users in the same org to have different plans on the same date
ALTER TABLE plans ADD CONSTRAINT plans_org_user_date_unique
  UNIQUE(org_id, user_id, effective_date);

-- Step 5: Create an index for querying plans by org and user
CREATE INDEX IF NOT EXISTS idx_plans_org_user ON plans(org_id, user_id, effective_date DESC);

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - Existing org-level plans (where user_id is NULL) will remain valid
-- - New user-specific plans will have a user_id
-- - You can have both org-level plans (user_id = NULL) and user-specific plans
-- - The unique constraint ensures one plan per user per date per org
-- ============================================================================
