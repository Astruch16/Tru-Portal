-- ============================================================================
-- STEP 1: CLEANUP SCRIPT
-- ============================================================================
-- Run this FIRST to remove any broken tables
-- Then run supabase-schema-FRESH.sql
-- ============================================================================

-- Drop all tables in the correct order (respecting foreign keys)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS kpis CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS org_memberships CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS user_has_org_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS user_has_role(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS api_get_org_month_kpis(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS api_get_org_kpis_history(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE) CASCADE;

SELECT 'Cleanup complete! Now run supabase-schema-FRESH.sql' AS status;
