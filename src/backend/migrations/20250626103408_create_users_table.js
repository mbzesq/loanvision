"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const up = async (pool) => {
    await pool.query(`
    -- Define a user_role type for data integrity
    CREATE TYPE user_role AS ENUM ('super_user', 'admin', 'manager', 'user');

    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role user_role NOT NULL DEFAULT 'user', -- Default role for new sign-ups
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Trigger to automatically update the updated_at timestamp
    CREATE OR REPLACE FUNCTION update_users_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_users_updated_at BEFORE UPDATE
        ON users FOR EACH ROW EXECUTE FUNCTION update_users_updated_at_column();

    -- Add comments for documentation
    COMMENT ON TABLE users IS 'Stores user account, authentication, and role information.';
    COMMENT ON COLUMN users.password_hash IS 'Stores the hashed password using bcrypt.';
    COMMENT ON COLUMN users.role IS 'Defines the access level for the user.';
  `);
};
exports.up = up;
const down = async (pool) => {
    await pool.query(`
    -- Drop tables and types in reverse order to respect dependencies
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP FUNCTION IF EXISTS update_users_updated_at_column();
    DROP TABLE IF EXISTS users CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
  `);
};
exports.down = down;
//# sourceMappingURL=20250626103408_create_users_table.js.map