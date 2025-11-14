import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
let pool;
async function connectDB() {
  try {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');
    connection.release();
    
    // Initialize database tables
    await initializeTables();
    
    // Create default users
    await createDefaultUsers();
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

// Initialize database tables
async function initializeTables() {
  try {
    // Users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'consultant', 'senior_registrar', 'junior_registrar', 'house_officer', 'medical_officer', 'nursing', 'lab', 'pharmacy') NOT NULL,
        department VARCHAR(100),
        specialization VARCHAR(100),
        license_number VARCHAR(50),
        phone VARCHAR(20),
        is_approved BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Users table created/verified');

    // AI Settings table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id VARCHAR(36) PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        is_encrypted BOOLEAN DEFAULT TRUE,
        updated_by VARCHAR(36),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ AI settings table created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

// Create default users
async function createDefaultUsers() {
  try {
    const defaultUsers = [
      {
        id: 'admin-001',
        email: 'admin@unth.edu.ng',
        password: await bcrypt.hash('admin123', 10),
        full_name: 'System Administrator',
        role: 'super_admin',
        department: 'Administration',
        is_approved: true,
        is_active: true
      },
      {
        id: 'doctor-001',
        email: 'doctor@unth.edu.ng',
        password: await bcrypt.hash('doctor123', 10),
        full_name: 'Dr. Sample Consultant',
        role: 'consultant',
        department: 'Plastic Surgery',
        specialization: 'Plastic & Reconstructive Surgery',
        is_approved: true,
        is_active: true
      }
    ];

    for (const user of defaultUsers) {
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [user.email]
      );

      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO users (id, email, password, full_name, role, department, specialization, is_approved, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, user.email, user.password, user.full_name, user.role, user.department, user.specialization || null, user.is_approved, user.is_active]
        );
        console.log(`✅ Created default user: ${user.email}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
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
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_approved) {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
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

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        specialization: user.specialization
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, full_name, role, department, specialization FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [users] = await pool.execute(
      'SELECT id, email, full_name, role, department, specialization, is_approved, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, role, department, specialization, license_number, phone } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userId = `user-${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO users (id, email, password, full_name, role, department, specialization, license_number, phone, is_approved, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE)`,
      [userId, email, hashedPassword, full_name, role, department, specialization, license_number, phone]
    );

    res.status(201).json({ 
      message: 'Registration successful. Awaiting admin approval.',
      userId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve user (admin only)
app.put('/api/users/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.execute(
      'UPDATE users SET is_approved = TRUE WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Settings endpoints
app.get('/api/ai/settings', authenticateToken, async (req, res) => {
  try {
    // Only super_admin can view AI settings
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [settings] = await pool.execute(
      'SELECT setting_key, setting_value, updated_at FROM ai_settings'
    );

    res.json({ settings });
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/ai/settings', authenticateToken, async (req, res) => {
  try {
    // Only super_admin can update AI settings
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { setting_key, setting_value } = req.body;

    if (!setting_key || !setting_value) {
      return res.status(400).json({ error: 'Setting key and value required' });
    }

    const id = `setting_${Date.now()}`;

    await pool.execute(
      `INSERT INTO ai_settings (id, setting_key, setting_value, updated_by) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       setting_value = VALUES(setting_value),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
      [id, setting_key, setting_value, req.user.id]
    );

    res.json({ message: 'AI settings updated successfully' });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Proxy endpoint for OpenAI requests
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model = 'gpt-4', max_tokens = 2000 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    // Get OpenAI API key from settings
    const [settings] = await pool.execute(
      'SELECT setting_value FROM ai_settings WHERE setting_key = ?',
      ['openai_api_key']
    );

    if (!settings || settings.length === 0 || !settings[0].setting_value) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const apiKey = settings[0].setting_value;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return res.status(response.status).json({ error: 'AI service error' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  if (db) await db.end();
  process.exit(0);
});
