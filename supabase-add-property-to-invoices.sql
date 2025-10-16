-- ============================================================================
-- Add property_id support to invoice generation
-- ============================================================================
-- This script updates the invoice generation function to support property-specific invoices
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Add property_id column to invoices table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='invoices' AND column_name='property_id') THEN
    ALTER TABLE invoices ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for property_id lookups
CREATE INDEX IF NOT EXISTS idx_invoices_property ON invoices(property_id);

-- Drop the old function
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS api_admin_generate_monthly_invoice_safe(UUID, DATE, UUID) CASCADE;

-- Create the updated function with property_id support
CREATE FUNCTION api_admin_generate_monthly_invoice_safe(
  p_org_id UUID,
  p_month DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS invoices AS $$
DECLARE
  v_invoice invoices;
  v_plan plans;
  v_amount_cents BIGINT;
  v_month_date DATE;
  v_invoice_number TEXT;
  v_total_gross_revenue BIGINT;
  v_total_expenses BIGINT;
  v_truhost_fees BIGINT;
BEGIN
  v_month_date := DATE_TRUNC('month', p_month)::DATE;

  -- Check if invoice already exists for this org/month/property combination
  SELECT * INTO v_invoice
  FROM invoices
  WHERE org_id = p_org_id
    AND bill_month = v_month_date
    AND (
      (p_property_id IS NULL AND property_id IS NULL) OR
      (property_id = p_property_id)
    );

  IF FOUND THEN
    RETURN v_invoice;
  END IF;

  -- Get active plan
  SELECT * INTO v_plan
  FROM plans
  WHERE org_id = p_org_id
    AND effective_date <= v_month_date
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Calculate total gross revenue and expenses based on property selection
  -- Note: KPIs are tracked per user (user_id), and users are linked to properties via user_properties
  IF p_property_id IS NOT NULL THEN
    -- For a specific property: get KPIs for users assigned to that property
    SELECT
      COALESCE(SUM(k.gross_revenue_cents), 0),
      COALESCE(SUM(k.expenses_cents), 0)
    INTO v_total_gross_revenue, v_total_expenses
    FROM kpis k
    INNER JOIN user_properties up ON k.user_id = up.user_id
    WHERE k.org_id = p_org_id
      AND k.month = v_month_date
      AND up.property_id = p_property_id;
  ELSE
    -- For organization-wide invoice: sum all KPIs for the month
    SELECT
      COALESCE(SUM(gross_revenue_cents), 0),
      COALESCE(SUM(expenses_cents), 0)
    INTO v_total_gross_revenue, v_total_expenses
    FROM kpis
    WHERE org_id = p_org_id
      AND month = v_month_date;
  END IF;

  -- Calculate TruHost fees based on plan percentage
  IF v_plan IS NOT NULL THEN
    v_truhost_fees := (v_total_gross_revenue * v_plan.percent / 100)::BIGINT;
  ELSE
    v_truhost_fees := 0;
  END IF;

  -- Total invoice amount = TruHost fees + expenses
  v_amount_cents := v_truhost_fees + v_total_expenses;

  -- Generate invoice number
  IF p_property_id IS NOT NULL THEN
    v_invoice_number := 'INV-' || TO_CHAR(v_month_date, 'YYYYMM') || '-P' || SUBSTRING(p_property_id::TEXT, 1, 8);
  ELSE
    v_invoice_number := 'INV-' || TO_CHAR(v_month_date, 'YYYYMM') || '-' || SUBSTRING(p_org_id::TEXT, 1, 8);
  END IF;

  -- Insert new invoice
  INSERT INTO invoices (
    org_id,
    property_id,
    bill_month,
    amount_due_cents,
    status,
    invoice_number
  )
  VALUES (
    p_org_id,
    p_property_id,
    v_month_date,
    v_amount_cents,
    'due',
    v_invoice_number
  )
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Migration complete!
-- ============================================================================
SELECT 'Invoice property_id support added successfully!' AS status;
