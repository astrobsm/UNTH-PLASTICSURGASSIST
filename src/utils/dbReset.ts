// Database Reset Utility for Development
// This file helps reset the IndexedDB database during development

export const resetDatabase = async () => {
  try {
    // Close any existing connections
    if (typeof window !== 'undefined' && window.indexedDB) {
      const deleteRequest = window.indexedDB.deleteDatabase('PlasticSurgeonDB');
      
      return new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          console.log('Database deleted successfully');
          // Reload the page to reinitialize the database
          window.location.reload();
          resolve(true);
        };
        
        deleteRequest.onerror = () => {
          console.error('Failed to delete database');
          reject(false);
        };
        
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked - close all app tabs first');
          reject(false);
        };
      });
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

// Full database recovery - clears database, caches, and service worker
export const fullDatabaseRecovery = async () => {
  try {
    console.log('🔧 Starting full database recovery...');
    
    // 1. Unregister service workers FIRST (they may be holding connections)
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('✅ Service workers unregistered:', registrations.length);
    }
    
    // 2. Clear all caches
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      console.log('✅ Caches cleared:', cacheKeys.length);
    }
    
    // 3. Delete ALL known IndexedDB databases
    if (typeof window !== 'undefined' && window.indexedDB) {
      // Complete list of databases to delete
      const databasesToDelete = [
        'PlasticSurgeonDB',
        'workbox-expiration',
        'workbox-precache-v2',
        'workbox-background-sync',
        'workbox-runtime-cache',
        'firebase-heartbeat-database',
        'firebase-installations-database',
        'firebaseLocalStorageDb',
        'keyval-store' // Used by some Workbox versions
      ];
      
      for (const dbName of databasesToDelete) {
        try {
          await new Promise<void>((resolve) => {
            const req = window.indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => {
              console.log(`✅ Deleted database: ${dbName}`);
              resolve();
            };
            req.onerror = () => resolve();
            req.onblocked = () => {
              console.warn(`⚠️ Database ${dbName} blocked`);
              resolve();
            };
            // Timeout safety
            setTimeout(resolve, 2000);
          });
        } catch (e) {
          console.warn(`Could not delete ${dbName}:`, e);
        }
      }
    }
    
    // 4. Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Storage cleared');
    
    console.log('✅ Full recovery complete. Redirecting...');
    
    // 5. Redirect to force complete reload (use location.href to avoid cache)
    window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now();
    return true;
  } catch (error) {
    console.error('❌ Full recovery failed:', error);
    // If standard recovery fails, redirect to emergency recovery URL
    window.location.href = window.location.origin + '?recover=true';
    throw error;
  }
};

// Emergency recovery via URL - use when nothing else works
export const triggerEmergencyRecovery = () => {
  window.location.href = window.location.origin + '?recover=true';
};

// Add to window for easy access in dev tools
if (typeof window !== 'undefined') {
  (window as any).resetDatabase = resetDatabase;
  (window as any).fullDatabaseRecovery = fullDatabaseRecovery;
}