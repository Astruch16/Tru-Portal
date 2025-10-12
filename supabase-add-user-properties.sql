-- ============================================================================
-- Add user_properties table to link users to specific properties
-- ============================================================================

-- Create user_properties table
CREATE TABLE IF NOT EXISTS user_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_name TEXT,
  airbnb_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- Enable RLS
ALTER TABLE user_properties ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view properties assigned to them or in their org
CREATE POLICY "Users can view their assigned properties"
  ON user_properties FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = user_properties.property_id
        AND user_has_org_access(p.org_id)
    )
  );

-- Admins can manage property assignments
CREATE POLICY "Admins can manage user properties"
  ON user_properties FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = user_properties.property_id
        AND (user_has_role(p.org_id, 'owner') OR user_has_role(p.org_id, 'manager'))
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_properties_user ON user_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_user_properties_property ON user_properties(property_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_user_properties_updated_at ON user_properties;
CREATE TRIGGER update_user_properties_updated_at
  BEFORE UPDATE ON user_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
