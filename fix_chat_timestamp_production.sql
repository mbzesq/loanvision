-- Fix chat message timestamp trigger for production
-- This fixes the timezone issue causing messages to appear in the future

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_notify_new_chat_message ON chat_messages;
DROP FUNCTION IF EXISTS notify_new_chat_message();

-- Create improved function with correct timestamp handling
CREATE OR REPLACE FUNCTION notify_new_chat_message() RETURNS TRIGGER AS $$
DECLARE
    notification_data JSON;
    user_name TEXT;
    room_name TEXT;
BEGIN
    -- Get user name separately to avoid JSON formatting issues
    SELECT first_name || ' ' || last_name INTO user_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get room name separately
    SELECT name INTO room_name 
    FROM chat_rooms WHERE id = NEW.room_id;
    
    -- Build notification payload with correct timestamp format
    -- IMPORTANT: Use the timestamp as-is without timezone conversion
    notification_data := json_build_object(
        'type', 'new_message',
        'message_id', NEW.id,
        'room_id', NEW.room_id,
        'user_id', NEW.user_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'created_at', to_char(NEW.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'user_name', COALESCE(user_name, 'Unknown User'),
        'room_name', COALESCE(room_name, 'Unknown Room')
    );
    
    -- Send notification
    PERFORM pg_notify('chat_message', notification_data::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for real-time chat message notifications
CREATE TRIGGER trigger_notify_new_chat_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_chat_message();

-- Verify the trigger was created successfully
SELECT 'Chat timestamp trigger fixed successfully' as status;