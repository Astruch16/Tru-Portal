-- ============================================================================
-- UX IMPROVEMENTS MIGRATION
-- ============================================================================
-- Add property_id to invoices for better filtering and organization
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Add property_id column to invoices table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='property_id') THEN
    ALTER TABLE invoices ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added property_id column to invoices table';
  ELSE
    RAISE NOTICE 'property_id column already exists in invoices table';
  END IF;
END $$;

-- Step 2: Add index for property_id lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_property ON invoices(property_id);

-- Step 3: Update the invoice generation function to support property_id
-- ============================================================================
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE, UUID) CASCADE;

CREATE FUNCTION api_admin_generate_monthly_invoice_safe(
  p_org_id UUID,
  p_month DATE,
  p_property_id UUID DEFAULT NULL
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

  -- Check for existing invoice with same org, month, and property
  IF p_property_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices
    WHERE org_id = p_org_id
      AND bill_month = v_month_date
      AND property_id = p_property_id;
  ELSE
    SELECT * INTO v_invoice FROM invoices
    WHERE org_id = p_org_id
      AND bill_month = v_month_date
      AND property_id IS NULL;
  END IF;

  IF FOUND THEN
    RETURN v_invoice;
  END IF;

  -- Get KPI data (for now, we'll use org-level KPIs)
  -- In the future, this could be property-specific KPIs
  SELECT * INTO v_kpi FROM kpis
  WHERE org_id = p_org_id AND month = v_month_date;

  SELECT * INTO v_plan FROM plans
  WHERE org_id = p_org_id
    AND effective_date <= v_month_date
  ORDER BY effective_date DESC LIMIT 1;

  IF v_kpi IS NOT NULL AND v_plan IS NOT NULL THEN
    v_amount_cents := (v_kpi.gross_revenue_cents * v_plan.percent / 100)::BIGINT;
  ELSE
    v_amount_cents := 0;
  END IF;

  -- Generate invoice number with property suffix if provided
  INSERT INTO invoices (org_id, bill_month, amount_due_cents, status, invoice_number, property_id)
  VALUES (
    p_org_id,
    v_month_date,
    v_amount_cents,
    'due',
    'INV-' || TO_CHAR(v_month_date, 'YYYYMM') || '-' || SUBSTRING(p_org_id::TEXT, 1, 8) ||
      CASE WHEN p_property_id IS NOT NULL THEN '-' || SUBSTRING(p_property_id::TEXT, 1, 4) ELSE '' END,
    p_property_id
  )
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
SELECT 'UX Improvements migration completed successfully!
✅ property_id added to invoices table
✅ Index created for efficient property filtering
✅ Invoice generation function updated to support property-specific invoices' AS status;
