// Resilient Storage Manager
// Tries IndexedDB first, then localStorage, then in-memory fallback.
// Also handles Supabase sync for admin data and completed forms.
class StorageManager {
    constructor() {
        this.dbName = 'BrazelSafetyDB';
        this.version = 3;
        this.db = null;
        this.useCloud = false;
        this.cloudReady = false;
        this.mode = 'indexeddb'; // indexeddb | localstorage | memory
        this.stores = ['jobs', 'hazards', 'safety_topics', 'resources', 'forms', 'settings'];
        this.onlineOnlyMode = false;
        this.memoryStore = { jobs: [], hazards: [], safety_topics: [], resources: [], forms: [], settings: {} };
        this.prefix = 'BrazelSafety';
        this.memory = {
            jobs: [],
            hazards: [],
            safety_topics: [],
            resources: [],
            forms: [],
            settings: {},
            counters: {}
        };
    }

    async init() {
        try {
            await this.initIndexedDB();
        } catch (error) {
            console.warn('⚠️ IndexedDB unavailable:', error?.message || error);
            try {
                this.initLocalStorageFallback();
            } catch (lsError) {
                console.warn('⚠️ localStorage unavailable, using in-memory fallback:', lsError?.message || lsError);
                this.initMemoryFallback();
            }
        }

        await this.initSupabase();
        return true;
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported in this browser'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
            request.onsuccess = () => {
                this.db = request.result;
                this.mode = 'indexeddb';
                console.log('✅ Storage mode: IndexedDB');
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('jobs')) {
                    const s = db.createObjectStore('jobs', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains('hazards')) {
                    const s = db.createObjectStore('hazards', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains('safety_topics')) {
                    const s = db.createObjectStore('safety_topics', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('name', 'name', { unique: false });
                    s.createIndex('sortOrder', 'sortOrder', { unique: false });
                }
                if (!db.objectStoreNames.contains('resources')) {
                    const s = db.createObjectStore('resources', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('name', 'name', { unique: false });
                    s.createIndex('category', 'category', { unique: false });
                }
                if (!db.objectStoreNames.contains('forms')) {
                    const s = db.createObjectStore('forms', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('date', 'date', { unique: false });
                    s.createIndex('jobName', 'jobName', { unique: false });
                    s.createIndex('submitted', 'submitted', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    initOnlineOnlyMode() {
        this.onlineOnlyMode = true;
        this.fallbackMode = false;
        this.db = { onlineOnly: true };
        console.log('☁️ Using ONLINE-ONLY mode (browser storage unavailable)');
    }

    initLocalStorageFallback() {
        const testKey = `${this.prefix}:test`;
        localStorage.setItem(testKey, 'ok');
        localStorage.removeItem(testKey);
        this.mode = 'localstorage';
        this.db = { fallback: 'localstorage' };
        console.log('✅ Storage mode: localStorage fallback');

        for (const store of this.stores) {
            const key = this.getStoreKey(store);
            if (localStorage.getItem(key) === null) {
                localStorage.setItem(key, store === 'settings' ? JSON.stringify({}) : JSON.stringify([]));
            }
            if (store !== 'settings' && localStorage.getItem(this.getCounterKey(store)) === null) {
                localStorage.setItem(this.getCounterKey(store), '1');
            }
        }
    }

    initMemoryFallback() {
        this.mode = 'memory';
        this.db = { fallback: 'memory' };
        console.log('✅ Storage mode: in-memory fallback');
    }

    getStoreKey(storeName) {
        return `${this.prefix}:${storeName}`;
    }

    getCounterKey(storeName) {
        return `${this.prefix}:${storeName}:counter`;
    }

    readFallbackStore(storeName) {
        if (this.mode === 'memory') {
            return storeName === 'settings' ? this.memory.settings : this.memory[storeName];
        }
        const raw = localStorage.getItem(this.getStoreKey(storeName));
        if (!raw) return storeName === 'settings' ? {} : [];
        try {
            return JSON.parse(raw);
        } catch {
            return storeName === 'settings' ? {} : [];
        }
    }

    writeFallbackStore(storeName, value) {
        if (this.mode === 'memory') {
            if (storeName === 'settings') this.memory.settings = value;
            else this.memory[storeName] = value;
            return;
        }
        localStorage.setItem(this.getStoreKey(storeName), JSON.stringify(value));
    }

    nextFallbackId(storeName) {
        if (this.mode === 'memory') {
            const current = this.memory.counters[storeName] || 1;
            this.memory.counters[storeName] = current + 1;
            return current;
        }
        const key = this.getCounterKey(storeName);
        const current = parseInt(localStorage.getItem(key) || '1', 10);
        localStorage.setItem(key, String(current + 1));
        return current;
    }

    async initSupabase() {
        try {
            if (typeof initSupabase === 'function') {
                const ok = await initSupabase();
                if (ok) {
                    this.useCloud = true;
                    this.cloudReady = true;
                    console.log('✅ Cloud sync enabled (Supabase)');
                    await this.syncFromCloud();
                } else {
                    console.warn('⚠️ Cloud sync unavailable, using local storage only');
                }
            }
        } catch (error) {
            console.error('❌ Supabase init error:', error);
            console.log('📦 Continuing with local storage only');
        }
    }

    async syncFromCloud() {
        if (!this.cloudReady || !window.db) return;
        try {
            const jobs = await db.getJobs();
            for (const item of jobs) await this.upsertLocal('jobs', item);

            const hazards = await db.getHazards();
            for (const item of hazards) await this.upsertLocal('hazards', item);

            const topics = await db.getSafetyTopics();
            for (const item of topics) await this.upsertLocal('safety_topics', item);

            if (typeof db.getResources === 'function') {
                const resources = await db.getResources();
                for (const item of resources) await this.upsertLocal('resources', item);
            }
        } catch (error) {
            console.error('❌ Cloud sync error:', error);
        }
    }

    async upsertLocal(storeName, data) {
        const existing = await this.get(storeName, data.id);
        if (existing) return this.update(storeName, data);
        return this.addWithId(storeName, data);
    }

async addWithId(storeName, data) {
        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                this.memoryStore.settings[data.key] = data.value;
                return data.key;
            }
            const arr = this.memoryStore[storeName] || [];
            const idx = arr.findIndex(item => String(item.id) == String(data.id));
            if (idx >= 0) arr[idx] = data;
            else arr.push(data);
            this.memoryStore[storeName] = arr;
            return data.id;
        }

        if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                settings[data.key] = data.value;
                this.writeLocalStore('settings', settings);
                return data.key;
            }
            const items = this.readLocalStore(storeName);
            const idx = items.findIndex(item => String(item.id) === String(data.id));
            if (idx >= 0) items[idx] = data;
            else items.push(data);
            this.writeLocalStore(storeName, items);
            return data.id;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(data.id);
            request.onerror = () => reject(request.error);
        });
    }

async add(storeName, data) {
        let localId;

        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                this.memoryStore.settings[data.key] = data.value;
                localId = data.key;
            } else {
                const arr = this.memoryStore[storeName] || [];
                localId = data.id ?? (arr.length ? Math.max(...arr.map(x => Number(x.id)||0)) + 1 : 1);
                arr.push({ ...data, id: localId });
                this.memoryStore[storeName] = arr;
            }
        } else if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                settings[data.key] = data.value;
                this.writeLocalStore('settings', settings);
                localId = data.key;
            } else {
                const items = this.readLocalStore(storeName);
                localId = data.id ?? this.nextLocalId(storeName);
                items.push({ ...data, id: localId });
                this.writeLocalStore(storeName, items);
            }
        } else {
            localId = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.add(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

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
        let result;
        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                this.memoryStore.settings[data.key] = data.value;
                result = data.key;
            } else {
                const arr = this.memoryStore[storeName] || [];
                const idx = arr.findIndex(item => String(item.id) === String(data.id));
                if (idx >= 0) arr[idx] = data;
                else arr.push(data);
                this.memoryStore[storeName] = arr;
                result = data.id;
            }
        } else if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                settings[data.key] = data.value;
                this.writeLocalStore('settings', settings);
                result = data.key;
            } else {
                const items = this.readLocalStore(storeName);
                const idx = items.findIndex(item => String(item.id) === String(data.id));
                if (idx >= 0) items[idx] = data;
                else items.push(data);
                this.writeLocalStore(storeName, items);
                result = data.id;
            }
        } else {
            result = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

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
        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                return this.memoryStore.settings[id] !== undefined ? { key: id, value: this.memoryStore.settings[id] } : undefined;
            }
            const arr = this.memoryStore[storeName] || [];
            return arr.find(item => String(item.id) === String(id));
        }

        if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                return settings[id] !== undefined ? { key: id, value: settings[id] } : undefined;
            }
            const items = this.readLocalStore(storeName);
            return items.find(item => String(item.id) === String(id));
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

async getAll(storeName) {
        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                return Object.entries(this.memoryStore.settings).map(([key, value]) => ({ key, value }));
            }
            return this.memoryStore[storeName] || [];
        }

        if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                return Object.entries(settings).map(([key, value]) => ({ key, value }));
            }
            return this.readLocalStore(storeName);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

async delete(storeName, id) {
        if (this.onlineOnlyMode) {
            if (storeName === 'settings') {
                delete this.memoryStore.settings[id];
            } else {
                this.memoryStore[storeName] = (this.memoryStore[storeName] || []).filter(item => String(item.id) !== String(id));
            }
        } else if (this.fallbackMode) {
            if (storeName === 'settings') {
                const settings = this.readLocalStore('settings');
                delete settings[id];
                this.writeLocalStore('settings', settings);
            } else {
                const items = this.readLocalStore(storeName).filter(item => String(item.id) !== String(id));
                this.writeLocalStore(storeName, items);
            }
        } else {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        if (this.cloudReady && this.isAdminData(storeName)) {
            try {
                await this.deleteFromCloud(storeName, id);
                console.log(`✅ Deleted ${storeName} from cloud`);
            } catch (error) {
                console.warn(`⚠️ Cloud delete failed for ${storeName}:`, error);
            }
        }
    }

    isAdminData(storeName) {
        return ['jobs', 'hazards', 'safety_topics'].includes(storeName);
    }

    async addToCloud(storeName, data) {
        switch (storeName) {
            case 'jobs': return db.addJob(data);
            case 'hazards': return db.addHazard(data);
            case 'safety_topics': return db.addSafetyTopic(data);
            default: throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    async updateInCloud(storeName, data) {
        switch (storeName) {
            case 'jobs': return db.updateJob(data.id, data);
            case 'hazards': return db.updateHazard(data.id, data);
            case 'safety_topics': return db.updateSafetyTopic(data.id, data);
            default: throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    async deleteFromCloud(storeName, id) {
        switch (storeName) {
            case 'jobs': return db.deleteJob(id);
            case 'hazards': return db.deleteHazard(id);
            case 'safety_topics': return db.deleteSafetyTopic(id);
            default: throw new Error(`Cloud sync not supported for ${storeName}`);
        }
    }

    async uploadFormPDF(pdfBlob, filename) {
        if (!this.cloudReady) return null;
        try {
            const result = await db.uploadFile('forms', `pdfs/${filename}`, pdfBlob);
            return result.publicUrl;
        } catch (error) {
            console.error('❌ PDF upload failed:', error);
            return null;
        }
    }

    async uploadFormPhoto(photoBlob, filename) {
        if (!this.cloudReady) return null;
        try {
            const result = await db.uploadFile('forms', `photos/${filename}`, photoBlob);
            return result.publicUrl;
        } catch (error) {
            console.error('❌ Photo upload failed:', error);
            return null;
        }
    }

    async uploadMultiplePhotos(photos, baseName) {
        const urls = [];
        if (!this.cloudReady) return urls;
        let i = 1;
        for (const p of photos) {
            const ext = p.ext || 'jpg';
            const fname = `${baseName}_photo${i}.${ext}`;
            const url = await this.uploadFormPhoto(p.blob, fname);
            if (url) urls.push(url);
            i += 1;
        }
        return urls;
    }

    async getRecentForms(days = 30) {
        // Pull recent forms from cloud first when available so duplicates remain available
        await this.syncRecentFormsFromCloud(Math.min(days, 14));

        const forms = await this.getAll('forms');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return forms
            .filter(form => {
                const d = form.date || form.createdAt || form.created_at || form.submittedAt || form.signatureSavedAt || null;
                return new Date(d || cutoff) >= cutoff;
            })
            .sort((a, b) => new Date(b.date || b.createdAt || b.created_at || b.submittedAt || 0) - new Date(a.date || a.createdAt || a.created_at || a.submittedAt || 0));
    }

    async syncRecentFormsFromCloud(days = 14) {
        if (!this.cloudReady || !window.db || typeof db.getRecentForms !== 'function') {
            return [];
        }
        try {
            const forms = await db.getRecentForms(days);
            for (const form of forms) {
                // Keep all forms locally available, but duplicate workflow can filter by type
                await this.upsertLocal('forms', form);
            }
            return forms;
        } catch (error) {
            console.error('❌ Recent forms cloud sync error:', error);
            return [];
        }
    }


    async getPendingForms() {
        const forms = await this.getAll('forms');
        return forms.filter(form => !form.submitted);
    }

    async cleanOldForms(days = 30) {
        const forms = await this.getAll('forms');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        for (const form of forms) {
            if (new Date(form.date || form.createdAt || form.submittedAt || 0) < cutoff) {
                await this.delete('forms', form.id);
            }
        }
    }

    async getSetting(key, defaultValue = null) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : defaultValue;
    }

    async setSetting(key, value) {
        return this.update('settings', { key, value });
    }

    async initializeDefaultSafetyTopics() {
        const existing = await this.getAll('safety_topics');
        if (existing && existing.length > 0) return;
        const defaults = [
            { name: 'Traffic Control', sortOrder: 1 },
            { name: 'Weather Conditions', sortOrder: 2 },
            { name: 'Working Alone', sortOrder: 3 },
            { name: 'Mobile Equipment', sortOrder: 4 },
            { name: 'Fall Protection', sortOrder: 5 },
            { name: 'PPE Requirements', sortOrder: 6 },
            { name: 'Emergency Procedures', sortOrder: 7 },
            { name: 'Housekeeping', sortOrder: 8 }
        ];
        for (const topic of defaults) {
            await this.add('safety_topics', topic);
        }
    }

    async saveFormToCloud(formData) {
        if (!this.cloudReady || !window.db) {
            return { success: false, error: 'Cloud not ready' };
        }
        try {
            let saved;
            if (typeof db.addFormMapped === 'function') saved = await db.addFormMapped(formData);
            else if (typeof db.addForm === 'function') saved = await db.addForm(formData);
            else throw new Error('No db.addForm method available');
            return { success: true, data: saved };
        } catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }

    async saveForm(formData) {
        if (formData.id) {
            await this.update('forms', formData);
            return formData.id;
        }
        const id = await this.add('forms', formData);
        formData.id = id;
        return id;
    }

    async getJobs() {
        return this.getAll('jobs');
    }
    async getHazards() {
        return this.getAll('hazards');
    }
    async getSafetyTopics() {
        return this.getAll('safety_topics');
    }
    async getResources() {
        return this.getAll('resources');
    }
}

const storage = new StorageManager();
