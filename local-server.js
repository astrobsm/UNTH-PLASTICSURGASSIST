/**
 * Local development server that mounts Vercel serverless function handlers
 * on an Express server. Run with: node local-server.js
 * 
 * Requires: DATABASE_URL and JWT_SECRET in .env.local
 */

import dotenv from 'dotenv';
import { resolve, join, relative, basename, dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local first, then .env as fallback
dotenv.config({ path: resolve(__dirname, '.env.local') });
dotenv.config({ path: resolve(__dirname, '.env') });

import express from 'express';
import { readdirSync, statSync } from 'fs';
const PORT = process.env.PORT || 3005;

const app = express();

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-init-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// --- Adapter: convert Express (req,res) to a Vercel-like (req,res) ---
// Vercel handlers expect req.query, req.body, req.method, req.headers
// Express already populates these, but we need to merge URL query params
function wrapHandler(handler, paramNames = [], isCatchAll = false) {
  return async (req, res) => {
    // Merge route params into req.query (Vercel convention)
    if (paramNames.length > 0) {
      for (const [key, value] of Object.entries(req.params)) {
        // Vercel catch-all [...path] delivers an array of segments
        if (typeof value === 'string' && value.includes('/')) {
          req.query[key] = value.split('/');
        } else {
          req.query[key] = value;
        }
      }
    }
    // For catch-all middleware, Express strips the mount prefix from req.url.
    // Vercel handlers expect the full path, so restore it.
    if (isCatchAll) {
      req.url = req.originalUrl;
    }
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', message: err.message });
      }
    }
  };
}

// --- Discover and mount all API handlers ---
async function mountRoutes() {
  const apiDir = join(__dirname, 'api');

  // Recursively find all .js files in api/ (excluding _lib/)
  function findHandlerFiles(dir, files = []) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === '_lib' || entry === 'node_modules') continue;
        findHandlerFiles(fullPath, files);
      } else if (entry.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const handlerFiles = findHandlerFiles(apiDir);

  // Sort: specific routes first, then catch-all/dynamic routes last
  handlerFiles.sort((a, b) => {
    const aIsCatchAll = basename(a).includes('[...');
    const bIsCatchAll = basename(b).includes('[...');
    const aIsDynamic = basename(a).includes('[') && !aIsCatchAll;
    const bIsDynamic = basename(b).includes('[') && !bIsCatchAll;
    if (aIsCatchAll && !bIsCatchAll) return 1;
    if (!aIsCatchAll && bIsCatchAll) return -1;
    if (aIsDynamic && !bIsDynamic) return 1;
    if (!aIsDynamic && bIsDynamic) return -1;
    return 0;
  });

  for (const filePath of handlerFiles) {
    const relPath = relative(apiDir, filePath).replace(/\\/g, '/');

    // Convert file path to Express route
    let routePath = '/api/' + relPath
      .replace(/\.js$/, '')
      .replace(/\/index$/, '');

    // Handle dynamic segments: [...path] -> catch-all, [id] -> :id
    let isCatchAll = false;
    const paramNames = [];
    routePath = routePath.replace(/\/\[\.\.\.(\w+)\]/g, (_, name) => {
      isCatchAll = true;
      paramNames.push(name);
      return '';  // Remove the catch-all part; we'll mount as middleware prefix
    });
    routePath = routePath.replace(/\[(\w+)\]/g, (_, name) => {
      paramNames.push(name);
      return `:${name}`;
    });

    // If route is just '/api' from api/index.js, keep as /api
    if (routePath === '/api') routePath = '/api';

    try {
      const moduleUrl = pathToFileURL(filePath).href;
      const mod = await import(moduleUrl);
      const handler = mod.default;

      if (typeof handler !== 'function') {
        console.warn(`  ⚠ Skipping ${relPath} (no default export function)`);
        continue;
      }

      // Mount catch-all routes as middleware (matches all sub-paths)
      if (isCatchAll) {
        app.use(routePath, wrapHandler(handler, paramNames, true));
      } else {
        app.all(routePath, wrapHandler(handler, paramNames));
      }
      console.log(`  ✓ ${routePath}${isCatchAll ? '/*' : ''} → ${relPath}`);
    } catch (err) {
      console.warn(`  ✗ Failed to load ${relPath}: ${err.message}`);
    }
  }
}

// --- Start ---
async function start() {
  console.log('\n🔧 Mounting API routes...\n');
  await mountRoutes();

  console.log('\n---');
  app.listen(PORT, () => {
    console.log(`\n🚀 Local API server running at http://localhost:${PORT}`);
    console.log(`   Database: ${process.env.DATABASE_URL ? '✓ configured' : '✗ NOT SET (set DATABASE_URL in .env.local)'}`);
    console.log(`   JWT:      ${process.env.JWT_SECRET ? '✓ configured' : '⚠ using fallback (set JWT_SECRET in .env.local)'}`);
    console.log('');
  });
}

start().catch(err => {
  console.error('❌ Failed to start local server:', err);
  process.exit(1);
});
