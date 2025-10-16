-- Receipts table for storing receipt images and metadata
-- CORRECTED VERSION: Uses 'organizations' instead of 'orgs'
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_date DATE, -- Optional: date on the receipt itself
  amount_cents INTEGER, -- Optional: amount shown on receipt
  description TEXT, -- Optional: note about the receipt
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_org_id ON receipts(org_id);
CREATE INDEX IF NOT EXISTS idx_receipts_property_id ON receipts(property_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date_added ON receipts(date_added DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_date ON receipts(receipt_date DESC);

-- RLS policies
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage receipts" ON receipts;
DROP POLICY IF EXISTS "Members can view their property receipts" ON receipts;

-- Owners and Managers can manage all receipts for their org
CREATE POLICY "Admins can manage receipts"
  ON receipts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
      AND org_memberships.org_id = receipts.org_id
      AND org_memberships.role IN ('owner', 'manager')
    )
  );

-- Members can view receipts for properties they have access to
CREATE POLICY "Members can view their property receipts"
  ON receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
      AND org_memberships.org_id = receipts.org_id
    )
  );

-- Storage policies for receipts bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view receipts for their properties" ON storage.objects;

CREATE POLICY "Admins can upload receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Admins can update receipts"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Admins can delete receipts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
      AND org_memberships.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Users can view receipts for their properties"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
    )
  );
