-- Add reactions support to messages table
-- Reactions will be stored as JSONB

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Create index for faster reactions queries
CREATE INDEX IF NOT EXISTS messages_reactions_idx ON messages USING GIN (reactions);

COMMENT ON COLUMN messages.reactions IS 'Array of reaction objects: [{emoji: string, user_id: string, created_at: timestamp}]';
