// Main App Controller
class App {
    constructor() {
        this.isOnline = navigator.onLine;
    }

    async init() {
        try {
            console.log('🚀 Starting app initialization...');
            
            // Show loading screen
            document.getElementById('loading-screen').style.display = 'flex';
            
            // Wait for external libraries to load
            console.log('⏳ Waiting for external libraries...');
            await this.waitForLibraries();
            console.log('✅ External libraries loaded');
            
            // Initialize IndexedDB
            console.log('⏳ Initializing storage...');
            await storage.init();
            console.log('✅ Storage initialized');
            
            // Initialize default safety topics if needed
            console.log('⏳ Initializing safety topics...');
            await storage.initializeDefaultSafetyTopics();
            console.log('✅ Safety topics initialized');
            
            // Load logo
            console.log('⏳ Loading logo...');
            await this.loadLogo();
            console.log('✅ Logo loaded');
            
            // Initialize controllers
            console.log('⏳ Initializing controllers...');
            if (!window.adminController) throw new Error('adminController failed to load');
            await window.adminController.init();
            if (!window.formController) throw new Error('formController failed to load');
            await window.formController.init();
            if (window.incidentController) await window.incidentController.init();
            if (window.inspectionController) await window.inspectionController.init();
            console.log('✅ Controllers initialized');
            await this.initResourcesScreen();
            await this.initSavedFormsScreen();
            
            // Setup connection monitoring
            console.log('⏳ Setting up connection monitoring...');
            this.setupConnectionMonitoring();
            console.log('✅ Connection monitoring active');
            
            // Register service worker for offline support
            console.log('⏳ Registering service worker...');
            await this.registerServiceWorker();
            console.log('✅ Service worker registered');
            
            // Clean old forms (older than 30 days)
            console.log('⏳ Cleaning old forms...');
            await storage.cleanOldForms(30);
            console.log('✅ Old forms cleaned');
            
            // Check for pending forms
            console.log('⏳ Checking pending forms...');
            await this.checkPendingForms();
            console.log('✅ Pending forms checked');
            
            // Hide loading screen and show form screen
            console.log('✅ Hiding loading screen...');
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('form-screen').style.display = 'block';
            
            console.log('🎉 App initialized successfully!');
            
        } catch (error) {
            console.error('❌ App initialization error:', error);
            console.error('Error stack:', error.stack);
            
            // Hide loading screen and show error
            document.getElementById('loading-screen').style.display = 'none';
            
            // Check if Safari private browsing
            let safariPrivateMode = false;
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
            } catch (e) {
                safariPrivateMode = true;
            }
            
            let errorMsg = `Error initializing app.

`;
            errorMsg += `All browser storage modes were blocked in this browser.
`;
            errorMsg += `Please try these steps:
`;
            errorMsg += `1. Open the site in a regular (non-private) browser tab
`;
            errorMsg += `2. Close and reopen the browser
`;
            errorMsg += `3. Try Chrome or Edge if available
`;
            errorMsg += `4. Contact Aaron Brazel - (403) 669-2900 if it still fails`;
            alert(errorMsg);
        }
    }

    async waitForLibraries() {
        // Wait for jsPDF and SignaturePad to load from CDN
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const checkLibraries = setInterval(() => {
                attempts++;
                
                const jsPDFLoaded = typeof window.jspdf !== 'undefined';
                const signaturePadLoaded = typeof SignaturePad !== 'undefined';
                
                if (jsPDFLoaded && signaturePadLoaded) {
                    clearInterval(checkLibraries);
                    console.log('✅ Both libraries loaded');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkLibraries);
                    console.warn('⚠️ External libraries timeout, continuing anyway...');
                    console.warn('jsPDF loaded:', jsPDFLoaded);
                    console.warn('SignaturePad loaded:', signaturePadLoaded);
                    resolve(); // Continue anyway
                }
            }, 100);
        });
    }

    async loadLogo() {
        // Load the logo file
        const logoElement = document.getElementById('company-logo');
        
        // Logo is already set in HTML, just convert it to base64 for PDF
        try {
            const response = await fetch('brazel-logo.png');
            if (response.ok) {
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onload = (e) => {
                    pdfGenerator.setLogo(e.target.result);
                };
                reader.readAsDataURL(blob);
                return;
            }
        } catch (e) {
            console.log('Logo loading error:', e);
        }
        
        // Fallback: Create a simple text logo for PDF
        this.createTextLogoForPDF();
    }

    createTextLogoForPDF() {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BRAZEL', canvas.width / 2, canvas.height / 2);
        
        const dataUrl = canvas.toDataURL();
        pdfGenerator.setLogo(dataUrl);
    }

    setupConnectionMonitoring() {
        const updateStatus = () => {
            this.isOnline = navigator.onLine;
            const statusDot = document.getElementById('connection-status');
            const statusText = document.getElementById('connection-text');
            
            if (this.isOnline) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Online';
                this.syncPendingForms();
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Offline';
            }
        };
        
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        
        // Initial status
        updateStatus();
    }

    async checkPendingForms() {
        const pendingForms = await storage.getPendingForms();
        if (pendingForms.length > 0) {
            console.log(`Found ${pendingForms.length} pending forms`);
            // Could show a notification here
        }
    }

    async syncPendingForms() {
        if (!this.isOnline) return;
        
        const pendingForms = await storage.getPendingForms();
        console.log(`Syncing ${pendingForms.length} pending forms`);
        
        for (const form of pendingForms) {
            try {
                // Generate PDF
                const pdfDoc = await pdfGenerator.generateHazardAssessmentPDF(form);
                
                // Try to send
                const result = await emailSender.sendFormEmail(pdfDoc, form);
                
                if (result.success) {
                    // Mark as submitted
                    form.submitted = true;
                    form.submittedAt = new Date().toISOString();
                    await storage.update('forms', form);
                }
            } catch (error) {
                console.error('Error syncing form:', error);
            }
        }
    }

    async registerServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    await reg.unregister();
                }
            }
            if (window.caches && caches.keys) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            console.log('🧹 Old service workers/caches cleared');
        } catch (e) {
            console.warn('SW cleanup warning:', e);
        }
        return true;
    }

    // Install prompt for PWA
    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install button/banner if desired
            console.log('App can be installed');
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('App installed successfully');
            deferredPrompt = null;
        });
    }


    // -----------------------------
    // Resources screen (read-only)
    // -----------------------------
    async initResourcesScreen() {
        const btn = document.getElementById('resources-btn');
        const back = document.getElementById('resources-back');
        const formScreen = document.getElementById('form-screen');
        const resScreen = document.getElementById('resources-screen');

        if (!btn || !back || !formScreen || !resScreen) return;

        btn.addEventListener('click', async () => {
            formScreen.style.display = 'none';
            resScreen.style.display = 'block';
            await this.renderResources();
        });

        back.addEventListener('click', () => {
            resScreen.style.display = 'none';
            formScreen.style.display = 'block';
        });

        const filter = document.getElementById('resources-filter');
        if (filter) {
            filter.addEventListener('change', () => this.renderResources());
        }
    }

    async renderResources() {
        const listEl = document.getElementById('resources-list');
        const filterEl = document.getElementById('resources-filter');
        if (!listEl) return;

        const resources = await storage.getAll('resources');
        const categories = Array.from(new Set(resources.map(r => (r.category || '').trim()).filter(Boolean))).sort();

        if (filterEl && !filterEl.__populated) {
            for (const c of categories) {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                filterEl.appendChild(opt);
            }
            filterEl.__populated = true;
        }

        const selected = filterEl ? (filterEl.value || '') : '';
        const filtered = selected ? resources.filter(r => (r.category || '') === selected) : resources;

        // Sort newest first if uploaded_at exists
        filtered.sort((a,b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));

        listEl.innerHTML = '';
        if (!filtered.length) {
            listEl.innerHTML = '<p class="hint">No resources available.</p>';
            return;
        }

        for (const r of filtered) {
            const item = document.createElement('div');
            item.className = 'resource-item';

            const meta = document.createElement('div');
            meta.className = 'resource-meta';
            meta.innerHTML = `
                <div class="resource-title">${this.escapeHtml(r.name || '')}</div>
                <div class="resource-sub">${this.escapeHtml(r.category || 'Uncategorized')}</div>
            `;

            const actions = document.createElement('div');
            actions.className = 'resource-actions';

            const openBtn = document.createElement('button');
            openBtn.className = 'btn-primary';
            openBtn.textContent = 'Open PDF';
            openBtn.onclick = () => {
                const url = r.fileUrl || r.file_url;
                if (!url) return alert('No file URL available.');
                if (!navigator.onLine) {
                    alert('You appear to be offline. Connect to open this PDF.');
                    return;
                }
                window.open(url, '_blank');
            };

            actions.appendChild(openBtn);
            item.appendChild(meta);
            item.appendChild(actions);
            listEl.appendChild(item);
        }
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    // -----------------------------
    // Saved Forms screen (local forms)
    // -----------------------------
    async initSavedFormsScreen() {
        const btn = document.getElementById('forms-btn');
        const back = document.getElementById('forms-back');
        const formScreen = document.getElementById('form-screen');
        const formsScreen = document.getElementById('forms-screen');

        if (!btn || !back || !formScreen || !formsScreen) return;

        btn.addEventListener('click', async () => {
            formScreen.style.display = 'none';
            // Hide other screens if they exist
            const adminScreen = document.getElementById('admin-screen');
            const resourcesScreen = document.getElementById('resources-screen');
            if (adminScreen) adminScreen.style.display = 'none';
            if (resourcesScreen) resourcesScreen.style.display = 'none';

            formsScreen.style.display = 'block';
            await this.renderSavedForms();
        });

        back.addEventListener('click', () => {
            formsScreen.style.display = 'none';
            formScreen.style.display = 'block';
        });

        document.getElementById('forms-refresh')?.addEventListener('click', () => this.renderSavedForms());
        document.getElementById('forms-filter')?.addEventListener('change', () => this.renderSavedForms());
        document.getElementById('forms-search')?.addEventListener('input', () => this.renderSavedForms());

        document.getElementById('forms-retry-all')?.addEventListener('click', async () => {
            await this.retryPendingForms();
        });
    }

    async getLocalForms() {
        const forms = await storage.getAll('forms');
        // Newest first
        forms.sort((a,b) => (b.submittedAt || b.createdAt || '').localeCompare(a.submittedAt || a.createdAt || ''));
        return forms;
    }

    formSummary(form) {
        const job = form.jobName || form.job || 'Unknown job';
        const date = form.date || '';
        const lead = (form.attendees && form.attendees[0] && form.attendees[0].name) ? form.attendees[0].name : '';
        const status = form.emailSent ? 'Emailed' : 'Pending';
        return { job, date, lead, status };
    }

    async renderSavedForms() {
        const listEl = document.getElementById('forms-list');
        if (!listEl) return;

        const filter = document.getElementById('forms-filter')?.value || 'all';
        const q = (document.getElementById('forms-search')?.value || '').trim().toLowerCase();

        let forms = await this.getLocalForms();

        if (filter === 'pending') {
            forms = forms.filter(f => !f.emailSent);
        } else if (filter === 'emailed') {
            forms = forms.filter(f => !!f.emailSent);
        }

        if (q) {
            forms = forms.filter(f => {
                const s = JSON.stringify({
                    job: f.jobName || '',
                    date: f.date || '',
                    attendees: f.attendees || [],
                    supervisor: f.supervisorName || ''
                }).toLowerCase();
                return s.includes(q);
            });
        }

        listEl.innerHTML = '';
        if (!forms.length) {
            listEl.innerHTML = '<p class="hint">No forms found for this filter/search.</p>';
            return;
        }

        for (const f of forms) {
            const { job, date, lead } = this.formSummary(f);

            const item = document.createElement('div');
            item.className = 'form-item';

            const meta = document.createElement('div');
            meta.className = 'form-meta';

            const badges = [];
            if (f.formType) badges.push(`<span class="badge">${this.escapeHtml(f.formType)}</span>`);
            if (f.emailSent) badges.push('<span class="badge badge-ok">📧 emailed</span>');
            else badges.push('<span class="badge badge-warn">⏳ pending</span>');
            if (f.pdfUrl) badges.push('<span class="badge">☁️ pdf linked</span>');
            if (f.cloudSaved) badges.push('<span class="badge badge-ok">🗄️ saved to cloud</span>');
            else if (f.cloudSaved === false) badges.push('<span class="badge badge-warn">🗄️ not saved</span>');

            meta.innerHTML = `
                <div class="form-title">${this.escapeHtml(job)}</div>
                <div class="form-sub">${badges.join('')} ${this.escapeHtml(date)} ${lead ? ' • ' + this.escapeHtml(lead) : ''}</div>
                ${f.emailError ? `<div class="form-sub">Last email error: ${this.escapeHtml(f.emailError)}</div>` : ''}
                ${f.cloudError ? `<div class="form-sub">Last cloud error: ${this.escapeHtml(f.cloudError)}</div>` : ''}
            `;

            const actions = document.createElement('div');
            actions.className = 'form-actions';

            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn-secondary';
            viewBtn.textContent = 'View PDF';
            viewBtn.onclick = () => {
                if (f.pdfUrl) {
                    if (!navigator.onLine) return alert('You appear to be offline. Connect to open the cloud PDF link.');
                    window.open(f.pdfUrl, '_blank');
                } else {
                    alert('No cloud PDF link saved for this form. You can regenerate and upload by using "Retry Email/Sync".');
                }
            };

            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn-primary';
            retryBtn.textContent = f.emailSent ? 'Resend Email' : 'Retry Email/Sync';
            retryBtn.onclick = async () => {
                await this.retrySingleForm(f);
            };

            actions.appendChild(viewBtn);
            actions.appendChild(retryBtn);

            item.appendChild(meta);
            item.appendChild(actions);
            listEl.appendChild(item);
        }
    }

    async retryPendingForms() {
        const forms = await this.getLocalForms();
        const pending = forms.filter(f => !f.emailSent);
        if (!pending.length) {
            alert('No pending forms to retry.');
            return;
        }

        if (!navigator.onLine) {
            alert('You appear to be offline. Connect to the internet to retry.');
            return;
        }

        let ok = 0, fail = 0;
        for (const f of pending) {
            try {
                await this.retrySingleForm(f, true);
                ok += 1;
            } catch {
                fail += 1;
            }
        }
        await this.renderSavedForms();
        alert(`Retry complete. Success: ${ok}, Failed: ${fail}`);
    }

    async retrySingleForm(form, silent=false) {
        if (!navigator.onLine) {
            if (!silent) alert('You appear to be offline. Connect to retry.');
            return;
        }
        try {
            // Regenerate PDF from stored form data
            const pdfDoc = await pdfGenerator.generateHazardAssessmentPDF(form);

            // Recompute filename (consistent)
            const filename = pdfGenerator.generateFilename(
                form.jobName,
                form.date,
                form.attendees?.[0]?.name || 'Unknown'
            );

            // Attempt upload if cloud available
            if (storage.cloudReady) {
                try {
                    const pdfBlob = pdfDoc.output('blob');
                    const pdfUrl = await storage.uploadFormPDF(pdfBlob, filename);
                    if (pdfUrl) {
                        form.pdfUrl = pdfUrl;
                        form.pdfFilename = filename;
                    }
                } catch (e) {
                    console.warn('PDF upload retry failed:', e);
                }
            }

            // Attempt email send (also downloads PDF again)
            const result = await emailSender.sendFormEmail(pdfDoc, form);

            // Persist updated fields
            form.submitted = true;
            form.submittedAt = form.submittedAt || new Date().toISOString();
            await storage.update('forms', form);

            if (!silent) {
                if (result?.emailFailed || result?.needsManualEmail) {
                    alert('PDF generated. Email was not sent automatically.\n' + (result.message || ''));
                } else {
                    alert('✅ Email sent (and PDF downloaded again).');
                }
            }
            await this.renderSavedForms();
        } catch (err) {
            console.error('Retry failed:', err);
            if (!silent) alert('Retry failed: ' + (err?.message || err));
            throw err;
        }
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    showStorageModeBanner() {
        return;
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.init();
});
