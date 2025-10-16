-- Verify the receipts table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'receipts'
ORDER BY ordinal_position;
