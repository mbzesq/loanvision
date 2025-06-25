# User Authentication Setup Guide

This guide explains how to set up and test the new user authentication system for LoanVision.

## Prerequisites

1. Ensure PostgreSQL is running (either locally or via Docker)
2. Ensure the backend `.env` file has the correct `DATABASE_URL`
3. Ensure both frontend and backend servers can be started

## Database Setup

1. **Run the migration to create user tables:**
   ```bash
   cd src/backend
   npm run migrate
   ```

   If you get a database connection error, ensure:
   - PostgreSQL is running
   - The `DATABASE_URL` in `src/backend/.env` is correct
   - The database specified in the URL exists

2. **If using Docker, start the database container:**
   ```bash
   docker-compose up -d db
   ```

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