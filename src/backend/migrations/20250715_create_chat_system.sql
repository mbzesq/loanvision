-- Create real-time chat system for organization-scoped messaging
-- This enables users within the same organization to chat in real-time

-- Chat room types for different conversation contexts
CREATE TYPE chat_room_type AS ENUM ('general', 'department', 'direct_message', 'project');

-- Message types for different content
CREATE TYPE chat_message_type AS ENUM ('text', 'file', 'system', 'emoji_only');

-- User status for presence indicators
CREATE TYPE chat_user_status AS ENUM ('online', 'away', 'busy', 'offline');

-- Chat rooms table - organization-scoped conversation spaces
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type chat_room_type NOT NULL DEFAULT 'general',
    organization_id INTEGER, -- Will be populated later when organizations table exists
    department_id INTEGER,   -- Will be populated later when organization_departments table exists
    created_by_user_id INTEGER REFERENCES users(id) NOT NULL,
    is_private BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat participants - who can access which rooms
CREATE TABLE chat_participants (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    UNIQUE(room_id, user_id)
);

-- Chat messages - the actual message content
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    message_type chat_message_type DEFAULT 'text',
    content TEXT NOT NULL,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    thread_parent_id INTEGER REFERENCES chat_messages(id),
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message reactions for engagement
CREATE TABLE chat_message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- User presence and typing indicators
CREATE TABLE chat_user_presence (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status chat_user_status DEFAULT 'offline',
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_typing_in_room_id INTEGER REFERENCES chat_rooms(id),
    typing_started_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_chat_rooms_organization_id ON chat_rooms(organization_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX idx_chat_rooms_last_message_at ON chat_rooms(last_message_at DESC);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_room_id ON chat_participants(room_id);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_thread_parent_id ON chat_messages(thread_parent_id);
CREATE INDEX idx_chat_message_reactions_message_id ON chat_message_reactions(message_id);
CREATE INDEX idx_chat_user_presence_status ON chat_user_presence(status);

-- Function to create a direct message room between two users
CREATE OR REPLACE FUNCTION create_direct_message_room(
    user1_id INTEGER,
    user2_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    room_id INTEGER;
    org_id INTEGER;
    user1_name TEXT;
    user2_name TEXT;
BEGIN
    -- For now, allow any users to create DM rooms
    -- This will be enhanced when organization system is fully implemented
    org_id := 1; -- Default organization
    
    -- Check if DM room already exists between these users
    SELECT cr.id INTO room_id
    FROM chat_rooms cr
    WHERE cr.type = 'direct_message'
    AND EXISTS (
        SELECT 1 FROM chat_participants cp1 
        WHERE cp1.room_id = cr.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
        SELECT 1 FROM chat_participants cp2 
        WHERE cp2.room_id = cr.id AND cp2.user_id = user2_id
    )
    AND (
        SELECT COUNT(*) FROM chat_participants cp 
        WHERE cp.room_id = cr.id
    ) = 2;
    
    -- If room exists, return it
    IF room_id IS NOT NULL THEN
        RETURN room_id;
    END IF;
    
    -- Get user names for room name
    SELECT first_name || ' ' || last_name INTO user1_name FROM users WHERE id = user1_id;
    SELECT first_name || ' ' || last_name INTO user2_name FROM users WHERE id = user2_id;
    
    -- Create new DM room
    INSERT INTO chat_rooms (
        name, type, organization_id, created_by_user_id, is_private
    ) VALUES (
        user1_name || ' & ' || user2_name,
        'direct_message',
        org_id,
        user1_id,
        true
    ) RETURNING id INTO room_id;
    
    -- Add both users as participants
    INSERT INTO chat_participants (room_id, user_id, is_admin) VALUES
        (room_id, user1_id, true),
        (room_id, user2_id, true);
    
    RETURN room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update room's last_message_at when new message is posted
CREATE OR REPLACE FUNCTION update_room_last_message() RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_rooms 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update room's last message timestamp
CREATE TRIGGER trigger_update_room_last_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_room_last_message();

-- Function to send real-time chat notifications
CREATE OR REPLACE FUNCTION notify_new_chat_message() RETURNS TRIGGER AS $$
DECLARE
    notification_data JSON;
BEGIN
    -- Build notification payload
    SELECT json_build_object(
        'type', 'new_message',
        'message_id', NEW.id,
        'room_id', NEW.room_id,
        'user_id', NEW.user_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'created_at', NEW.created_at,
        'user_name', (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
        'room_name', (SELECT name FROM chat_rooms WHERE id = NEW.room_id)
    ) INTO notification_data;
    
    -- Send notification
    PERFORM pg_notify('chat_message', notification_data::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time chat message notifications
CREATE TRIGGER trigger_notify_new_chat_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_chat_message();

-- Create a default general chat room for all users
INSERT INTO chat_rooms (name, description, type, organization_id, created_by_user_id)
SELECT 
    'General',
    'General discussion for all users',
    'general',
    1, -- Default organization
    (SELECT id FROM users LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM chat_rooms cr 
    WHERE cr.type = 'general' AND cr.name = 'General'
);

-- Add all existing users to the general chat room
INSERT INTO chat_participants (room_id, user_id)
SELECT 
    (SELECT id FROM chat_rooms WHERE type = 'general' AND name = 'General' LIMIT 1),
    u.id
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.room_id = (SELECT id FROM chat_rooms WHERE type = 'general' AND name = 'General' LIMIT 1)
    AND cp.user_id = u.id
);