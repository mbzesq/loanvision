import bcrypt from 'bcryptjs';
import pool from '../db';

export async function resetSuperUserPassword(newPassword: string): Promise<boolean> {
  const superUserEmail = 'admin@loanvision.com';
  const SALT_ROUNDS = 10;

  try {
    console.log('[Reset] Resetting super user password...');

    // Check if super user exists
    const existingUser = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1 AND role = $2',
      [superUserEmail, 'super_user']
    );

    if (existingUser.rows.length === 0) {
      console.log(`[Reset] ❌ Super user with email "${superUserEmail}" not found.`);
      return false;
    }

    const user = existingUser.rows[0];
    console.log(`[Reset] Found super user: ${user.first_name} ${user.last_name} (${user.email})`);

    // Hash the new password
    console.log('[Reset] Hashing new password...');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the password
    console.log('[Reset] Updating password in database...');
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW() 
       WHERE email = $2 AND role = $3
       RETURNING id, email, first_name, last_name, updated_at`,
      [passwordHash, superUserEmail, 'super_user']
    );

    if (result.rows.length === 0) {
      console.log('[Reset] ❌ Failed to update password - no rows affected');
      return false;
    }

    const updatedUser = result.rows[0];
    console.log('[Reset] ✅ Super user password reset successfully!');
    console.log(`[Reset] User ID: ${updatedUser.id}`);
    console.log(`[Reset] Email: ${updatedUser.email}`);
    console.log(`[Reset] Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
    console.log(`[Reset] Updated: ${updatedUser.updated_at}`);
    console.log(`[Reset] New Password: ${newPassword}`);

    return true;

  } catch (error) {
    console.error('[Reset] ❌ Failed to reset super user password:');
    if (error instanceof Error) {
      console.error(`[Reset] ${error.message}`);
    } else {
      console.error('[Reset] Unknown error occurred');
    }
    throw error;
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run reset-super-user-password <new-password>');
    console.log('Example: npm run reset-super-user-password "MyNewPassword123!"');
    process.exit(1);
  }

  const newPassword = args[0];
  
  if (newPassword.length < 8) {
    console.log('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    const success = await resetSuperUserPassword(newPassword);
    if (success) {
      console.log('\n🎉 Password reset completed successfully!');
      console.log('You can now login with:');
      console.log(`Email: admin@loanvision.com`);
      console.log(`Password: ${newPassword}`);
    } else {
      console.log('\n❌ Password reset failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error during password reset:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}