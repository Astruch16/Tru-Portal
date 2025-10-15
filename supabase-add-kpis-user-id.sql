-- ============================================================================
-- Add user_id column to kpis table for per-user KPI tracking
-- ============================================================================

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'kpis' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE kpis ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the old unique constraint on (org_id, month)
ALTER TABLE kpis DROP CONSTRAINT IF EXISTS kpis_org_id_month_key;

-- Add new unique constraint on (org_id, user_id, month)
-- This allows multiple KPI records per month - one per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kpis_org_id_user_id_month_key'
  ) THEN
    ALTER TABLE kpis ADD CONSTRAINT kpis_org_id_user_id_month_key UNIQUE(org_id, user_id, month);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_kpis_user_month ON kpis(user_id, month);
