-- ============================================================================
-- PROFILE FEATURES - Database Migration
-- ============================================================================
-- Adds username, user properties, and avatar functionality
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add username to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Create user_properties table (links users to their Airbnb properties)
CREATE TABLE IF NOT EXISTS user_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_name TEXT NOT NULL,
  airbnb_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_properties_user ON user_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_user_properties_property ON user_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 4. Enable RLS
ALTER TABLE user_properties ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_properties
DROP POLICY IF EXISTS "Users can view their properties" ON user_properties;
CREATE POLICY "Users can view their properties"
  ON user_properties FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage user properties" ON user_properties;
CREATE POLICY "Admins can manage user properties"
  ON user_properties FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.user_id = auth.uid()
        AND (org_memberships.role = 'owner' OR org_memberships.role = 'manager')
    )
  );

-- 6. Create storage bucket for avatars (via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policy for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 8. Auto-update timestamp trigger
DROP TRIGGER IF EXISTS update_user_properties_updated_at ON user_properties;
CREATE TRIGGER update_user_properties_updated_at
  BEFORE UPDATE ON user_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETE!
-- ============================================================================
SELECT 'Profile features migration complete! ✅ Username, user properties, and avatar storage ready.' AS status;
