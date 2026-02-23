// IndexedDB Storage Manager with Supabase Cloud Sync
class StorageManager {
    constructor() {
        this.dbName = 'BrazelSafetyDB';
        this.version = 2; // Updated to version 2 for safety topics
        this.db = null;
        this.useCloud = false;
        this.cloudReady = false;
    }

    async init() {
        // Initialize IndexedDB first (always needed for offline)
        await this.initIndexedDB();
        
        // Try to initialize Supabase for cloud sync
        await this.initSupabase();
        
        return this.db;
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                const error = new Error('IndexedDB is not supported in this browser');
                console.error('❌', error.message);
                reject(error);
                return;
            }

            console.log('Opening IndexedDB:', this.dbName, 'version:', this.version);
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ IndexedDB open error:', request.error);
                console.error('Error details:', request.error?.message);
                
                // Check if it's a blocked error (common in Safari private mode or strict privacy)
                if (request.error && (
                    request.error.message?.includes('blocked') ||
                    request.error.message?.includes('denied') ||
                    request.error.name === 'QuotaExceededError' ||
                    request.error.name === 'UnknownError'
                )) {
                    console.error('⚠️ IndexedDB appears to be blocked by browser settings');
                    console.error('Try: 1) Disable private browsing, 2) Check browser privacy settings, 3) Use Chrome');
                }
                
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('📦 Upgrading IndexedDB schema...');
                const db = event.target.result;

                // Jobs store
                if (!db.objectStoreNames.contains('jobs')) {
                    console.log('Creating jobs store...');
                    const jobStore = db.createObjectStore('jobs', { keyPath: 'id', autoIncrement: true });
                    jobStore.createIndex('name', 'name', { unique: false });
                }

                // Hazards store
                if (!db.objectStoreNames.contains('hazards')) {
                    console.log('Creating hazards store...');
                    const hazardStore = db.createObjectStore('hazards', { keyPath: 'id', autoIncrement: true });
                    hazardStore.createIndex('name', 'name', { unique: false });
                }

                // Safety Topics store
                if (!db.objectStoreNames.contains('safety_topics')) {
                    console.log('Creating safety topics store...');
                    const topicStore = db.createObjectStore('safety_topics', { keyPath: 'id', autoIncrement: true });
                    topicStore.createIndex('name', 'name', { unique: false });
                    topicStore.createIndex('sortOrder', 'sortOrder', { unique: false });
                }

                // Resources store (metadata for PDF/library docs)
                if (!db.objectStoreNames.contains('resources')) {
                    console.log('Creating resources store...');
                    const resStore = db.createObjectStore('resources', { keyPath: 'id', autoIncrement: true });
                    resStore.createIndex('name', 'name', { unique: false });
                    resStore.createIndex('category', 'category', { unique: false });
                }

                // Forms store
                if (!db.objectStoreNames.contains('forms')) {
                    console.log('Creating forms store...');
                    const formStore = db.createObjectStore('forms', { keyPath: 'id', autoIncrement: true });
                    formStore.createIndex('date', 'date', { unique: false });
                    formStore.createIndex('jobName', 'jobName', { unique: false });
                    formStore.createIndex('submitted', 'submitted', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    console.log('Creating settings store...');
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                console.log('✅ IndexedDB schema created');
            };
        });
    }

    async initSupabase() {
        try {
            if (typeof initSupabase === 'function') {
                console.log('🔄 Initializing Supabase cloud sync...');
                const success = await initSupabase();
                if (success) {
                    this.useCloud = true;
                    this.cloudReady = true;
                    console.log('✅ Cloud sync enabled (Supabase)');
                    
                    // Sync from cloud on startup
                    await this.syncFromCloud();
                } else {
                    console.warn('⚠️ Cloud sync not available, using local storage only');
                }
            } else {
                console.log('📦 Running in local-only mode (no Supabase)');
            }
        } catch (error) {
            console.error('❌ Supabase init error:', error);
            console.log('📦 Continuing with local storage only');
        }
    }

    async syncFromCloud() {
        if (!this.cloudReady) return;
        
        try {
            console.log('🔄 Syncing admin data from cloud...');
            
            // Sync jobs
            const cloudJobs = await db.getJobs();
            for (const job of cloudJobs) {
                await this.upsertLocal('jobs', job);
            }
            
            // Sync hazards
            const cloudHazards = await db.getHazards();
            for (const hazard of cloudHazards) {
                await this.upsertLocal('hazards', hazard);
            }
            
            // Sync safety topics
            const cloudTopics = await db.getSafetyTopics();
            for (const topic of cloudTopics) {
                await this.upsertLocal('safety_topics', topic);
            }

            // Sync resources
            try {
                const cloudResources = await db.getResources();
                for (const res of cloudResources) {
                    await this.upsertLocal('resources', res);
                }
            } catch (e) {
                console.warn('⚠️ Resource sync skipped:', e?.message || e);
            }
            
            console.log('✅ Cloud sync complete');
        } catch (error) {
            console.error('❌ Cloud sync error:', error);
        }
    }

    async upsertLocal(storeName, data) {
        // Insert or update local storage
        try {
            const existing = await this.get(storeName, data.id);
            if (existing) {
                await this.update(storeName, data);
            } else {
                // Use cloud ID
                await this.addWithId(storeName, data);
            }
        } catch (error) {
            console.error(`Error upserting ${storeName}:`, error);
        }
    }

    async addWithId(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data); // Use put instead of add to allow custom ID

            request.onsuccess = () => resolve(data.id);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic CRUD operations with cloud sync
    async add(storeName, data) {
        // Add to local storage first
        const localId = await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // Try to sync to cloud for admin data
        if (this.cloudReady && this.isAdminData(storeName)) {
            try {
                const dataWithId = { ...data, id: localId };
                await this.addToCloud(storeName, dataWithId);
                console.log(`✅ Synced ${storeName} to cloud`);
            } catch (error) {
                console.warn(`⚠️ Cloud sync failed for ${storeName}, saved locally:`, error);
            }
        }
        
        return localId;
    }

    async update(storeName, data) {
        // Update local storage first
        const result = await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // Try to sync to cloud for admin data
        if (this.cloudReady && this.isAdminData(storeName)) {
            try {
                await this.updateInCloud(storeName, data);
                console.log(`✅ Updated ${storeName} in cloud`);
            } catch (error) {
                console.warn(`⚠️ Cloud update failed for ${storeName}:`, error);
            }
        }
        
        return result;
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        // Delete from local storage first
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Try to delete from cloud for admin data
        if (this.cloudReady && this.isAdminData(storeName)) {
            try {
                await this.deleteFromCloud(storeName, id);
                console.log(`✅ Deleted ${storeName} from cloud`);
            } catch (error) {
                console.warn(`⚠️ Cloud delete failed for ${storeName}:`, error);
            }
        }
    }

    // Cloud sync helper methods
    isAdminData(storeName) {
        return ['jobs', 'hazards', 'safety_topics'].includes(storeName);
    }

    async addToCloud(storeName, data) {
        if (!this.cloudReady) return;
        
        switch(storeName) {
            case 'jobs':
                return await db.addJob(data);
            case 'hazards':
                return await db.addHazard(data);
            case 'safety_topics':
                return await db.addSafetyTopic(data);
            default:
                throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    async updateInCloud(storeName, data) {
        if (!this.cloudReady) return;
        
        switch(storeName) {
            case 'jobs':
                return await db.updateJob(data.id, data);
            case 'hazards':
                return await db.updateHazard(data.id, data);
            case 'safety_topics':
                return await db.updateSafetyTopic(data.id, data);
            default:
                throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    async deleteFromCloud(storeName, id) {
        if (!this.cloudReady) return;
        
        switch(storeName) {
            case 'jobs':
                return await db.deleteJob(id);
            case 'hazards':
                return await db.deleteHazard(id);
            case 'safety_topics':
                return await db.deleteSafetyTopic(id);
            default:
                throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    // Method to upload PDF to cloud storage
    async uploadFormPDF(pdfBlob, filename) {
        if (!this.cloudReady) {
            console.log('📦 Cloud not available, PDF only saved locally');
            return null;
        }
        
        try {
            console.log('☁️ Uploading PDF to cloud storage:', filename);
            const result = await db.uploadFile('form-photos', `pdfs/${filename}`, pdfBlob);
            console.log('✅ PDF uploaded to cloud:', result.url);
            return result.url;
        } catch (error) {
            console.error('❌ PDF upload failed:', error);
            return null;
        }
    }

    // Specific methods for forms
    async getRecentForms(days = 30) {
        const forms = await this.getAll('forms');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return forms
            .filter(form => new Date(form.date) >= cutoffDate)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async getPendingForms() {
        const forms = await this.getAll('forms');
        return forms.filter(form => !form.submitted);
    }

    async cleanOldForms(days = 30) {
        const forms = await this.getAll('forms');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        for (const form of forms) {
            if (new Date(form.date) < cutoffDate) {
                await this.delete('forms', form.id);
            }
        }
    }

    // Settings methods
    async getSetting(key, defaultValue = null) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : defaultValue;
    }

    async setSetting(key, value) {
        return this.update('settings', { key, value });
    }

    // Initialize default safety topics if none exist
    async initializeDefaultSafetyTopics() {
        const existing = await this.getAll('safety_topics');
        if (existing && existing.length > 0) {
            console.log('Safety topics already initialized');
            return;
        }

        console.log('📋 Initializing default safety topics...');
        const defaultTopics = [
            { name: 'Traffic Control', sortOrder: 1 },
            { name: 'Weather Conditions', sortOrder: 2 },
            { name: 'Working Alone', sortOrder: 3 },
            { name: 'Mobile Equipment', sortOrder: 4 },
            { name: 'Fall Protection', sortOrder: 5 },
            { name: 'PPE Requirements', sortOrder: 6 },
            { name: 'Emergency Procedures', sortOrder: 7 },
            { name: 'Housekeeping', sortOrder: 8 }
        ];

        for (const topic of defaultTopics) {
            await this.add('safety_topics', topic);
        }
        console.log('✅ Default safety topics initialized');
    }


    // Save a completed form to Supabase (best-effort).
    // Requires a 'forms' table. Recommended schema uses jsonb column 'data'.
    async saveFormToCloud(formData) {
        if (!this.cloudReady || !window.db) {
            return { success: false, error: 'Cloud not ready' };
        }
        try {
            let saved;
            if (typeof db.addFormMapped === 'function') {
                saved = await db.addFormMapped(formData);
            } else {
                saved = await db.addForm(formData);
            }
            return { success: true, data: saved };
        } catch (err) {
            return { success: false, error: err?.message || String(err) };
        }
    }
}

// Create global instance
const storage = new StorageManager();
