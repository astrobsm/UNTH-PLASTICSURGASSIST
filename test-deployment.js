#!/usr/bin/env node
/**
 * Pre-deployment validation script
 * Tests API endpoints and validates build output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function success(msg) { log(colors.green, '✓', msg); }
function fail(msg) { log(colors.red, '✗', msg); }
function warn(msg) { log(colors.yellow, '⚠', msg); }
function info(msg) { log(colors.blue, 'ℹ', msg); }

let passed = 0;
let failed = 0;
let warnings = 0;

// Test functions
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    success(`${description}: ${filePath}`);
    passed++;
    return true;
  } else {
    fail(`${description}: ${filePath} NOT FOUND`);
    failed++;
    return false;
  }
}

function checkEnvExample() {
  const envExample = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExample)) {
    const content = fs.readFileSync(envExample, 'utf8');
    const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'INIT_SECRET'];
    const missing = requiredVars.filter(v => !content.includes(v));
    
    if (missing.length === 0) {
      success('.env.example contains all required variables');
      passed++;
    } else {
      fail(`.env.example missing: ${missing.join(', ')}`);
      failed++;
    }
  } else {
    fail('.env.example file not found');
    failed++;
  }
}

function checkApiEndpoints() {
  const apiDir = path.join(__dirname, 'api');
  const requiredEndpoints = [
    'index.js',
    'health.js',
    'auth.js',
    'patients.js',
    'users.js',
    'surgeries.js',
    'treatment-plans.js',
    'admissions.js',
    'lab-orders.js',
    'prescriptions.js',
    'wound-care.js',
    'sync.js',
    'init-db.js'
  ];

  requiredEndpoints.forEach(endpoint => {
    const filePath = path.join(apiDir, endpoint);
    if (fs.existsSync(filePath)) {
      success(`API endpoint: /api/${endpoint.replace('.js', '')}`);
      passed++;
    } else {
      fail(`API endpoint missing: /api/${endpoint.replace('.js', '')}`);
      failed++;
    }
  });

  // Check _lib folder
  const libDir = path.join(apiDir, '_lib');
  ['db.js', 'auth.js'].forEach(lib => {
    const filePath = path.join(libDir, lib);
    if (fs.existsSync(filePath)) {
      success(`API lib: _lib/${lib}`);
      passed++;
    } else {
      fail(`API lib missing: _lib/${lib}`);
      failed++;
    }
  });
}

function checkBuildOutput() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    warn('dist/ folder not found - run "npm run build" first');
    warnings++;
    return;
  }

  const requiredFiles = [
    'index.html',
    'sw.js',
    'manifest.webmanifest',
    'registerSW.js'
  ];

  requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(distDir, file))) {
      success(`Build output: dist/${file}`);
      passed++;
    } else {
      fail(`Build output missing: dist/${file}`);
      failed++;
    }
  });

  // Check assets folder
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assets = fs.readdirSync(assetsDir);
    const hasJS = assets.some(f => f.endsWith('.js'));
    const hasCSS = assets.some(f => f.endsWith('.css'));
    
    if (hasJS && hasCSS) {
      success(`Build assets: ${assets.length} files (JS + CSS present)`);
      passed++;
    } else {
      fail('Build assets incomplete');
      failed++;
    }
  }
}

function checkVercelConfig() {
  const vercelJson = path.join(__dirname, 'vercel.json');
  if (fs.existsSync(vercelJson)) {
    try {
      const config = JSON.parse(fs.readFileSync(vercelJson, 'utf8'));
      
      if (config.framework === 'vite') {
        success('Vercel config: framework = vite');
        passed++;
      } else {
        warn('Vercel config: framework should be "vite"');
        warnings++;
      }

      if (config.functions?.['api/**/*.js']) {
        success('Vercel config: API functions configured');
        passed++;
      } else {
        fail('Vercel config: API functions not configured');
        failed++;
      }

      if (config.rewrites?.length >= 2) {
        success('Vercel config: rewrites configured');
        passed++;
      } else {
        warn('Vercel config: check rewrites configuration');
        warnings++;
      }

    } catch (e) {
      fail('Vercel config: invalid JSON');
      failed++;
    }
  } else {
    fail('vercel.json not found');
    failed++;
  }
}

function checkPackageJson() {
  const pkgJson = path.join(__dirname, 'package.json');
  if (fs.existsSync(pkgJson)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    
    // Check required dependencies
    const requiredDeps = ['pg', 'bcryptjs', 'jsonwebtoken'];
    const missingDeps = requiredDeps.filter(d => !pkg.dependencies?.[d]);
    
    if (missingDeps.length === 0) {
      success('Package.json: all backend dependencies present');
      passed++;
    } else {
      fail(`Package.json missing deps: ${missingDeps.join(', ')}`);
      failed++;
    }

    // Check scripts
    if (pkg.scripts?.build && pkg.scripts?.dev) {
      success('Package.json: build and dev scripts present');
      passed++;
    } else {
      fail('Package.json: missing required scripts');
      failed++;
    }

    // Check engines
    if (pkg.engines?.node) {
      success(`Package.json: Node engine specified (${pkg.engines.node})`);
      passed++;
    } else {
      warn('Package.json: Node engine not specified');
      warnings++;
    }
  }
}

function checkDatabaseSchema() {
  const initDb = path.join(__dirname, 'api', 'init-db.js');
  if (fs.existsSync(initDb)) {
    const content = fs.readFileSync(initDb, 'utf8');
    const requiredTables = [
      'users',
      'patients',
      'treatment_plans',
      'surgeries',
      'admissions',
      'lab_orders',
      'prescriptions',
      'wound_care_records'
    ];
    
    const missingTables = requiredTables.filter(t => !content.includes(`CREATE TABLE IF NOT EXISTS ${t}`));
    
    if (missingTables.length === 0) {
      success('Database schema: all required tables defined');
      passed++;
    } else {
      warn(`Database schema: tables may be missing: ${missingTables.join(', ')}`);
      warnings++;
    }
  }
}

// Run all checks
console.log('\n' + '='.repeat(60));
console.log('  PLASTIC SURGEON ASSISTANT - PRE-DEPLOYMENT VALIDATION');
console.log('='.repeat(60) + '\n');

info('Checking project structure...\n');

console.log('📁 Configuration Files:');
checkFile('vercel.json', 'Vercel config');
checkFile('package.json', 'Package config');
checkFile('.env.example', 'Environment template');
checkFile('tsconfig.json', 'TypeScript config');
checkFile('vite.config.ts', 'Vite config');
console.log();

console.log('📦 Environment Variables:');
checkEnvExample();
console.log();

console.log('🔌 API Endpoints:');
checkApiEndpoints();
console.log();

console.log('🏗️  Build Output:');
checkBuildOutput();
console.log();

console.log('⚙️  Vercel Configuration:');
checkVercelConfig();
console.log();

console.log('📋 Package Configuration:');
checkPackageJson();
console.log();

console.log('🗄️  Database Schema:');
checkDatabaseSchema();
console.log();

// Summary
console.log('='.repeat(60));
console.log('  SUMMARY');
console.log('='.repeat(60));
console.log(`  ${colors.green}Passed:${colors.reset}   ${passed}`);
console.log(`  ${colors.red}Failed:${colors.reset}   ${failed}`);
console.log(`  ${colors.yellow}Warnings:${colors.reset} ${warnings}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log(`\n${colors.green}✓ All critical checks passed! Ready for deployment.${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}✗ ${failed} check(s) failed. Please fix before deploying.${colors.reset}\n`);
  process.exit(1);
}
