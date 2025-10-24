-- Add property_id column to messages table
-- This allows messages to be associated with specific properties

ALTER TABLE messages ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Create index for faster property-based queries
CREATE INDEX IF NOT EXISTS messages_property_id_idx ON messages(property_id);

-- Update comment
COMMENT ON COLUMN messages.property_id IS 'Optional: Property the message is related to';
