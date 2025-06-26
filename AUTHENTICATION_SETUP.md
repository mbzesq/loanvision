# User Authentication Setup Guide

This guide explains how to set up and test the new user authentication system for LoanVision.

## Prerequisites

1. Ensure PostgreSQL is running (either locally or via Docker)
2. Ensure the backend `.env` file has the correct `DATABASE_URL`
3. Ensure both frontend and backend servers can be started

## Database Setup

1. **Start the database container:**
   ```bash
   docker-compose up -d db
   ```

2. **Run the migration to create user tables:**
   
   **Option A: Using the migration script (if external connections work):**
   ```bash
   cd src/backend
   npm run migrate
   ```

   **Option B: Manual migration (RECOMMENDED for initial setup):**
   If you get a "role does not exist" error, this is a known Docker networking issue. Run the migration manually:
   
   ```bash
   # Create the migrations table
   docker exec nplvision_db psql -U nplvision_user -d loanvision_db -c "
   CREATE TABLE IF NOT EXISTS migrations (
     id SERIAL PRIMARY KEY,
     filename TEXT UNIQUE NOT NULL,
     applied_at TIMESTAMPTZ DEFAULT now()
   );
   "
   
   # Run the user authentication migration
   docker exec nplvision_db psql -U nplvision_user -d loanvision_db -c "
   -- Create users table with future-proof schema
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       email TEXT UNIQUE NOT NULL,
       first_name TEXT NOT NULL,
       last_name TEXT NOT NULL,
       password_hash TEXT NOT NULL,
       role TEXT NOT NULL DEFAULT 'pending',
       is_active BOOLEAN DEFAULT false,
       is_verified BOOLEAN DEFAULT false,
       created_at TIMESTAMPTZ DEFAULT now(),
       updated_at TIMESTAMPTZ DEFAULT now(),
       last_login_at TIMESTAMPTZ,
       phone TEXT,
       company TEXT,
       department TEXT,
       two_factor_secret TEXT,
       two_factor_enabled BOOLEAN DEFAULT false,
       password_reset_token TEXT,
       password_reset_expires TIMESTAMPTZ,
       verification_token TEXT,
       verification_expires TIMESTAMPTZ,
       registration_ip TEXT,
       last_login_ip TEXT,
       failed_login_attempts INT DEFAULT 0,
       locked_until TIMESTAMPTZ,
       preferences JSONB DEFAULT '{}',
       created_by INT,
       updated_by INT,
       CONSTRAINT fk_created_by FOREIGN KEY(created_by) REFERENCES users(id),
       CONSTRAINT fk_updated_by FOREIGN KEY(updated_by) REFERENCES users(id)
   );

   CREATE TABLE user_sessions (
       id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       token_hash TEXT UNIQUE NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL,
       ip_address TEXT,
       user_agent TEXT,
       created_at TIMESTAMPTZ DEFAULT now(),
       last_accessed_at TIMESTAMPTZ DEFAULT now(),
       revoked BOOLEAN DEFAULT false,
       revoked_at TIMESTAMPTZ,
       CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   CREATE TABLE user_activity_log (
       id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       action TEXT NOT NULL,
       ip_address TEXT,
       user_agent TEXT,
       metadata JSONB DEFAULT '{}',
       created_at TIMESTAMPTZ DEFAULT now(),
       CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- Create indexes
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_users_role ON users(role);
   CREATE INDEX idx_users_is_active ON users(is_active);
   CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
   CREATE INDEX idx_user_activity_log_user_id ON user_activity_log(user_id);

   -- Create trigger
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS \$\$ BEGIN NEW.updated_at = now(); RETURN NEW; END; \$\$ language 'plpgsql';
   CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   INSERT INTO migrations (filename) VALUES ('20250625193228_create_users_table.ts');
   "
   ```

   **Note:** There's a known issue with Docker PostgreSQL host-based authentication that prevents external connections from Node.js applications running on the host machine. The manual migration approach works around this by running commands directly inside the container.

## Starting the Application

1. **Start the backend server:**
   ```bash
   cd src/backend
   npm run dev
   ```

2. **Start the frontend server (in a new terminal):**
   ```bash
   cd src/frontend
   npm run dev
   ```

## Testing the Authentication Flow

### 1. Registration
- Navigate to `http://localhost:5173/register`
- Fill out the registration form with:
  - First Name
  - Last Name
  - Email
  - Company (optional)
  - Password (minimum 8 characters)
- Submit the form
- You should see a success message indicating your account is pending approval

### 2. Initial Admin Setup
Since new registrations require admin approval, you'll need to manually activate the first admin user:

1. Connect to your PostgreSQL database:
   ```bash
   psql -U nplvision_user -d loanvision_db
   ```

2. Update the first registered user to be an active admin:
   ```sql
   UPDATE users 
   SET role = 'admin', is_active = true, is_verified = true 
   WHERE email = 'your-email@example.com';
   ```

### 3. Login
- Navigate to `http://localhost:5173/login`
- Enter your email and password
- Upon successful login, you'll be redirected to the dashboard

### 4. Protected Routes
- Try accessing `/dashboard`, `/loans`, or `/upload` without logging in
- You should be redirected to the login page
- After logging in, you should be able to access all protected routes

### 5. Logout
- Click the "Logout" button in the sidebar
- You should be redirected to the login page
- Try accessing a protected route - you should be redirected back to login

## Admin Features

Once you have an admin account:

### Activating Pending Users
Make a POST request to activate a pending user:
```bash
curl -X POST http://localhost:3000/api/auth/admin/activate-user/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Viewing Pending Users
```bash
curl http://localhost:3000/api/auth/admin/pending-users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## API Endpoints

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/change-password` - Change password

### Admin Endpoints
- `GET /api/auth/admin/pending-users` - List pending registrations
- `POST /api/auth/admin/activate-user/:userId` - Activate a user

## Security Features Implemented

1. **Password Security**
   - Passwords are hashed using bcrypt
   - Minimum 8 character requirement
   - Password confirmation on registration

2. **Session Management**
   - JWT tokens with 7-day expiration
   - HTTP-only cookies for token storage
   - Session tracking in database

3. **Account Security**
   - Account lockout after 5 failed login attempts
   - Email verification tokens (structure in place)
   - Activity logging for audit trails

4. **Future-Ready Features**
   - 2FA fields in database schema
   - Password reset token support
   - Role-based access control framework

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure the database exists

### CORS Issues
- The backend is configured to accept requests from `http://localhost:5173`
- Check that both servers are running on the correct ports

### Authentication Failures
- Check browser console for errors
- Verify JWT_SECRET is set in backend `.env`
- Check that cookies are enabled in your browser

## Next Steps

1. Implement email verification flow
2. Add password reset functionality
3. Implement 2FA
4. Add user management UI for admins
5. Enhance the dashboard with real functionality