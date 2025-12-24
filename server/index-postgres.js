import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_2024';

// CORS configuration - Dynamic origin to support credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL,
      process.env.PRODUCTION_URL
    ].filter(Boolean);
    
    // Allow all origins in development or if origin matches
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In production, be more permissive for PWA support
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

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
    console.log('✅ Connected to PostgreSQL database');
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result.rows[0].version);
    client.release();
    
    // Initialize database
    await initializeDatabase();
    
    // Create default users
    await createDefaultUsers();
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
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
    console.log('✅ Database schema initialized');
    
    // Execute seed data
    const seed = await fs.readFile(seedPath, 'utf8');
    await pool.query(seed);
    console.log('✅ Seed data inserted');
    
  } catch (error) {
    console.error('⚠️  Error initializing database:', error.message);
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
    
    console.log('✅ Default users verified');
  } catch (error) {
    console.error('⚠️  Error creating default users:', error.message);
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

// Single handler supports legacy and new auth routes
const handleLogin = async (req, res) => {
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
};

// Login endpoint aliases for compatibility with older frontend builds
app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);

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
      RETURNING id, email, full_name, role, department, specialization, license_number, phone, is_approved
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

// Register endpoint alias for /api/auth/register
app.post('/api/auth/register', async (req, res) => {
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
      RETURNING id, email, full_name, role, department, specialization, license_number, phone, is_approved
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

// Get current user (alias for /api/auth/me)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
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
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
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

// Update user active status (admin only)
app.patch('/api/users/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { id } = req.params;
    const { is_active } = req.body;
    
    await pool.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [is_active, id]
    );
    
    res.json({ message: 'User active status updated' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users without auth (only if NO approved admin exists)
app.get('/api/users/all', async (req, res) => {
  try {
    // Check if any super_admin exists
    const adminCheck = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'super_admin' AND is_approved = true"
    );
    
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Admin already exists. Use authenticated endpoint.' });
    }
    
    const result = await pool.query(`
      SELECT id, email, full_name, role, department, specialization, 
             license_number, phone, is_approved, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve first admin without auth (only if NO approved admin exists)
app.post('/api/users/:id/approve-direct', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if any super_admin exists
    const adminCheck = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'super_admin' AND is_approved = true"
    );
    
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Admin already exists. Use authenticated endpoint.' });
    }
    
    // Approve and make super admin
    await pool.query(`
      UPDATE users 
      SET is_approved = true, 
          is_active = true, 
          role = 'super_admin',
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [id]);
    
    res.json({ message: 'First admin user approved successfully' });
  } catch (error) {
    console.error('Direct approve error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
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

// Check if AI is configured (public endpoint)
app.get('/api/ai/settings', async (req, res) => {
  try {
    const apiKey = await getAISettings('openai_api_key');
    res.json({ 
      configured: !!apiKey,
      hasOpenAI: !!apiKey 
    });
  } catch (error) {
    console.error('Check AI settings error:', error);
    res.json({ configured: false, hasOpenAI: false });
  }
});

// Get full AI settings (admin only)
app.get('/api/ai/settings/full', authenticateToken, async (req, res) => {
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

// Get single patient by ID
app.get('/api/sync/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM patients WHERE id = $1 AND deleted = false',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get patient error:', error);
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
// CHAT REST API ENDPOINTS
// =====================================================

// Get all chat rooms for current user
app.get('/api/chat/rooms', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cr.id, cr.name, cr.type, cr.patient_id, cr.is_active, cr.last_message_at,
        cr.created_at, cr.updated_at,
        (
          SELECT COUNT(*)::int FROM chat_messages cm 
          LEFT JOIN chat_read_receipts crr ON cm.id = crr.message_id AND crr.user_id = $1
          WHERE cm.room_id = cr.id AND crr.id IS NULL AND cm.sender_id != $1
        ) as unread_count,
        (
          SELECT json_build_object(
            'id', cm.id,
            'content', cm.content,
            'sender_name', u.full_name,
            'created_at', cm.created_at
          )
          FROM chat_messages cm
          JOIN users u ON cm.sender_id = u.id
          WHERE cm.room_id = cr.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT json_agg(json_build_object(
            'id', u.id,
            'name', u.full_name,
            'role', u.role
          ))
          FROM chat_room_participants crp
          JOIN users u ON crp.user_id = u.id
          WHERE crp.room_id = cr.id AND crp.is_active = true
        ) as participants
      FROM chat_rooms cr
      JOIN chat_room_participants crp ON cr.id = crp.room_id
      WHERE crp.user_id = $1 AND crp.is_active = true AND cr.is_active = true
      ORDER BY cr.last_message_at DESC NULLS LAST, cr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new chat room
app.post('/api/chat/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, type, participantIds, patientId } = req.body;

    // Create room
    const roomResult = await pool.query(`
      INSERT INTO chat_rooms (name, type, patient_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, type || 'group', patientId, req.user.id]);

    const room = roomResult.rows[0];

    // Add creator as participant
    await pool.query(`
      INSERT INTO chat_room_participants (room_id, user_id, is_admin)
      VALUES ($1, $2, true)
    `, [room.id, req.user.id]);

    // Add other participants
    if (participantIds && participantIds.length > 0) {
      for (const participantId of participantIds) {
        await pool.query(`
          INSERT INTO chat_room_participants (room_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (room_id, user_id) DO NOTHING
        `, [room.id, participantId]);
      }
    }

    res.status(201).json(room);
  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a chat room
app.get('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is a participant
    const participantCheck = await pool.query(
      'SELECT 1 FROM chat_room_participants WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    let query = `
      SELECT 
        cm.id, cm.room_id, cm.sender_id, cm.content, cm.message_type,
        cm.file_url, cm.file_name, cm.file_size, cm.reply_to,
        cm.is_edited, cm.edited_at, cm.created_at,
        u.full_name as sender_name, u.role as sender_role,
        (
          SELECT json_agg(json_build_object('emoji', cmr.emoji, 'user_id', cmr.user_id))
          FROM chat_message_reactions cmr WHERE cmr.message_id = cm.id
        ) as reactions,
        EXISTS(SELECT 1 FROM chat_read_receipts WHERE message_id = cm.id AND user_id = $2) as is_read
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.room_id = $1 AND cm.is_deleted = false
    `;

    const params = [roomId, req.user.id];

    if (before) {
      query += ` AND cm.created_at < $3`;
      params.push(before);
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message
app.post('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, messageType = 'text', fileUrl, fileName, fileSize, replyTo } = req.body;

    // Verify user is a participant
    const participantCheck = await pool.query(
      'SELECT 1 FROM chat_room_participants WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const result = await pool.query(`
      INSERT INTO chat_messages (room_id, sender_id, content, message_type, file_url, file_name, file_size, reply_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [roomId, req.user.id, content, messageType, fileUrl, fileName, fileSize, replyTo]);

    // Update room's last message timestamp
    await pool.query(
      'UPDATE chat_rooms SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
      [roomId]
    );

    // Get sender info
    const userResult = await pool.query(
      'SELECT full_name, role FROM users WHERE id = $1',
      [req.user.id]
    );

    const message = {
      ...result.rows[0],
      sender_name: userResult.rows[0].full_name,
      sender_role: userResult.rows[0].role
    };

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
app.post('/api/chat/rooms/:roomId/read', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { messageIds } = req.body;

    if (messageIds && messageIds.length > 0) {
      for (const messageId of messageIds) {
        await pool.query(`
          INSERT INTO chat_read_receipts (message_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (message_id, user_id) DO NOTHING
        `, [messageId, req.user.id]);
      }
    }

    // Update last read timestamp for participant
    await pool.query(`
      UPDATE chat_room_participants SET last_read_at = CURRENT_TIMESTAMP
      WHERE room_id = $1 AND user_id = $2
    `, [roomId, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark messages read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add reaction to message
app.post('/api/chat/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    await pool.query(`
      INSERT INTO chat_message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
    `, [messageId, req.user.id, emoji]);

    res.json({ success: true });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove reaction from message
app.delete('/api/chat/messages/:messageId/reactions/:emoji', authenticateToken, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    await pool.query(`
      DELETE FROM chat_message_reactions 
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `, [messageId, req.user.id, emoji]);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search messages
app.get('/api/chat/messages/search', authenticateToken, async (req, res) => {
  try {
    const { q, roomId } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    let query = `
      SELECT 
        cm.id, cm.room_id, cm.content, cm.created_at,
        u.full_name as sender_name,
        cr.name as room_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      JOIN chat_rooms cr ON cm.room_id = cr.id
      JOIN chat_room_participants crp ON cr.id = crp.room_id
      WHERE crp.user_id = $1 
        AND cm.is_deleted = false
        AND cm.content ILIKE $2
    `;
    
    const params = [req.user.id, `%${q}%`];

    if (roomId) {
      query += ` AND cm.room_id = $3`;
      params.push(roomId);
    }

    query += ` ORDER BY cm.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// VIDEO CONFERENCE REST API ENDPOINTS
// =====================================================

// Get active conference rooms
app.get('/api/conference/rooms', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cr.*,
        u.full_name as host_name,
        (SELECT COUNT(*)::int FROM conference_participants cp WHERE cp.room_id = cr.id AND cp.left_at IS NULL) as participant_count
      FROM conference_rooms cr
      JOIN users u ON cr.host_id = u.id
      WHERE cr.is_active = true AND cr.ended_at IS NULL
      ORDER BY cr.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get conference rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a conference room
app.post('/api/conference/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, roomType, maxParticipants, allowScreenShare, allowRecording, allowChat, waitingRoomEnabled } = req.body;

    const result = await pool.query(`
      INSERT INTO conference_rooms (name, room_type, host_id, max_participants, allow_screen_share, allow_recording, allow_chat, waiting_room_enabled, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `, [name, roomType || 'general', req.user.id, maxParticipants || 50, allowScreenShare !== false, allowRecording || false, allowChat !== false, waitingRoomEnabled || false]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create conference room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conference room details
app.get('/api/conference/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await pool.query(`
      SELECT 
        cr.*,
        u.full_name as host_name,
        (
          SELECT json_agg(json_build_object(
            'id', cp.id,
            'user_id', cp.user_id,
            'user_name', pu.full_name,
            'joined_at', cp.joined_at,
            'was_presenter', cp.was_presenter
          ))
          FROM conference_participants cp
          JOIN users pu ON cp.user_id = pu.id
          WHERE cp.room_id = cr.id AND cp.left_at IS NULL
        ) as participants
      FROM conference_rooms cr
      JOIN users u ON cr.host_id = u.id
      WHERE cr.id = $1
    `, [roomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get conference room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End a conference room
app.post('/api/conference/rooms/:roomId/end', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Verify user is host
    const roomCheck = await pool.query(
      'SELECT host_id FROM conference_rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (roomCheck.rows[0].host_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can end the room' });
    }

    // Update all participants left_at
    await pool.query(`
      UPDATE conference_participants 
      SET left_at = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::int
      WHERE room_id = $1 AND left_at IS NULL
    `, [roomId]);

    // End the room
    await pool.query(`
      UPDATE conference_rooms 
      SET ended_at = CURRENT_TIMESTAMP, is_active = false
      WHERE id = $1
    `, [roomId]);

    res.json({ success: true });
  } catch (error) {
    console.error('End conference room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Log participant join
app.post('/api/conference/rooms/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await pool.query(`
      INSERT INTO conference_participants (room_id, user_id)
      VALUES ($1, $2)
      RETURNING *
    `, [roomId, req.user.id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Log join error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Log participant leave
app.post('/api/conference/rooms/:roomId/leave', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    await pool.query(`
      UPDATE conference_participants 
      SET left_at = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::int
      WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
    `, [roomId, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Log leave error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// =====================================================
// WEBSOCKET SERVER FOR VIDEO CONFERENCE & CHAT
// =====================================================

// Create HTTP server
const server = createServer(app);

// WebSocket servers for different purposes
const conferenceWss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });

// Store for active rooms and connections
const conferenceRooms = new Map();
const chatRooms = new Map();
const userConnections = new Map();

// Verify JWT token for WebSocket connections
function verifyWsToken(token) {
  try {
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Handle HTTP upgrade for WebSocket
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  
  if (url.pathname === '/ws/conference') {
    conferenceWss.handleUpgrade(request, socket, head, (ws) => {
      conferenceWss.emit('connection', ws, request);
    });
  } else if (url.pathname === '/ws/chat') {
    chatWss.handleUpgrade(request, socket, head, (ws) => {
      chatWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// =====================================================
// VIDEO CONFERENCE WEBSOCKET HANDLING
// =====================================================

conferenceWss.on('connection', (ws, request) => {
  let userId = null;
  let userName = null;
  let currentRoomId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Verify token on first message
      if (!userId && data.token) {
        const decoded = verifyWsToken(data.token);
        if (decoded) {
          userId = decoded.userId || decoded.id;
          userName = decoded.name;
        }
      }

      switch (data.type) {
        case 'create-room':
          handleCreateRoom(ws, data, userId, userName);
          break;

        case 'join-room':
          handleJoinRoom(ws, data, userId, userName);
          currentRoomId = data.roomId;
          break;

        case 'leave-room':
          handleLeaveRoom(ws, data, userId);
          currentRoomId = null;
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          forwardToParticipant(data);
          break;

        case 'raise-hand':
        case 'lower-hand':
          broadcastToRoom(data.roomId, { ...data, userId, userName });
          break;

        case 'screen-share-started':
        case 'screen-share-stopped':
          broadcastToRoom(data.roomId, { ...data, userId });
          break;
      }
    } catch (error) {
      console.error('Conference WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && userId) {
      handleLeaveRoom(ws, { roomId: currentRoomId }, userId);
    }
  });
});

function handleCreateRoom(ws, data, userId, userName) {
  const room = {
    id: data.roomId,
    name: data.name,
    hostId: userId,
    settings: data.settings,
    participants: new Map(),
    createdAt: new Date(),
  };

  room.participants.set(userId, { ws, userName });
  conferenceRooms.set(data.roomId, room);

  // Persist to database
  persistConferenceRoom(room).catch(err => {
    console.error('Error persisting conference room:', err);
  });

  ws.send(JSON.stringify({
    type: 'room-created',
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      settings: room.settings,
    }
  }));
}

// Persist conference room to database
async function persistConferenceRoom(room) {
  try {
    await pool.query(`
      INSERT INTO conference_rooms (id, name, host_id, max_participants, allow_screen_share, allow_chat, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `, [
      room.id,
      room.name,
      room.hostId,
      room.settings?.maxParticipants || 50,
      room.settings?.allowScreenShare !== false,
      room.settings?.allowChat !== false
    ]);
  } catch (error) {
    console.error('Error persisting conference room:', error);
  }
}


function handleJoinRoom(ws, data, userId, userName) {
  const room = conferenceRooms.get(data.roomId);
  
  if (!room) {
    // Create room if it doesn't exist
    handleCreateRoom(ws, {
      roomId: data.roomId,
      name: 'Conference Room',
      settings: { maxParticipants: 50, allowScreenShare: true, allowChat: true }
    }, userId, userName);
    return;
  }

  // Log participant join to database
  logParticipantJoin(data.roomId, userId).catch(err => {
    console.error('Error logging participant join:', err);
  });

  // Notify existing participants
  room.participants.forEach((participant, participantId) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify({
        type: 'user-joined',
        userId: userId,
        userName: userName || data.userName,
        userRole: data.userRole,
      }));
    }
  });

  // Add to room
  room.participants.set(userId, { ws, userName: userName || data.userName });

  // Send current participants to new user
  const existingParticipants = [];
  room.participants.forEach((p, id) => {
    if (id !== userId) {
      existingParticipants.push({ id, name: p.userName });
    }
  });

  ws.send(JSON.stringify({
    type: 'room-joined',
    participants: existingParticipants,
  }));
}

// Log participant join to database
async function logParticipantJoin(roomId, userId) {
  try {
    await pool.query(`
      INSERT INTO conference_participants (room_id, user_id)
      VALUES ($1, $2)
    `, [roomId, userId]);
  } catch (error) {
    console.error('Error logging participant join:', error);
  }
}

function handleLeaveRoom(ws, data, userId) {
  const room = conferenceRooms.get(data.roomId);
  if (!room) return;

  room.participants.delete(userId);

  // Log participant leave to database
  logParticipantLeave(data.roomId, userId).catch(err => {
    console.error('Error logging participant leave:', err);
  });

  // Notify other participants
  room.participants.forEach((participant) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify({
        type: 'user-left',
        userId: userId,
      }));
    }
  });

  // Clean up empty rooms
  if (room.participants.size === 0) {
    conferenceRooms.delete(data.roomId);
    // Mark room as ended in database
    endConferenceRoom(data.roomId).catch(err => {
      console.error('Error ending conference room:', err);
    });
  }
}

// Log participant leave to database
async function logParticipantLeave(roomId, userId) {
  try {
    await pool.query(`
      UPDATE conference_participants 
      SET left_at = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::int
      WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
    `, [roomId, userId]);
  } catch (error) {
    console.error('Error logging participant leave:', error);
  }
}

// End conference room in database
async function endConferenceRoom(roomId) {
  try {
    await pool.query(`
      UPDATE conference_rooms 
      SET ended_at = CURRENT_TIMESTAMP, is_active = false
      WHERE id = $1
    `, [roomId]);
  } catch (error) {
    console.error('Error ending conference room:', error);
  }
}


function forwardToParticipant(data) {
  const room = conferenceRooms.get(data.roomId);
  if (!room) return;

  const target = room.participants.get(data.targetId);
  if (target && target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(data));
  }
}

function broadcastToRoom(roomId, data) {
  const room = conferenceRooms.get(roomId);
  if (!room) return;

  room.participants.forEach((participant) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify(data));
    }
  });
}

// =====================================================
// CHAT WEBSOCKET HANDLING
// =====================================================

chatWss.on('connection', (ws, request) => {
  let userId = null;
  let userName = null;
  let userRole = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle authentication
      if (data.type === 'auth') {
        const decoded = verifyWsToken(data.token);
        if (decoded) {
          userId = decoded.userId || decoded.id || data.userId;
          userName = decoded.name || data.userName;
          userRole = decoded.role || data.userRole;
          userConnections.set(userId, ws);
          
          ws.send(JSON.stringify({ type: 'authenticated', userId }));
        }
        return;
      }

      switch (data.type) {
        case 'create-room':
          handleCreateChatRoom(ws, data, userId, userName);
          break;

        case 'join-room':
          handleJoinChatRoom(ws, data, userId, userName);
          break;

        case 'leave-room':
          handleLeaveChatRoom(ws, data, userId);
          break;

        case 'message':
          handleChatMessage(ws, data);
          break;

        case 'typing':
          handleTyping(data, userId, userName);
          break;

        case 'read-receipt':
          handleReadReceipt(data);
          break;

        case 'reaction':
        case 'remove-reaction':
          handleReaction(data);
          break;
      }
    } catch (error) {
      console.error('Chat WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      userConnections.delete(userId);
      // Notify presence change
      broadcastPresence(userId, false);
    }
  });
});

function handleCreateChatRoom(ws, data, userId, userName) {
  const room = {
    id: data.room.id,
    name: data.room.name,
    type: data.room.type,
    participants: new Map(),
    messages: [],
    createdAt: new Date(),
  };

  room.participants.set(userId, { ws, userName });
  
  // Persist room to database
  persistChatRoom(room, userId, data.participantIds).catch(err => {
    console.error('Error persisting chat room:', err);
  });
  
  // Add other participants
  if (data.participantIds) {
    data.participantIds.forEach(id => {
      const participantWs = userConnections.get(id);
      if (participantWs) {
        room.participants.set(id, { ws: participantWs, userName: 'Participant' });
        participantWs.send(JSON.stringify({
          type: 'room-update',
          room: { id: room.id, name: room.name, type: room.type }
        }));
      }
    });
  }

  chatRooms.set(room.id, room);

  ws.send(JSON.stringify({
    type: 'room-created',
    room: { id: room.id, name: room.name, type: room.type }
  }));
}

// Persist chat room to database
async function persistChatRoom(room, creatorId, participantIds) {
  try {
    // Create room
    await pool.query(`
      INSERT INTO chat_rooms (id, name, type, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, [room.id, room.name, room.type || 'group', creatorId]);

    // Add creator as participant
    await pool.query(`
      INSERT INTO chat_room_participants (room_id, user_id, is_admin)
      VALUES ($1, $2, true)
      ON CONFLICT (room_id, user_id) DO NOTHING
    `, [room.id, creatorId]);

    // Add other participants
    if (participantIds && participantIds.length > 0) {
      for (const participantId of participantIds) {
        await pool.query(`
          INSERT INTO chat_room_participants (room_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (room_id, user_id) DO NOTHING
        `, [room.id, participantId]);
      }
    }
  } catch (error) {
    console.error('Error persisting chat room:', error);
  }
}


function handleJoinChatRoom(ws, data, userId, userName) {
  let room = chatRooms.get(data.roomId);
  
  if (!room) {
    room = {
      id: data.roomId,
      name: data.roomId,
      type: 'group',
      participants: new Map(),
      messages: [],
      createdAt: new Date(),
    };
    chatRooms.set(data.roomId, room);
  }

  room.participants.set(userId, { ws, userName });
  
  // Add user to room in database if not already a member
  addChatRoomParticipant(data.roomId, userId).catch(err => {
    console.error('Error adding chat room participant:', err);
  });
}

// Add participant to chat room in database
async function addChatRoomParticipant(roomId, userId) {
  try {
    await pool.query(`
      INSERT INTO chat_room_participants (room_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (room_id, user_id) DO UPDATE SET is_active = true
    `, [roomId, userId]);
  } catch (error) {
    // Room might not exist in DB yet (created via WebSocket only)
    console.log('Note: Room participant add skipped - room may not exist in DB');
  }
}


function handleLeaveChatRoom(ws, data, userId) {
  const room = chatRooms.get(data.roomId);
  if (room) {
    room.participants.delete(userId);
    if (room.participants.size === 0) {
      chatRooms.delete(data.roomId);
    }
  }
}

function handleChatMessage(ws, data) {
  const room = chatRooms.get(data.message.roomId);
  if (!room) return;

  // Store message in database
  persistChatMessage(data.message).catch(err => {
    console.error('Error persisting chat message:', err);
  });

  // Broadcast to all participants
  room.participants.forEach((participant) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify({
        type: 'message',
        message: data.message,
      }));
    }
  });
}

// Persist chat message to database
async function persistChatMessage(message) {
  try {
    await pool.query(`
      INSERT INTO chat_messages (id, room_id, sender_id, content, message_type, file_url, file_name, file_size, reply_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      message.id,
      message.roomId,
      message.senderId,
      message.content,
      message.type || 'text',
      message.fileUrl,
      message.fileName,
      message.fileSize,
      message.replyTo
    ]);

    // Update room's last message timestamp
    await pool.query(
      'UPDATE chat_rooms SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1',
      [message.roomId]
    );
  } catch (error) {
    console.error('Error persisting message:', error);
  }
}


function handleTyping(data, userId, userName) {
  const room = chatRooms.get(data.roomId);
  if (!room) return;

  room.participants.forEach((participant, participantId) => {
    if (participantId !== userId && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify({
        type: 'typing',
        roomId: data.roomId,
        userId,
        userName,
        isTyping: data.isTyping,
      }));
    }
  });
}

function handleReadReceipt(data) {
  const room = chatRooms.get(data.roomId);
  if (!room) return;

  // Persist read receipts to database
  if (data.messageIds && data.messageIds.length > 0) {
    persistReadReceipts(data.messageIds, data.userId).catch(err => {
      console.error('Error persisting read receipts:', err);
    });
  }

  room.participants.forEach((participant) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify({
        type: 'read-receipt',
        ...data,
      }));
    }
  });
}

// Persist read receipts to database
async function persistReadReceipts(messageIds, userId) {
  try {
    for (const messageId of messageIds) {
      await pool.query(`
        INSERT INTO chat_read_receipts (message_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (message_id, user_id) DO NOTHING
      `, [messageId, userId]);
    }
  } catch (error) {
    console.error('Error persisting read receipts:', error);
  }
}


function handleReaction(data) {
  const room = chatRooms.get(data.roomId);
  if (!room) return;

  // Persist reaction to database
  if (data.type === 'reaction') {
    persistReaction(data.messageId, data.userId, data.emoji).catch(err => {
      console.error('Error persisting reaction:', err);
    });
  } else if (data.type === 'remove-reaction') {
    removeReaction(data.messageId, data.userId, data.emoji).catch(err => {
      console.error('Error removing reaction:', err);
    });
  }

  room.participants.forEach((participant) => {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify(data));
    }
  });
}

// Persist reaction to database
async function persistReaction(messageId, userId, emoji) {
  try {
    await pool.query(`
      INSERT INTO chat_message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
    `, [messageId, userId, emoji]);
  } catch (error) {
    console.error('Error persisting reaction:', error);
  }
}

// Remove reaction from database
async function removeReaction(messageId, userId, emoji) {
  try {
    await pool.query(`
      DELETE FROM chat_message_reactions 
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `, [messageId, userId, emoji]);
  } catch (error) {
    console.error('Error removing reaction:', error);
  }
}

function broadcastPresence(userId, isOnline) {
  userConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'presence',
        userId,
        isOnline,
      }));
    }
  });
}

// Start server with WebSocket support
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📹 WebSocket endpoints: /ws/conference, /ws/chat`);
  });
});
