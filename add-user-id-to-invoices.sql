-- Add user_id column to invoices table to associate invoices with specific users
-- This makes invoices user-specific instead of org-wide

-- Add the user_id column (nullable initially because existing invoices won't have it)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);

-- Optional: Update the unique constraint to include user_id if you want one invoice per user per month
-- Uncomment the lines below if you want this behavior:
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_org_id_bill_month_key;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_org_id_user_id_bill_month_key UNIQUE(org_id, user_id, bill_month);
