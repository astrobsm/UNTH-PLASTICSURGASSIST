import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_2024';

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PostgreSQL connection pool
let pool;

async function connectDB() {
  try {
    // Parse DATABASE_URL or use individual env vars
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    // Test connection
    const client = await pool.connect();
    console.log('Γ£à Connected to PostgreSQL database');
    const result = await client.query('SELECT version()');
    console.log('≡ƒôè PostgreSQL version:', result.rows[0].version);
    client.release();
    
    // Initialize database
    await initializeDatabase();
    
    // Create default users
    await createDefaultUsers();
    
  } catch (error) {
    console.error('Γ¥î Database connection error:', error);
    process.exit(1);
  }
}

// Initialize database with schema
async function initializeDatabase() {
  try {
    const schemaPath = join(__dirname, 'db', 'schema.sql');
    const seedPath = join(__dirname, 'db', 'seed.sql');
    
    // Execute schema
    const schema = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Γ£à Database schema initialized');
    
    // Execute seed data
    const seed = await fs.readFile(seedPath, 'utf8');
    await pool.query(seed);
    console.log('Γ£à Seed data inserted');
    
  } catch (error) {
    console.error('ΓÜá∩╕Å  Error initializing database:', error.message);
    // Don't exit - database might already be initialized
  }
}

// Create default users
async function createDefaultUsers() {
  try {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    // Create admin user
    await pool.query(`
      INSERT INTO users (id, email, password, full_name, role, department, is_approved, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, ['admin-001', 'admin@unth.edu.ng', hashedPassword, 'System Administrator', 'super_admin', 'Administration', true, true]);
    
    // Create sample consultant
    const consultantPassword = await bcrypt.hash('Doctor@123', 10);
    await pool.query(`
      INSERT INTO users (id, email, password, full_name, role, department, specialization, is_approved, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, ['doctor-001', 'doctor@unth.edu.ng', consultantPassword, 'Dr. Okwesili', 'consultant', 'Plastic Surgery', 'Reconstructive Surgery', true, true]);
    
    console.log('Γ£à Default users verified');
  } catch (error) {
    console.error('ΓÜá∩╕Å  Error creating default users:', error.message);
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    if (!user.is_approved) {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Remove password from response
    delete user.password;
    
    res.json({ 
      token, 
      user,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, full_name, role, department, specialization, license_number, phone } = req.body;
    
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(`
      INSERT INTO users (email, password, full_name, role, department, specialization, license_number, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, full_name, role, department, is_approved, is_active, created_at
    `, [email.toLowerCase(), hashedPassword, full_name, role, department, specialization, license_number, phone]);
    
    res.status(201).json({ 
      user: result.rows[0],
      message: 'Registration successful. Please wait for admin approval.'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, department, specialization, license_number, phone, is_approved, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// USER MANAGEMENT ROUTES
// =====================================================

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && req.user.role !== 'consultant') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT id, email, full_name, role, department, specialization, 
             license_number, phone, is_approved, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve user (admin only)
app.patch('/api/users/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { id } = req.params;
    const { is_approved } = req.body;
    
    await pool.query(
      'UPDATE users SET is_approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [is_approved, id]
    );
    
    res.json({ message: 'User approval status updated' });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// AI SETTINGS ROUTES
// =====================================================

// Get AI setting
async function getAISettings(key) {
  try {
    const result = await pool.query(
      'SELECT setting_value FROM ai_settings WHERE setting_key = $1',
      [key]
    );
    return result.rows.length > 0 ? result.rows[0].setting_value : null;
  } catch (error) {
    console.error('Get AI settings error:', error);
    return null;
  }
}

// Save AI settings (admin only)
app.post('/api/ai/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { openai_api_key } = req.body;
    
    await pool.query(`
      INSERT INTO ai_settings (setting_key, setting_value, is_encrypted, updated_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (setting_key) 
      DO UPDATE SET setting_value = $2, updated_by = $4, updated_at = CURRENT_TIMESTAMP
    `, ['openai_api_key', openai_api_key, true, req.user.id]);
    
    res.json({ message: 'AI settings saved successfully' });
  } catch (error) {
    console.error('Save AI settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI settings (admin only)
app.get('/api/ai/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query('SELECT setting_key, setting_value FROM ai_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Chat Proxy Endpoint
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const apiKey = await getAISettings('openai_api_key');
    
    if (!apiKey) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: req.body.model || 'gpt-4',
        messages: req.body.messages,
        max_tokens: parseInt(req.body.max_tokens || 2000),
        temperature: parseFloat(req.body.temperature || 0.7)
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return res.status(response.status).json({ error: error.error?.message || 'OpenAI API error' });
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// SYNC ENDPOINTS - PATIENTS
// =====================================================

// Get all patients
app.get('/api/sync/patients', authenticateToken, async (req, res) => {
  try {
    const { since } = req.query;
    let query = 'SELECT * FROM patients WHERE deleted = false';
    const params = [];
    
    if (since) {
      query += ' AND updated_at > $1';
      params.push(since);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const result = await pool.query(query, params);
    res.json({ patients: result.rows });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create patient
app.post('/api/sync/patients', authenticateToken, async (req, res) => {
  try {
    const patient = req.body;
    
    const result = await pool.query(`
      INSERT INTO patients (
        id, hospital_number, first_name, last_name, other_names, date_of_birth, gender,
        phone, email, address, city, state, country,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        blood_group, genotype, allergies, chronic_conditions, current_medications,
        created_by, synced
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, true
      )
      ON CONFLICT (id) DO UPDATE SET
        hospital_number = EXCLUDED.hospital_number,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        other_names = EXCLUDED.other_names,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        emergency_contact_relationship = EXCLUDED.emergency_contact_relationship,
        blood_group = EXCLUDED.blood_group,
        genotype = EXCLUDED.genotype,
        allergies = EXCLUDED.allergies,
        chronic_conditions = EXCLUDED.chronic_conditions,
        current_medications = EXCLUDED.current_medications,
        updated_by = $22,
        synced = true
      RETURNING *
    `, [
      patient.id, patient.hospital_number, patient.first_name, patient.last_name,
      patient.other_names, patient.date_of_birth, patient.gender,
      patient.phone, patient.email, patient.address, patient.city, patient.state, patient.country,
      patient.emergency_contact_name, patient.emergency_contact_phone, patient.emergency_contact_relationship,
      patient.blood_group, patient.genotype, patient.allergies, patient.chronic_conditions,
      patient.current_medications, req.user.id
    ]);
    
    res.status(201).json({ patient: result.rows[0] });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update patient
app.put('/api/sync/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = req.body;
    
    const result = await pool.query(`
      UPDATE patients SET
        hospital_number = $1, first_name = $2, last_name = $3, other_names = $4,
        date_of_birth = $5, gender = $6, phone = $7, email = $8,
        address = $9, city = $10, state = $11, country = $12,
        emergency_contact_name = $13, emergency_contact_phone = $14,
        emergency_contact_relationship = $15, blood_group = $16, genotype = $17,
        allergies = $18, chronic_conditions = $19, current_medications = $20,
        updated_by = $21, synced = true
      WHERE id = $22 AND deleted = false
      RETURNING *
    `, [
      patient.hospital_number, patient.first_name, patient.last_name, patient.other_names,
      patient.date_of_birth, patient.gender, patient.phone, patient.email,
      patient.address, patient.city, patient.state, patient.country,
      patient.emergency_contact_name, patient.emergency_contact_phone,
      patient.emergency_contact_relationship, patient.blood_group, patient.genotype,
      patient.allergies, patient.chronic_conditions, patient.current_medications,
      req.user.id, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json({ patient: result.rows[0] });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete patient (soft delete)
app.delete('/api/sync/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE patients SET deleted = true, updated_by = $1 WHERE id = $2',
      [req.user.id, id]
    );
    
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Continue with more sync endpoints in next part...
// (Treatment plans, labs, surgeries, prescriptions, etc.)

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// =====================================================
// SERVE STATIC FRONTEND FILES
// =====================================================

// Serve static files from the dist directory
app.use(express.static(join(__dirname, '../dist')));

// Handle client-side routing - send all non-API requests to index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`≡ƒÜÇ Backend server running on port ${PORT}`);
    console.log(`≡ƒôì http://localhost:${PORT}`);
  });
});
