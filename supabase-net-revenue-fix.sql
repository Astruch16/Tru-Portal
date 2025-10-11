-- ============================================================================
-- Net Revenue Calculation Fix
-- ============================================================================
-- This ensures net_revenue_cents is calculated correctly as:
-- Net Revenue = Gross Revenue - Expenses - Plan Fees
-- Plan Fees = Gross Revenue × Plan Percentage (from the plan tier)
-- ============================================================================

-- Create or replace function to calculate net revenue
CREATE OR REPLACE FUNCTION calculate_net_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_percent DECIMAL(5,2);
  v_plan_fees_cents BIGINT;
BEGIN
  -- Get the plan percentage for this org at this time
  SELECT percent INTO v_plan_percent
  FROM plans
  WHERE org_id = NEW.org_id
    AND effective_date <= NEW.month
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Default to 12% (Launch tier) if no plan found
  IF v_plan_percent IS NULL THEN
    v_plan_percent := 12;
  END IF;

  -- Calculate plan fees (as a percentage of gross revenue)
  v_plan_fees_cents := (NEW.gross_revenue_cents * v_plan_percent / 100)::BIGINT;

  -- Calculate net revenue: Gross - Expenses - Plan Fees
  NEW.net_revenue_cents := NEW.gross_revenue_cents - NEW.expenses_cents - v_plan_fees_cents;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_net_revenue ON kpis;

-- Create trigger to automatically calculate net revenue on INSERT or UPDATE
CREATE TRIGGER trigger_calculate_net_revenue
  BEFORE INSERT OR UPDATE ON kpis
  FOR EACH ROW
  EXECUTE FUNCTION calculate_net_revenue();

-- ============================================================================
-- Update existing KPIs to recalculate net revenue
-- ============================================================================
-- This will trigger the function for all existing records
UPDATE kpis SET updated_at = NOW();

-- ============================================================================
-- Verification Query (run this to check the calculation)
-- ============================================================================
-- SELECT
--   k.month,
--   k.gross_revenue_cents / 100.0 as gross_revenue,
--   k.expenses_cents / 100.0 as expenses,
--   p.percent as plan_percent,
--   (k.gross_revenue_cents * p.percent / 100 / 100.0) as plan_fees,
--   k.net_revenue_cents / 100.0 as net_revenue,
--   (k.gross_revenue_cents - k.expenses_cents - (k.gross_revenue_cents * p.percent / 100)) / 100.0 as expected_net_revenue
-- FROM kpis k
-- LEFT JOIN LATERAL (
--   SELECT percent FROM plans
--   WHERE org_id = k.org_id AND effective_date <= k.month
--   ORDER BY effective_date DESC LIMIT 1
-- ) p ON true
-- ORDER BY k.month DESC;

SELECT 'Net revenue calculation trigger created successfully!' AS status;
