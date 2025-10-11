-- ============================================================================
-- Short Term Rental Management Portal - SAFE UPDATE
-- ============================================================================
-- This safely adds missing tables to your existing database
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS (if not already enabled)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CREATE MISSING ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. INSERT A DEFAULT ORGANIZATION
-- ============================================================================
-- This will create an organization with the org_id you're currently using
-- Replace this UUID with your actual org_id from the URL

INSERT INTO organizations (id, name, created_at)
VALUES ('9f2d435f-e0be-4995-addc-3524527e637b', 'Default Organization', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. CREATE OTHER MISSING TABLES (if needed)
-- ============================================================================

-- Properties (if not exists)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans (if not exists)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('launch', 'elevate', 'maximize')),
  percent DECIMAL(5,2) NOT NULL CHECK (
    (tier = 'launch' AND percent = 12) OR
    (tier = 'elevate' AND percent = 18) OR
    (tier = 'maximize' AND percent = 22)
  ),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, effective_date)
);

-- KPIs (if not exists)
CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0,
  expenses_cents BIGINT NOT NULL DEFAULT 0,
  net_revenue_cents BIGINT NOT NULL DEFAULT 0,
  nights_booked INTEGER NOT NULL DEFAULT 0,
  properties INTEGER NOT NULL DEFAULT 0,
  occupancy_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  vacancy_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, month)
);

-- Invoices (if not exists)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT,
  bill_month DATE NOT NULL,
  amount_due_cents BIGINT,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'void')),
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  plan_tier TEXT,
  fee_pct DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, bill_month)
);

-- Invoice payments (if not exists)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  payment_method TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger entries (if not exists)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings (if not exists)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  guest_name TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (if not exists)
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

-- ============================================================================
-- 5. UPDATE ORG_MEMBERSHIPS TO FIX FK CONSTRAINT
-- ============================================================================
-- The org_memberships table already exists but needs to reference organizations

-- First, check if the FK constraint exists and is broken
DO $$
BEGIN
  -- Try to add the FK constraint if it doesn't exist
  -- This will fail gracefully if it already exists
  BEGIN
    ALTER TABLE org_memberships
      ADD CONSTRAINT org_memberships_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- FK already exists, that's fine
    WHEN others THEN
      RAISE NOTICE 'Could not add FK constraint: %', SQLERRM;
  END;
END $$;

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. HELPER FUNCTIONS (only create if they don't exist)
-- ============================================================================

-- Only create the function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_org_access') THEN
    CREATE FUNCTION user_has_org_access(org_uuid UUID)
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM org_memberships
        WHERE user_id = auth.uid() AND org_id = org_uuid
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_role') THEN
    CREATE FUNCTION user_has_role(org_uuid UUID, required_role TEXT)
    RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM org_memberships
        WHERE user_id = auth.uid()
          AND org_id = org_uuid
          AND role = required_role
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- ============================================================================
-- 9. RLS POLICIES (create if they don't exist)
-- ============================================================================

-- Organizations
DO $$ BEGIN
  CREATE POLICY "Users can view their organizations"
    ON organizations FOR SELECT
    USING (user_has_org_access(id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Properties
DO $$ BEGIN
  CREATE POLICY "Users can view org properties"
    ON properties FOR SELECT
    USING (user_has_org_access(org_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage properties"
    ON properties FOR ALL
    USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plans
DO $$ BEGIN
  CREATE POLICY "Users can view org plans"
    ON plans FOR SELECT
    USING (user_has_org_access(org_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can manage plans"
    ON plans FOR ALL
    USING (user_has_role(org_id, 'owner'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- KPIs
DO $$ BEGIN
  CREATE POLICY "Users can view org KPIs"
    ON kpis FOR SELECT
    USING (user_has_org_access(org_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage KPIs"
    ON kpis FOR ALL
    USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Invoices
DO $$ BEGIN
  CREATE POLICY "Users can view org invoices"
    ON invoices FOR SELECT
    USING (user_has_org_access(org_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage invoices"
    ON invoices FOR ALL
    USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- COMPLETE!
-- ============================================================================

SELECT 'Database update complete! Organizations table and other missing tables created.' AS status;
