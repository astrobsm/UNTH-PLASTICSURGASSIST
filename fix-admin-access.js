import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateUserRole() {
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Check current user
    const currentUser = await client.query(
      `SELECT id, username, email, role, is_approved, is_active FROM users WHERE email = $1`,
      ['admin@hospital.com']
    );
    
    if (currentUser.rows.length > 0) {
      console.log('Current user details:');
      console.log('  ID:', currentUser.rows[0].id);
      console.log('  Username:', currentUser.rows[0].username);
      console.log('  Email:', currentUser.rows[0].email);
      console.log('  Role:', currentUser.rows[0].role);
      console.log('  Approved:', currentUser.rows[0].is_approved);
      console.log('  Active:', currentUser.rows[0].is_active);
      console.log('');
      
      // Update role to admin
      const result = await client.query(
        `UPDATE users SET role = $1, is_approved = true, is_active = true WHERE email = $2 RETURNING *`,
        ['admin', 'admin@hospital.com']
      );
      
      console.log('✅ User updated successfully!');
      console.log('  New Role:', result.rows[0].role);
      console.log('  Approved:', result.rows[0].is_approved);
      console.log('  Active:', result.rows[0].is_active);
      console.log('\nYou can now access all admin modules!');
    } else {
      console.log('❌ User not found!');
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateUserRole();
