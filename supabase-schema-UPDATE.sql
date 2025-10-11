-- ============================================================================
-- Short Term Rental Management Portal - UPDATE SCRIPT
-- ============================================================================
-- This script updates your existing database with new features
-- Run this if you already have tables created
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS (safe to run multiple times)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add sent_at to invoices if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='invoices' AND column_name='sent_at') THEN
    ALTER TABLE invoices ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE NEW TABLES (only if they don't exist)
-- ============================================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. DROP AND RECREATE HELPER FUNCTIONS
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS user_has_org_access(UUID);
DROP FUNCTION IF EXISTS user_has_role(UUID, TEXT);

-- Helper function to check if user belongs to an org
CREATE OR REPLACE FUNCTION user_has_org_access(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid() AND org_id = org_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(org_uuid UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = org_uuid
      AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. CREATE RLS POLICIES (drop existing ones first)
-- ============================================================================

-- Organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (user_has_org_access(id));

-- Org Memberships
DROP POLICY IF EXISTS "Users can view org memberships" ON org_memberships;
CREATE POLICY "Users can view org memberships"
  ON org_memberships FOR SELECT
  USING (user_has_org_access(org_id));

-- Properties
DROP POLICY IF EXISTS "Users can view org properties" ON properties;
CREATE POLICY "Users can view org properties"
  ON properties FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Admins can manage properties" ON properties;
CREATE POLICY "Admins can manage properties"
  ON properties FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Plans
DROP POLICY IF EXISTS "Users can view org plans" ON plans;
CREATE POLICY "Users can view org plans"
  ON plans FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Owners can manage plans" ON plans;
CREATE POLICY "Owners can manage plans"
  ON plans FOR ALL
  USING (user_has_role(org_id, 'owner'));

-- KPIs
DROP POLICY IF EXISTS "Users can view org KPIs" ON kpis;
CREATE POLICY "Users can view org KPIs"
  ON kpis FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Admins can manage KPIs" ON kpis;
CREATE POLICY "Admins can manage KPIs"
  ON kpis FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Invoices
DROP POLICY IF EXISTS "Users can view org invoices" ON invoices;
CREATE POLICY "Users can view org invoices"
  ON invoices FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Admins can manage invoices" ON invoices;
CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Invoice Payments
DROP POLICY IF EXISTS "Users can view invoice payments" ON invoice_payments;
CREATE POLICY "Users can view invoice payments"
  ON invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND user_has_org_access(invoices.org_id)
    )
  );

DROP POLICY IF EXISTS "Admins can manage invoice payments" ON invoice_payments;
CREATE POLICY "Admins can manage invoice payments"
  ON invoice_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND (user_has_role(invoices.org_id, 'owner') OR user_has_role(invoices.org_id, 'manager'))
    )
  );

-- Ledger Entries
DROP POLICY IF EXISTS "Users can view org ledger entries" ON ledger_entries;
CREATE POLICY "Users can view org ledger entries"
  ON ledger_entries FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Admins can manage ledger entries" ON ledger_entries;
CREATE POLICY "Admins can manage ledger entries"
  ON ledger_entries FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Bookings
DROP POLICY IF EXISTS "Users can view org bookings" ON bookings;
CREATE POLICY "Users can view org bookings"
  ON bookings FOR SELECT
  USING (user_has_org_access(org_id));

DROP POLICY IF EXISTS "Admins can manage bookings" ON bookings;
CREATE POLICY "Admins can manage bookings"
  ON bookings FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Audit Logs
DROP POLICY IF EXISTS "Users can view org audit logs" ON audit_logs;
CREATE POLICY "Users can view org audit logs"
  ON audit_logs FOR SELECT
  USING (org_id IS NULL OR user_has_org_access(org_id));

-- ============================================================================
-- 7. AUDIT TRAIL TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Extract org_id from the record if it exists
  IF TG_OP = 'DELETE' THEN
    v_org_id := (OLD.org_id)::UUID;
  ELSE
    v_org_id := (NEW.org_id)::UUID;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, org_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::JSONB, auth.uid(), v_org_id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, org_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, auth.uid(), v_org_id);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id, org_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB, auth.uid(), v_org_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_trigger_kpis ON kpis;
CREATE TRIGGER audit_trigger_kpis
  AFTER INSERT OR UPDATE OR DELETE ON kpis
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_trigger_invoices ON invoices;
CREATE TRIGGER audit_trigger_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_trigger_plans ON plans;
CREATE TRIGGER audit_trigger_plans
  AFTER INSERT OR UPDATE OR DELETE ON plans
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_trigger_ledger ON ledger_entries;
CREATE TRIGGER audit_trigger_ledger
  AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_trigger_bookings ON bookings;
CREATE TRIGGER audit_trigger_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- 8. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at columns
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kpis_updated_at ON kpis;
CREATE TRIGGER update_kpis_updated_at
  BEFORE UPDATE ON kpis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ledger_updated_at ON ledger_entries;
CREATE TRIGGER update_ledger_updated_at
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. DROP AND RECREATE API FUNCTIONS
-- ============================================================================

-- Drop existing functions with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS api_get_org_month_kpis(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS api_get_org_kpis_history(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE) CASCADE;

-- Get KPIs for org and month
CREATE OR REPLACE FUNCTION api_get_org_month_kpis(p_org_id UUID, p_month DATE)
RETURNS SETOF kpis AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM kpis
  WHERE org_id = p_org_id
    AND month = DATE_TRUNC('month', p_month)::DATE
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get historical KPIs for an org (last N months)
CREATE OR REPLACE FUNCTION api_get_org_kpis_history(
  p_org_id UUID,
  p_months INTEGER DEFAULT 12
)
RETURNS SETOF kpis AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM kpis
  WHERE org_id = p_org_id
  ORDER BY month DESC
  LIMIT p_months;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate monthly invoice (safe version that returns existing invoice if already created)
CREATE OR REPLACE FUNCTION api_admin_generate_monthly_invoice_safe(
  p_org_id UUID,
  p_month DATE
)
RETURNS invoices AS $$
DECLARE
  v_invoice invoices;
  v_kpi kpis;
  v_plan plans;
  v_amount_cents BIGINT;
  v_month_date DATE;
BEGIN
  v_month_date := DATE_TRUNC('month', p_month)::DATE;

  -- Check if invoice already exists
  SELECT * INTO v_invoice FROM invoices
  WHERE org_id = p_org_id AND bill_month = v_month_date;

  IF FOUND THEN
    RETURN v_invoice;
  END IF;

  -- Get KPI for the month
  SELECT * INTO v_kpi FROM kpis
  WHERE org_id = p_org_id AND month = v_month_date;

  -- Get current plan
  SELECT * INTO v_plan FROM plans
  WHERE org_id = p_org_id AND effective_date <= v_month_date
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Calculate amount due
  IF v_kpi IS NOT NULL AND v_plan IS NOT NULL THEN
    v_amount_cents := (v_kpi.gross_revenue_cents * v_plan.percent / 100)::BIGINT;
  ELSE
    v_amount_cents := 0;
  END IF;

  -- Create invoice
  INSERT INTO invoices (org_id, bill_month, amount_due_cents, status, invoice_number)
  VALUES (
    p_org_id,
    v_month_date,
    v_amount_cents,
    'due',
    'INV-' || TO_CHAR(v_month_date, 'YYYYMM') || '-' || SUBSTRING(p_org_id::TEXT, 1, 8)
  )
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(org_id);
CREATE INDEX IF NOT EXISTS idx_plans_org ON plans(org_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpis_org_month ON kpis(org_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_month ON invoices(org_id, bill_month DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_org_date ON ledger_entries(org_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_org ON bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);

-- ============================================================================
-- UPDATE COMPLETE
-- ============================================================================

-- Verify the update
SELECT 'Schema update completed successfully!' AS status;
