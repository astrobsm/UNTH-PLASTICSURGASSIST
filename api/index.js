// API index - lists all available endpoints
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    name: 'Plastic Surgeon Assistant API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        path: '/api/health',
        methods: ['GET'],
        description: 'Health check endpoint'
      },
      auth: {
        path: '/api/auth',
        methods: ['POST'],
        description: 'Authentication (login)',
        subpaths: {
          '/register': 'Register new user',
          '/verify': 'Verify token',
          '/me': 'Get current user'
        }
      },
      patients: {
        path: '/api/patients',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Patient management'
      },
      users: {
        path: '/api/users',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'User management (admin only)'
      },
      surgeries: {
        path: '/api/surgeries',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Surgery booking and management'
      },
      treatmentPlans: {
        path: '/api/treatment-plans',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Treatment plan management'
      },
      admissions: {
        path: '/api/admissions',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Patient admissions and discharges'
      },
      labOrders: {
        path: '/api/lab-orders',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Laboratory order management'
      },
      prescriptions: {
        path: '/api/prescriptions',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Prescription management'
      },
      woundCare: {
        path: '/api/wound-care',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Wound care documentation'
      },
      sync: {
        path: '/api/sync',
        methods: ['GET', 'POST'],
        description: 'Offline data synchronization'
      },
      initDb: {
        path: '/api/init-db',
        methods: ['POST'],
        description: 'Initialize database (requires secret)'
      }
    },
    documentation: 'See VERCEL_DEPLOYMENT_GUIDE.md for full documentation'
  });
}
