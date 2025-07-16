-- Fix chat message trigger issues
-- Issue 1: Remove unwanted characters from JSON conversion  
-- Issue 2: Ensure proper message broadcasting format

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_notify_new_chat_message ON chat_messages;
DROP FUNCTION IF EXISTS notify_new_chat_message();

-- Create improved function to send real-time chat notifications
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
    
    -- Build notification payload with explicit text formatting
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
    
    -- Send notification using json_build_object directly (avoids ::text conversion issues)
    PERFORM pg_notify('chat_message', notification_data::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for real-time chat message notifications
CREATE TRIGGER trigger_notify_new_chat_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_chat_message();

-- Add logging to debug the chat notification system
-- This will help us see what's being sent
CREATE OR REPLACE FUNCTION debug_chat_notifications() RETURNS TRIGGER AS $$
BEGIN
    -- Log the message being sent for debugging
    RAISE NOTICE 'Chat message created: room_id=%, user_id=%, content=%', 
        NEW.room_id, NEW.user_id, LEFT(NEW.content, 50);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add debug trigger (can be removed later)
CREATE TRIGGER trigger_debug_chat_messages
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION debug_chat_notifications();