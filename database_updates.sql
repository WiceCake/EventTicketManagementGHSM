-- Add is_finished column to event_config table
-- Run this in your Supabase SQL editor or database client

ALTER TABLE event_config 
ADD COLUMN is_finished BOOLEAN DEFAULT false;

-- Update existing events to set proper finished status
-- Events that have passed their date should be marked as finished
UPDATE event_config 
SET is_finished = true 
WHERE event_date < CURRENT_DATE;

-- Optionally, if you want to mark events that are exactly today as finished too:
-- UPDATE event_config 
-- SET is_finished = true 
-- WHERE event_date <= CURRENT_DATE;

-- Create an index for better performance on finished events queries
CREATE INDEX IF NOT EXISTS idx_event_config_is_finished ON event_config(is_finished);
