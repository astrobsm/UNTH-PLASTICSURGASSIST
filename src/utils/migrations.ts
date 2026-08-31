import { db } from '../db/database';
import Dexie from 'dexie';
import { logger } from './logger';

export interface Migration {
  version: number;
  description: string;
  up: (db: Dexie) => Promise<void>;
  down: (db: Dexie) => Promise<void>;
}

// Migration registry
const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: async (_db: Dexie) => {
      logger.log('Migration 1: Initial schema already created');
    },
    down: async (_db: Dexie) => {
      logger.log('Migration 1: Cannot rollback initial schema');
    }
  },
  {
    version: 2,
    description: 'Add audit_logs table',
    up: async (_db: Dexie) => {
      logger.log('Migration 2: Audit logs table already exists in v18');
    },
    down: async (_db: Dexie) => {
      logger.log('Migration 2: Cannot remove audit_logs');
    }
  },
  // Future migrations go here
  // Example:
  // {
  //   version: 3,
  //   description: 'Add consultation_notes table',
  //   up: async (db: Dexie) => {
  //     await db.version(19).stores({
  //       consultation_notes: '++id, patient_id, date, doctor_id, [patient_id+date]'
  //     });
  //   },
  //   down: async (db: Dexie) => {
  //     // Rollback logic
  //   }
  // }
];

/**
 * Get current database version
 */
export function getCurrentVersion(): number {
  return db.verno;
}

/**
 * Get target version (latest migration)
 */
export function getTargetVersion(): number {
  return migrations.length > 0 ? migrations[migrations.length - 1].version : 0;
}

/**
 * Get all available migrations
 */
export function getMigrations(): Migration[] {
  return migrations;
}

/**
 * Get pending migrations
 */
export function getPendingMigrations(): Migration[] {
  const currentVersion = getCurrentVersion();
  return migrations.filter(m => m.version > currentVersion);
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(): Promise<void> {
  const pending = getPendingMigrations();
  
  if (pending.length === 0) {
    logger.log('✅ Database schema is up to date');
    return;
  }

  logger.log(`📊 Running ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    try {
      logger.log(`⏳ Running migration ${migration.version}: ${migration.description}`);
      await migration.up(db);
      logger.log(`✅ Migration ${migration.version} completed`);
    } catch (error) {
      logger.log(`❌ Migration ${migration.version} failed:`, error);
      throw new Error(`Migration ${migration.version} failed: ${error}`);
    }
  }

  logger.log('✅ All migrations completed successfully');
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(targetVersion: number): Promise<void> {
  const currentVersion = getCurrentVersion();
  
  if (targetVersion >= currentVersion) {
    throw new Error('Target version must be less than current version');
  }

  const migrationsToRollback = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .reverse(); // Run in reverse order

  logger.log(`⏪ Rolling back ${migrationsToRollback.length} migration(s)...`);

  for (const migration of migrationsToRollback) {
    try {
      logger.log(`⏳ Rolling back migration ${migration.version}: ${migration.description}`);
      await migration.down(db);
      logger.log(`✅ Rollback ${migration.version} completed`);
    } catch (error) {
      logger.log(`❌ Rollback ${migration.version} failed:`, error);
      throw new Error(`Rollback ${migration.version} failed: ${error}`);
    }
  }

  logger.log('✅ Rollback completed successfully');
}

/**
 * Get migration status information
 */
export function getMigrationStatus(): {
  current: number;
  target: number;
  pending: number;
  upToDate: boolean;
} {
  const current = getCurrentVersion();
  const target = getTargetVersion();
  const pending = getPendingMigrations().length;

  return {
    current,
    target,
    pending,
    upToDate: pending === 0
  };
}

/**
 * Initialize migrations on app startup
 */
export async function initializeMigrations(): Promise<void> {
  try {
    const status = getMigrationStatus();
    logger.log('📊 Database migration status:', status);

    if (!status.upToDate) {
      await runPendingMigrations();
    }
  } catch (error) {
    logger.log('❌ Migration initialization failed:', error);
    throw error;
  }
}

// Export for use in App.tsx
export default {
  getCurrentVersion,
  getTargetVersion,
  getMigrations,
  getPendingMigrations,
  runPendingMigrations,
  rollbackToVersion,
  getMigrationStatus,
  initializeMigrations
};
