// Force password change endpoint for first login after bulk import
import bcrypt from 'bcryptjs';
import { query } from '../../_lib/db.js';
import { cors, authenticateRequest } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    if (req.method !== 'PATCH' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get user ID from URL path
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only allow users to change their own password
    if (auth.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { newPassword, currentPassword } = req.body;

    if (!newPassword || !currentPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Verify current password
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password and clear must_change_password flag
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
      [passwordHash, id]
    );

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Force password change error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
