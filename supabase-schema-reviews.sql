-- Reviews table schema
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'vrbo')),
  rating NUMERIC NOT NULL,
  review_text TEXT,
  review_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_reviews_org_id ON reviews(org_id);
CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);

-- RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can view reviews for their org
CREATE POLICY "Users can view org reviews"
  ON reviews FOR SELECT
  USING (user_has_org_access(org_id));

-- Admins (owners and managers) can insert reviews
CREATE POLICY "Admins can insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Admins (owners and managers) can update reviews
CREATE POLICY "Admins can update reviews"
  ON reviews FOR UPDATE
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));

-- Admins (owners and managers) can delete reviews
CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  USING (user_has_role(org_id, 'owner') OR user_has_role(org_id, 'manager'));
