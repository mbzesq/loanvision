-- Fix chat message trigger to prevent NULL concatenation issues
-- The current trigger can create NULL values when first_name or last_name is NULL
-- which may be getting converted to "0" in the JSON payload

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_notify_new_chat_message ON chat_messages;
DROP FUNCTION IF EXISTS notify_new_chat_message();

-- Create improved function that properly handles NULL values
CREATE OR REPLACE FUNCTION notify_new_chat_message() RETURNS TRIGGER AS $$
DECLARE
    notification_data JSON;
    user_name TEXT;
    room_name TEXT;
BEGIN
    -- Get user name with proper NULL handling using COALESCE
    SELECT COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), 'Unknown User')
    INTO user_name 
    FROM users WHERE id = NEW.user_id;
    
    -- Get room name with NULL handling
    SELECT COALESCE(name, 'Unknown Room') INTO room_name 
    FROM chat_rooms WHERE id = NEW.room_id;
    
    -- Build notification payload with safe content handling
    notification_data := json_build_object(
        'type', 'new_message',
        'message_id', NEW.id,
        'room_id', NEW.room_id,
        'user_id', NEW.user_id,
        'content', COALESCE(NEW.content, ''),
        'message_type', COALESCE(NEW.message_type::text, 'text'),
        'created_at', to_char(NEW.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'user_name', user_name,
        'room_name', room_name
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

-- Remove debug trigger if it exists
DROP TRIGGER IF EXISTS trigger_debug_chat_messages ON chat_messages;
DROP FUNCTION IF EXISTS debug_chat_notifications();