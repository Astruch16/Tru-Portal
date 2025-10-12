-- Add missing columns to properties table
-- Run this in your Supabase SQL Editor

-- Add address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'address'
  ) THEN
    ALTER TABLE properties ADD COLUMN address TEXT;
  END IF;
END $$;

-- Add property_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE properties ADD COLUMN property_type TEXT;
  END IF;
END $$;

-- Add airbnb_link column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'airbnb_link'
  ) THEN
    ALTER TABLE properties ADD COLUMN airbnb_link TEXT;
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'properties'
ORDER BY ordinal_position;
