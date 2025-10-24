-- Property Assignments table
-- This table links users to properties they have access to

CREATE TABLE IF NOT EXISTS property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS property_assignments_property_id_idx ON property_assignments(property_id);
CREATE INDEX IF NOT EXISTS property_assignments_user_id_idx ON property_assignments(user_id);

-- Enable Row Level Security
ALTER TABLE property_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own property assignments
CREATE POLICY "Users can view their own property assignments"
  ON property_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all property assignments
CREATE POLICY "Service role can manage property assignments"
  ON property_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON property_assignments TO authenticated;
GRANT ALL ON property_assignments TO service_role;

COMMENT ON TABLE property_assignments IS 'Links users to properties they have access to';
COMMENT ON COLUMN property_assignments.property_id IS 'The property being assigned';
COMMENT ON COLUMN property_assignments.user_id IS 'The user being assigned to the property';
