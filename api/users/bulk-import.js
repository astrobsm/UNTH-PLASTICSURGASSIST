// Bulk Import Users API endpoint for Vercel serverless
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

  // Debug logging
  console.log('Bulk import request from user:', JSON.stringify(auth.user));
  console.log('User role:', auth.user.role);

  // Only admin can bulk import users
  if (!['admin'].includes(auth.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied. Only administrators can bulk import users.',
      debug: { userRole: auth.user.role, expectedRole: 'admin' }
    });
  }

  try {
    const { users: usersToImport } = req.body;

    if (!usersToImport || !Array.isArray(usersToImport) || usersToImport.length === 0) {
      return res.status(400).json({ error: 'No users provided for import. Expected array of users with fullName, email, and role.' });
    }

    const results = {
      success: [],
      failed: [],
      credentials: []
    };

    for (const userData of usersToImport) {
      try {
        const { fullName, email, role = 'house_officer', department = '' } = userData;

        if (!fullName || !email) {
          results.failed.push({
            email: email || 'N/A',
            fullName: fullName || 'N/A',
            error: 'Missing required fields: fullName and email are required'
          });
          continue;
        }

        // Generate username from email (part before @)
        let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check if username already exists
        const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUsername.rows.length > 0) {
          // Append random numbers to make unique
          username = `${username}${Math.floor(Math.random() * 1000)}`;
        }

        // Check if email already exists
        const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingEmail.rows.length > 0) {
          results.failed.push({
            email,
            fullName,
            error: 'Email already exists'
          });
          continue;
        }

        // Generate a temporary password
        const tempPassword = generatePassword(12);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // Determine if user should be required to change password
        // Admin users do NOT need to change password on first login
        const mustChangePassword = role !== 'admin';

        const result = await query(
          `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, must_change_password)
           VALUES ($1, $2, $3, $4, $5, true, true, $6)
           RETURNING id, username, email, full_name, role, is_approved, is_active`,
          [username, passwordHash, email, fullName, role, mustChangePassword]
        );

        const createdUser = result.rows[0];
        
        results.success.push({
          id: createdUser.id,
          username: createdUser.username,
          email: createdUser.email,
          fullName: createdUser.full_name,
          role: createdUser.role
        });

        // Store credentials for download (only for admin to distribute)
        results.credentials.push({
          fullName,
          email,
          username,
          temporaryPassword: tempPassword,
          role,
          mustChangePassword
        });

      } catch (userError) {
        console.error('Error importing user:', userData.email, userError);
        results.failed.push({
          email: userData.email || 'N/A',
          fullName: userData.fullName || 'N/A',
          error: userError.message
        });
      }
    }

    return res.status(200).json({
      message: `Bulk import completed. ${results.success.length} users created, ${results.failed.length} failed.`,
      results
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
