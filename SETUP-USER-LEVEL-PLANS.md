# Setup User-Level Plans & KPIs

This guide explains how to set up your database to support user-specific plan tiers (Launch/Elevate/Maximize) with different commission rates.

## Overview

The system now supports:
- **User-level plans**: Each user can have their own tier (Launch=12%, Elevate=18%, Maximize=22%)
- **User-level KPIs**: Revenue, expenses, and net revenue are tracked per user
- **Automatic net revenue calculation**: Net Revenue = Gross Revenue - Expenses - TruHost Fees (based on user's plan %)

## Database Setup Steps

### Step 1: Add `user_id` to plans table

Run this SQL in your Supabase SQL Editor:

```sql
-- File: supabase-add-user-plans.sql
-- This adds user_id column to plans table

ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);

ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_org_id_effective_date_key;

ALTER TABLE plans ADD CONSTRAINT plans_org_user_date_unique
  UNIQUE(org_id, user_id, effective_date);

CREATE INDEX IF NOT EXISTS idx_plans_org_user ON plans(org_id, user_id, effective_date DESC);
```

### Step 2: Add `user_id` to kpis table

Run this SQL in your Supabase SQL Editor:

```sql
-- File: supabase-add-kpis-user-id.sql
-- This adds user_id column to kpis table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'kpis' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE kpis ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE kpis DROP CONSTRAINT IF EXISTS kpis_org_id_month_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kpis_org_id_user_id_month_key'
  ) THEN
    ALTER TABLE kpis ADD CONSTRAINT kpis_org_id_user_id_month_key UNIQUE(org_id, user_id, month);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kpis_user_month ON kpis(user_id, month);
```

### Step 3: Assign users to plan tiers

Now you can assign each user to a plan tier using the admin portal:

1. Go to the **Users** section in the admin portal
2. Click on a user to open their modal
3. Select a plan tier from the dropdown:
   - **Launch**: 12% commission
   - **Elevate**: 18% commission
   - **Maximize**: 22% commission
4. Click "Update Plan"

This will create a record in the `plans` table with:
- `org_id`: The organization ID
- `user_id`: The user's ID
- `tier`: The plan name (launch/elevate/maximize)
- `percent`: The commission percentage (12/18/22)
- `effective_date`: Today's date

## How It Works

### When Revenue/Expense is Added:

1. Admin adds revenue or expense for a property
2. System looks up which user owns that property (via `user_properties` table)
3. System fetches that user's plan percentage from `plans` table
4. System calculates:
   - **Gross Revenue**: Sum of all positive amounts
   - **Expenses**: Sum of all negative amounts (as positive)
   - **TruHost Fees**: `(Gross Revenue × Plan Percent) / 100`
   - **Net Revenue**: `Gross Revenue - Expenses - TruHost Fees`
5. System stores/updates KPI record with `user_id` in `kpis` table

### In the Member Portal:

- Members see their own KPIs based on their assigned properties
- Net revenue automatically reflects their specific plan tier percentage
- TruHost Fees card shows their percentage and calculated fees

### In the Admin Portal:

- Admin can see each user's plan tier and commission rate in the Users section
- When viewing property KPIs, net revenue uses the property owner's plan percentage

## Verification

After setup, verify everything is working:

1. **Assign a property to a user**:
   ```sql
   INSERT INTO user_properties (user_id, property_id)
   VALUES ('user-uuid-here', 'property-uuid-here');
   ```

2. **Assign a plan to the user** (via admin portal UI or SQL):
   ```sql
   INSERT INTO plans (org_id, user_id, tier, percent, effective_date)
   VALUES (
     'org-uuid-here',
     'user-uuid-here',
     'elevate',
     18,
     CURRENT_DATE
   );
   ```

3. **Add revenue for that property** (via admin portal UI)
   - Add $1000 revenue
   - Expected results for "Elevate" tier (18%):
     - Gross Revenue: $1000
     - TruHost Fees: $180 (18% of $1000)
     - Net Revenue: $820 ($1000 - $0 expenses - $180 fees)

4. **Check in member portal**:
   - Log in as the user
   - Verify they see the correct net revenue with their tier's percentage applied

## Troubleshooting

**Issue**: Net revenue equals gross revenue (fees not being subtracted)
- **Cause**: User doesn't have a plan assigned
- **Solution**: Assign a plan tier via the admin portal Users section

**Issue**: "Property must be assigned to a user" error
- **Cause**: Property isn't linked to any user
- **Solution**: Assign the property to a user in the admin portal

**Issue**: KPIs not updating
- **Cause**: Old org-level KPI records conflicting with new user-level records
- **Solution**: Clear old KPI data and let the system rebuild them:
  ```sql
  DELETE FROM kpis WHERE user_id IS NULL;
  ```

## Plan Tiers Reference

| Tier     | Commission Rate | Monthly Cost (example) |
|----------|----------------|------------------------|
| Launch   | 12%            | TBD                    |
| Elevate  | 18%            | TBD                    |
| Maximize | 22%            | TBD                    |

Net Revenue Formula: `Gross Revenue - Expenses - (Gross Revenue × Commission Rate)`
