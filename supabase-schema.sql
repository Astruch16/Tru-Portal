-- ============================================================================
-- Short Term Rental Management Portal - Complete Database Schema
-- ============================================================================
-- This schema includes all tables, RLS policies, functions, and triggers
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- Organizations (Properties/Clients)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User memberships (links auth.users to organizations)
CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- Properties (each org can have multiple properties)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans (pricing tiers for each org)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('launch', 'elevate', 'maximize')),
  percent DECIMAL(5,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, effective_date)
);

-- KPIs (monthly performance metrics)
CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month (YYYY-MM-01)
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0,
  expenses_cents BIGINT NOT NULL DEFAULT 0,
  net_revenue_cents BIGINT NOT NULL DEFAULT 0,
  nights_booked INTEGER NOT NULL DEFAULT 0,
  properties INTEGER NOT NULL DEFAULT 0,
  occupancy_rate DECIMAL(5,4) NOT NULL DEFAULT 0, -- 0.0 to 1.0
  vacancy_rate DECIMAL(5,4) NOT NULL DEFAULT 0,   -- 0.0 to 1.0
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, month)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT,
  bill_month DATE NOT NULL, -- YYYY-MM-01
  amount_due_cents BIGINT,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'void')),
  pdf_url TEXT, -- Supabase storage URL
  sent_at TIMESTAMPTZ, -- When email was sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, bill_month)
);

-- Invoice payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  payment_method TEXT, -- 'bank', 'credit_card', 'stripe', etc.
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger entries (detailed transactions)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL, -- Positive = revenue, Negative = expense
  category TEXT, -- 'booking', 'cleaning', 'maintenance', 'supplies', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  guest_name TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (additional user info)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. AUDIT TRAIL TABLE
-- ============================================================================

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

-- Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
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

-- Organizations: Users can view orgs they belong to
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (user_has_org_access(id));

-- Org Memberships: Users can view memberships for their orgs
CREATE POLICY "Users can view org memberships"
  ON org_memberships FOR SELECT
  USING (user_has_org_access(org_id));

-- Properties: Users can view properties for their orgs
CREATE POLICY "Users can view org properties"
  ON properties FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Admins can manage properties"
  ON properties FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Plans: Users can view their org's plan
CREATE POLICY "Users can view org plans"
  ON plans FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Owners can manage plans"
  ON plans FOR ALL
  USING (user_has_role(org_id, 'owner'));

-- KPIs: Users can view their org's KPIs
CREATE POLICY "Users can view org KPIs"
  ON kpis FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Admins can manage KPIs"
  ON kpis FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Invoices: Users can view their org's invoices
CREATE POLICY "Users can view org invoices"
  ON invoices FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Invoice Payments: Users can view payments for accessible invoices
CREATE POLICY "Users can view invoice payments"
  ON invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND user_has_org_access(invoices.org_id)
    )
  );

CREATE POLICY "Admins can manage invoice payments"
  ON invoice_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND (user_has_role(invoices.org_id, 'owner') OR user_has_role(invoices.org_id, 'manager'))
    )
  );

-- Ledger Entries: Users can view their org's entries
CREATE POLICY "Users can view org ledger entries"
  ON ledger_entries FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Admins can manage ledger entries"
  ON ledger_entries FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Bookings: Users can view their org's bookings
CREATE POLICY "Users can view org bookings"
  ON bookings FOR SELECT
  USING (user_has_org_access(org_id));

CREATE POLICY "Admins can manage bookings"
  ON bookings FOR ALL
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Audit Logs: Users can view logs for their orgs
CREATE POLICY "Users can view org audit logs"
  ON audit_logs FOR SELECT
  USING (org_id IS NULL OR user_has_org_access(org_id));

-- ============================================================================
-- 5. AUDIT TRAIL TRIGGER FUNCTION
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
-- 6. AUTO-UPDATE TIMESTAMP TRIGGER
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
-- 7. API FUNCTIONS (RPC endpoints)
-- ============================================================================

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
-- 8. INDEXES FOR PERFORMANCE
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
-- 9. SAMPLE DATA (for testing - remove in production)
-- ============================================================================
-- Uncomment to add sample data

/*
-- Create sample organization
INSERT INTO organizations (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Acme Rentals');

-- Create sample plan
INSERT INTO plans (org_id, tier, percent, effective_date) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'elevate', 18, '2025-01-01');

-- Create sample KPIs
INSERT INTO kpis (org_id, month, gross_revenue_cents, expenses_cents, net_revenue_cents, nights_booked, properties, occupancy_rate, vacancy_rate)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '2025-09-01', 1500000, 300000, 1200000, 45, 2, 0.85, 0.15),
  ('550e8400-e29b-41d4-a716-446655440000', '2025-08-01', 1400000, 280000, 1120000, 42, 2, 0.80, 0.20),
  ('550e8400-e29b-41d4-a716-446655440000', '2025-07-01', 1600000, 320000, 1280000, 48, 2, 0.90, 0.10);
*/

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
