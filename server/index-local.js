/**
 * Local Development Server with In-Memory Database
 * Use this for testing when no external database is available
 * All data is stored in memory and lost on restart
 */

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'local_dev_secret_key_2024';

// In-memory database
const db = {
  users: [],
  patients: [],
  surgeries: [],
  treatment_plans: [],
  admissions: [],
  lab_orders: [],
  prescriptions: [],
  wound_care: [],
  activities: [],
  ward_rounds: [],
  duties: [],
  rotations: [],
  sync_queue: [],
};

// Initialize default users
async function initializeDefaultUsers() {
  const defaultPassword = await bcrypt.hash('password123', 10);
  
  db.users = [
    {
      id: 1,
      email: 'admin@hospital.com',
      password: defaultPassword,
      name: 'Admin User',
      role: 'admin',
      approved: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      email: 'consultant@hospital.com',
      password: defaultPassword,
      name: 'Dr. Consultant',
      role: 'consultant',
      approved: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      email: 'intern@hospital.com',
      password: defaultPassword,
      name: 'Dr. Intern',
      role: 'intern',
      approved: true,
      created_at: new Date().toISOString(),
    },
  ];

  // Add sample patients
  db.patients = [
    {
      id: 1,
      name: 'John Doe',
      age: 45,
      gender: 'Male',
      phone: '08012345678',
      hospital_number: 'HOSP001',
      diagnosis: 'Burns',
      notes: 'Sample patient for testing',
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Jane Smith',
      age: 32,
      gender: 'Female',
      phone: '08087654321',
      hospital_number: 'HOSP002',
      diagnosis: 'Keloid',
      notes: 'Sample patient for testing',
      created_at: new Date().toISOString(),
    },
  ];

  console.log('✅ Default users and sample data created');
  console.log('   Login credentials:');
  console.log('   - admin@hospital.com / password123 (Admin)');
  console.log('   - consultant@hospital.com / password123 (Consultant)');
  console.log('   - intern@hospital.com / password123 (Intern)');
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'local-memory', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.approved) {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: db.users.length + 1,
      email,
      password: hashedPassword,
      name,
      role: role || 'intern',
      approved: false,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    res.status(201).json({ message: 'Registration successful. Awaiting approval.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Generic CRUD helper
function createCrudRoutes(entityName, tableName) {
  // Get all
  app.get(`/api/${entityName}`, authenticateToken, (req, res) => {
    res.json(db[tableName] || []);
  });

  // Get one
  app.get(`/api/${entityName}/:id`, authenticateToken, (req, res) => {
    const item = (db[tableName] || []).find(i => i.id == req.params.id);
    if (!item) {
      return res.status(404).json({ error: `${entityName} not found` });
    }
    res.json(item);
  });

  // Create
  app.post(`/api/${entityName}`, authenticateToken, (req, res) => {
    const newItem = {
      id: (db[tableName] || []).length + 1,
      ...req.body,
      created_at: new Date().toISOString(),
      created_by: req.user.id,
    };
    db[tableName] = db[tableName] || [];
    db[tableName].push(newItem);
    res.status(201).json(newItem);
  });

  // Update
  app.put(`/api/${entityName}/:id`, authenticateToken, (req, res) => {
    const index = (db[tableName] || []).findIndex(i => i.id == req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: `${entityName} not found` });
    }
    db[tableName][index] = {
      ...db[tableName][index],
      ...req.body,
      updated_at: new Date().toISOString(),
      updated_by: req.user.id,
    };
    res.json(db[tableName][index]);
  });

  // Delete
  app.delete(`/api/${entityName}/:id`, authenticateToken, (req, res) => {
    const index = (db[tableName] || []).findIndex(i => i.id == req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: `${entityName} not found` });
    }
    const deleted = db[tableName].splice(index, 1)[0];
    res.json({ message: 'Deleted successfully', item: deleted });
  });
}

// Register CRUD routes
createCrudRoutes('patients', 'patients');
createCrudRoutes('surgeries', 'surgeries');
createCrudRoutes('treatment-plans', 'treatment_plans');
createCrudRoutes('admissions', 'admissions');
createCrudRoutes('lab-orders', 'lab_orders');
createCrudRoutes('prescriptions', 'prescriptions');
createCrudRoutes('wound-care', 'wound_care');
createCrudRoutes('activities', 'activities');
createCrudRoutes('ward-rounds', 'ward_rounds');
createCrudRoutes('duties', 'duties');
createCrudRoutes('rotations', 'rotations');

// Users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const users = db.users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    approved: u.approved,
    created_at: u.created_at,
  }));
  res.json(users);
});

app.put('/api/users/:id/approve', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const user = db.users.find(u => u.id == req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.approved = true;
  res.json({ message: 'User approved', user: { id: user.id, email: user.email, approved: true } });
});

// Sync endpoint
app.post('/api/sync', authenticateToken, async (req, res) => {
  try {
    const { changes, lastSyncTime } = req.body;
    const results = { synced: [], errors: [] };

    // Process incoming changes
    if (changes && Array.isArray(changes)) {
      for (const change of changes) {
        try {
          const { entityType, action, data } = change;
          const tableName = entityType.replace(/-/g, '_');
          
          if (!db[tableName]) {
            db[tableName] = [];
          }

          if (action === 'create') {
            const newItem = { id: db[tableName].length + 1, ...data, synced: true };
            db[tableName].push(newItem);
            results.synced.push({ ...change, serverId: newItem.id });
          } else if (action === 'update') {
            const index = db[tableName].findIndex(i => i.id == data.id);
            if (index !== -1) {
              db[tableName][index] = { ...db[tableName][index], ...data, synced: true };
              results.synced.push(change);
            }
          } else if (action === 'delete') {
            const index = db[tableName].findIndex(i => i.id == data.id);
            if (index !== -1) {
              db[tableName].splice(index, 1);
              results.synced.push(change);
            }
          }
        } catch (err) {
          results.errors.push({ change, error: err.message });
        }
      }
    }

    res.json({
      success: true,
      syncTime: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// AI Settings (placeholder)
app.get('/api/ai/settings', authenticateToken, (req, res) => {
  res.json({ enabled: false, message: 'AI features not configured in local mode' });
});

// AI Settings without auth for initial load
app.get('/api/ai/settings', (req, res) => {
  res.json({ enabled: false, message: 'AI features not configured in local mode' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
initializeDefaultUsers().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🏥 Plastic Surgeon Assistant - Local Server');
    console.log('============================================');
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log('📦 Mode: In-Memory Database (data lost on restart)');
    console.log('');
    console.log('⚠️  This is for LOCAL TESTING ONLY');
    console.log('   For production, use PostgreSQL with index-postgres.js');
    console.log('');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Try a different port.`);
    }
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
