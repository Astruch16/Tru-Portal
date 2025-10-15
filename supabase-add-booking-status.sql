-- ============================================================================
-- Add status column to bookings table
-- ============================================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled'));
  END IF;
END $$;

-- Update any existing bookings without a status to 'upcoming'
UPDATE bookings
SET status = 'upcoming'
WHERE status IS NULL;
