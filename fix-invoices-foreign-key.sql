-- Fix invoices table to reference 'orgs' instead of 'organizations'
-- This makes it consistent with the rest of the codebase

-- Drop the old foreign key constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_org_id_fkey;

-- Add new foreign key constraint pointing to 'orgs' table
ALTER TABLE invoices ADD CONSTRAINT invoices_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
