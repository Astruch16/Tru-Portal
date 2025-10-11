-- Receipts table for storing receipt images and metadata
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_date DATE, -- Optional: date on the receipt itself
  amount_cents INTEGER, -- Optional: amount shown on receipt
  description TEXT, -- Optional: note about the receipt
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- Admins can do everything
CREATE POLICY "Admins can manage receipts"
  ON receipts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Members can view receipts for their properties
CREATE POLICY "Members can view their property receipts"
  ON receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_properties up
      JOIN users u ON u.id = up.user_id
      WHERE u.id = auth.uid()
      AND up.property_id = receipts.property_id
      AND u.role = 'member'
    )
  );

-- Create storage bucket for receipts (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Admins can upload receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update receipts"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete receipts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view receipts for their properties"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts' AND (
      -- Admins can see all
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
      OR
      -- Members can see their property receipts
      EXISTS (
        SELECT 1 FROM user_properties up
        JOIN users u ON u.id = up.user_id
        WHERE u.id = auth.uid()
        AND u.role = 'member'
      )
    )
  );
