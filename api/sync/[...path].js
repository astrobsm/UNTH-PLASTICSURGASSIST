// Catch-all handler that delegates to the index.js sync handler
// This enables /api/sync/lab-orders, /api/sync/patients, etc.
import handler from './index.js';

export default handler;
