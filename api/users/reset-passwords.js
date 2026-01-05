// Reset passwords for existing users - Admin utility endpoint
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

// Generate a random password
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only admin can reset passwords
  if (!['admin'].includes(auth.user.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators can reset passwords.' });
  }

  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'No emails provided. Expected array of email addresses.' });
    }

    const results = {
      success: [],
      failed: [],
      credentials: []
    };

    for (const email of emails) {
      try {
        // Find the user
        const userResult = await query(
          'SELECT id, username, email, full_name, role FROM users WHERE LOWER(email) = LOWER($1)',
          [email.trim()]
        );

        if (userResult.rows.length === 0) {
          results.failed.push({
            email,
            error: 'User not found'
          });
          continue;
        }

        const user = userResult.rows[0];

        // Generate new temporary password
        const tempPassword = generatePassword(12);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // Update password and set must_change_password
        await query(
          'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
          [passwordHash, user.id]
        );

        results.success.push({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        });

        results.credentials.push({
          fullName: user.full_name,
          email: user.email,
          username: user.username,
          temporaryPassword: tempPassword,
          role: user.role,
          mustChangePassword: true
        });

      } catch (userError) {
        console.error('Error resetting password for:', email, userError);
        results.failed.push({
          email,
          error: userError.message
        });
      }
    }

    return res.status(200).json({
      message: `Password reset completed. ${results.success.length} users updated, ${results.failed.length} failed.`,
      results
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
