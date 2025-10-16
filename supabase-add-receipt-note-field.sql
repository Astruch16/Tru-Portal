-- Add note field to receipts table
-- This allows us to store both category (in description) and a custom note
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS note TEXT;

-- Add index for note field for search performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_receipts_note ON receipts(note);
