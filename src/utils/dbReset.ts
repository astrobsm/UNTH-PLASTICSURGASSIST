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
    
    // 1. Clear all caches
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      console.log('✅ Caches cleared:', cacheKeys.length);
    }
    
    // 2. Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('✅ Service workers unregistered:', registrations.length);
    }
    
    // 3. Delete all IndexedDB databases
    if (typeof window !== 'undefined' && window.indexedDB) {
      // Delete main database
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = window.indexedDB.deleteDatabase('PlasticSurgeonDB');
        deleteRequest.onsuccess = () => {
          console.log('✅ PlasticSurgeonDB deleted');
          resolve();
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => {
          console.warn('⚠️ Database deletion blocked - attempting forced close');
          resolve(); // Continue anyway
        };
      });
      
      // Delete workbox caches
      const workboxDbs = ['workbox-expiration', 'workbox-precache-v2'];
      for (const dbName of workboxDbs) {
        try {
          await new Promise<void>((resolve) => {
            const req = window.indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        } catch (e) {
          // Ignore errors for workbox dbs
        }
      }
    }
    
    // 4. Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Storage cleared');
    
    console.log('✅ Full recovery complete. Reloading...');
    
    // 5. Reload the page
    window.location.reload();
    return true;
  } catch (error) {
    console.error('❌ Full recovery failed:', error);
    throw error;
  }
};

// Add to window for easy access in dev tools
if (typeof window !== 'undefined') {
  (window as any).resetDatabase = resetDatabase;
  (window as any).fullDatabaseRecovery = fullDatabaseRecovery;
}