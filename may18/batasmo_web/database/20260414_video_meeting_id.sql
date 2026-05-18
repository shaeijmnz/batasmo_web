-- Add video_meeting_id column to consultation_rooms
-- This stores the VideoSDK meeting room ID for video calls tied to a consultation

ALTER TABLE consultation_rooms
  ADD COLUMN IF NOT EXISTS video_meeting_id TEXT DEFAULT NULL;

-- Allow authenticated users to read and update video_meeting_id
-- (RLS policies on consultation_rooms already cover this column, since it's on the same table)

COMMENT ON COLUMN consultation_rooms.video_meeting_id IS
  'VideoSDK room ID for video calls. Set when a video call is started, cleared when the call ends.';
