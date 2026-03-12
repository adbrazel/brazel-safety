// Admin Panel Controller
class AdminController {
    constructor() {
        this.currentEditingJob = null;
        this.currentEditingHazard = null;
        this.currentEditingTopic = null;
        this.adminPassword = 'Hy6%Safety'; // Password changed January 21, 2026
    }

    async init() {
        // Load admin password from settings
        const savedPassword = await storage.getSetting('adminPassword');
        if (savedPassword) {
            this.adminPassword = savedPassword;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Admin button
        document.getElementById('admin-btn')?.addEventListener('click', () => {
            this.showPasswordPrompt();
        });

        document.getElementById('admin-logout')?.addEventListener('click', () => {
            this.hideAdminPanel();
        });

        // Job management
        document.getElementById('add-job-btn')?.addEventListener('click', () => {
            this.showJobModal();
        });

        document.getElementById('cancel-job-btn')?.addEventListener('click', () => {
            this.hideJobModal();
        });

        document.getElementById('job-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveJob();
        });

        // Hazard management
        document.getElementById('add-hazard-btn')?.addEventListener('click', () => {
            this.showHazardModal();
        });

        document.getElementById('cancel-hazard-btn')?.addEventListener('click', () => {
            this.hideHazardModal();
        });

        document.getElementById('hazard-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveHazard();
        });

        // Safety Topics management
        document.getElementById('add-topic-btn')?.addEventListener('click', () => {
            this.showTopicModal();
        });

        document.getElementById('cancel-topic-btn')?.addEventListener('click', () => {
            this.hideTopicModal();
        });

        document.getElementById('topic-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTopic();
        });

        // Password modal
        document.getElementById('cancel-password-btn')?.addEventListener('click', () => {
            this.hidePasswordModal();
        });

        document.getElementById('password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.checkPassword();
        });
    }

    // Password protection
    showPasswordPrompt() {
        const modal = document.getElementById('password-modal');
        modal.classList.add('active');
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-password').focus();
    }

    hidePasswordModal() {
        document.getElementById('password-modal').classList.remove('active');
    }

    checkPassword() {
        const input = document.getElementById('admin-password').value;
        if (input === this.adminPassword) {
            this.hidePasswordModal();
            this.showAdminPanel();
        } else {
            alert('Incorrect password');
            document.getElementById('admin-password').value = '';
        }
    }

    // Admin panel visibility
    async showAdminPanel() {
        document.getElementById('form-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        await this.loadJobs();
        await this.loadHazards();
        await this.loadSafetyTopics();
    }

    hideAdminPanel() {
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('form-screen').style.display = 'block';
    }

    // Job Management
    showJobModal(job = null) {
        this.currentEditingJob = job;
        const modal = document.getElementById('job-modal');
        const title = document.getElementById('job-modal-title');
        
        if (job) {
            title.textContent = 'Edit Job';
            document.getElementById('job-name').value = job.name;
            document.getElementById('job-address-input').value = job.address;
            document.getElementById('job-address2-input').value = job.address2 || '';
            document.getElementById('job-emergency-input').value = job.emergencyPhone;
        } else {
            title.textContent = 'Add New Job';
            document.getElementById('job-form').reset();
        }
        
        modal.classList.add('active');
    }

    hideJobModal() {
        document.getElementById('job-modal').classList.remove('active');
        this.currentEditingJob = null;
    }

    async saveJob() {
        const jobData = {
            name: document.getElementById('job-name').value,
            address: document.getElementById('job-address-input').value,
            address2: document.getElementById('job-address2-input').value,
            emergencyPhone: document.getElementById('job-emergency-input').value
        };

        try {
            if (this.currentEditingJob) {
                // Update existing
                jobData.id = this.currentEditingJob.id;
                await storage.update('jobs', jobData);
            } else {
                // Add new
                await storage.add('jobs', jobData);
            }
            
            this.hideJobModal();
            await this.loadJobs();
            
            // Update job dropdown in form if visible
            if (typeof formController !== 'undefined') {
                await formController.loadJobs();
            }
        } catch (error) {
            console.error('Error saving job:', error);
            alert('Error saving job. Please try again.');
        }
    }

    async loadJobs() {
        const jobs = await storage.getAll('jobs');
        const container = document.getElementById('job-list');
        
        if (!jobs || jobs.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d;">No jobs added yet.</p>';
            return;
        }

        container.innerHTML = jobs.map(job => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${this.escapeHtml(job.name)}</div>
                    <div class="list-item-details">
                        ${this.escapeHtml(job.address)}<br>
                        ${job.address2 ? this.escapeHtml(job.address2) + '<br>' : ''}
                        Emergency: ${this.escapeHtml(job.emergencyPhone)}
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="adminController.showJobModal(${JSON.stringify(job).replace(/"/g, '&quot;')})">✏️</button>
                    <button class="btn-icon delete" onclick="adminController.deleteJob(${job.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    async deleteJob(id) {
        if (confirm('Are you sure you want to delete this job?')) {
            try {
                await storage.delete('jobs', id);
                await this.loadJobs();
                
                // Update job dropdown in form
                if (typeof formController !== 'undefined') {
                    await formController.loadJobs();
                }
            } catch (error) {
                console.error('Error deleting job:', error);
                alert('Error deleting job. Please try again.');
            }
        }
    }

    // Hazard Management
    showHazardModal(hazard = null) {
        this.currentEditingHazard = hazard;
        const modal = document.getElementById('hazard-modal');
        const title = document.getElementById('hazard-modal-title');
        
        if (hazard) {
            title.textContent = 'Edit Hazard';
            document.getElementById('hazard-name').value = hazard.name;
            document.getElementById('hazard-risk').value = hazard.risk;
            document.getElementById('hazard-severity').value = hazard.severity;
            document.getElementById('hazard-controls').value = hazard.suggestedControls || '';
        } else {
            title.textContent = 'Add New Hazard';
            document.getElementById('hazard-form').reset();
        }
        
        modal.classList.add('active');
    }

    hideHazardModal() {
        document.getElementById('hazard-modal').classList.remove('active');
        this.currentEditingHazard = null;
    }

    async saveHazard() {
        const hazardData = {
            name: document.getElementById('hazard-name').value,
            risk: document.getElementById('hazard-risk').value,
            severity: document.getElementById('hazard-severity').value,
            suggestedControls: document.getElementById('hazard-controls').value
        };

        try {
            if (this.currentEditingHazard) {
                // Update existing
                hazardData.id = this.currentEditingHazard.id;
                await storage.update('hazards', hazardData);
            } else {
                // Add new
                await storage.add('hazards', hazardData);
            }
            
            this.hideHazardModal();
            await this.loadHazards();
            
            // Update hazard checklist in form if visible
            if (typeof formController !== 'undefined') {
                await formController.loadHazards();
            }
        } catch (error) {
            console.error('Error saving hazard:', error);
            alert('Error saving hazard. Please try again.');
        }
    }

    async loadHazards() {
        const hazards = await storage.getAll('hazards');
        const container = document.getElementById('hazard-list');
        
        if (!hazards || hazards.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d;">No hazards added yet.</p>';
            return;
        }

        container.innerHTML = hazards.map(hazard => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${this.escapeHtml(hazard.name)}</div>
                    <div class="list-item-details">
                        Risk: <strong>${hazard.risk}</strong> | 
                        Severity: <strong>${hazard.severity}</strong><br>
                        ${hazard.suggestedControls ? 'Controls: ' + this.escapeHtml(hazard.suggestedControls) : 'No suggested controls'}
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="adminController.editHazard(${hazard.id})">✏️</button>
                    <button class="btn-icon delete" onclick="adminController.deleteHazard(${hazard.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    async editHazard(id) {
        const hazard = await storage.get('hazards', id);
        if (hazard) {
            this.showHazardModal(hazard);
        }
    }

    async deleteHazard(id) {
        if (confirm('Are you sure you want to delete this hazard?')) {
            try {
                await storage.delete('hazards', id);
                await this.loadHazards();
                
                // Update hazard checklist in form
                if (typeof formController !== 'undefined') {
                    await formController.loadHazards();
                }
            } catch (error) {
                console.error('Error deleting hazard:', error);
                alert('Error deleting hazard. Please try again.');
            }
        }
    }

    // Safety Topics Management
    showTopicModal(topic = null) {
        this.currentEditingTopic = topic;
        const modal = document.getElementById('topic-modal');
        const title = document.getElementById('topic-modal-title');
        
        if (topic) {
            title.textContent = 'Edit Safety Topic';
            document.getElementById('topic-name').value = topic.name;
        } else {
            title.textContent = 'Add New Safety Topic';
            document.getElementById('topic-form').reset();
        }
        
        modal.classList.add('active');
    }

    hideTopicModal() {
        document.getElementById('topic-modal').classList.remove('active');
        this.currentEditingTopic = null;
    }

    async saveTopic() {
        const topicData = {
            name: document.getElementById('topic-name').value,
            sortOrder: this.currentEditingTopic ? this.currentEditingTopic.sortOrder : 999
        };

        try {
            if (this.currentEditingTopic) {
                // Update existing
                topicData.id = this.currentEditingTopic.id;
                await storage.update('safety_topics', topicData);
            } else {
                // Add new - get max sort order and add 1
                const topics = await storage.getAll('safety_topics');
                const maxOrder = topics.length > 0 ? Math.max(...topics.map(t => t.sortOrder || 0)) : 0;
                topicData.sortOrder = maxOrder + 1;
                await storage.add('safety_topics', topicData);
            }
            
            this.hideTopicModal();
            await this.loadSafetyTopics();
            
            // Update topics in form if visible
            if (typeof formController !== 'undefined') {
                await formController.loadSafetyTopics();
            }
        } catch (error) {
            console.error('Error saving safety topic:', error);
            alert('Error saving safety topic. Please try again.');
        }
    }

    async loadSafetyTopics() {
        const topics = await storage.getAll('safety_topics');
        const container = document.getElementById('topic-list');
        
        if (!topics || topics.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d;">No safety topics added yet.</p>';
            return;
        }

        // Sort by sort order
        topics.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        container.innerHTML = topics.map(topic => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${this.escapeHtml(topic.name)}</div>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="adminController.editTopic(${topic.id})">✏️</button>
                    <button class="btn-icon delete" onclick="adminController.deleteTopic(${topic.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    async editTopic(id) {
        const topic = await storage.get('safety_topics', id);
        if (topic) {
            this.showTopicModal(topic);
        }
    }

    async deleteTopic(id) {
        if (confirm('Are you sure you want to delete this safety topic?')) {
            try {
                await storage.delete('safety_topics', id);
                await this.loadSafetyTopics();
                
                // Update topics in form
                if (typeof formController !== 'undefined') {
                    await formController.loadSafetyTopics();
                }
            } catch (error) {
                console.error('Error deleting safety topic:', error);
                alert('Error deleting safety topic. Please try again.');
            }
        }
    }

    // Utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // -----------------------------
    // Resource Library (PDF uploads)
    // -----------------------------
    async initResourcesAdmin() {
        try {
            const form = document.getElementById('resource-form');
            if (!form) return;

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleResourceUpload();
            });

            await this.renderResourcesAdmin();
        } catch (err) {
            console.error('❌ Resource admin init error:', err);
        }
    }

    async handleResourceUpload() {
        const nameEl = document.getElementById('resource-name');
        const catEl = document.getElementById('resource-category');
        const fileEl = document.getElementById('resource-file');

        const name = (nameEl.value || '').trim();
        const category = (catEl.value || '').trim();
        const file = fileEl.files && fileEl.files[0];

        if (!name || !file) {
            alert('Please provide a document name and choose a PDF.');
            return;
        }

        if (!navigator.onLine || !storage.cloudReady || !window.db) {
            alert('You must be online to upload resources (PDF files).');
            return;
        }

        try {
            const safeName = name.replace(/[^a-z0-9\-_. ]/gi, '').replace(/\s+/g, '_');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const path = `resources/${ts}_${safeName}.pdf`;

            // Upload to Supabase Storage bucket: "resources"
            // NOTE: You must create a Storage bucket named "resources" in Supabase.
            const upload = await db.uploadFile('resources', path, file);

            const record = {
                name,
                category,
                filePath: upload.path,
                fileUrl: upload.publicUrl,
                fileSize: file.size
            };

            const saved = await db.addResource(record);
            await storage.upsertLocal('resources', saved);

            nameEl.value = '';
            catEl.value = '';
            fileEl.value = '';

            await this.renderResourcesAdmin();
            alert('✅ Resource uploaded');
        } catch (err) {
            console.error('❌ Upload failed:', err);
            alert('Upload failed: ' + (err?.message || err));
        }
    }

    async renderResourcesAdmin() {
        const listEl = document.getElementById('resource-admin-list');
        if (!listEl) return;

        const resources = await storage.getAll('resources');
        resources.sort((a,b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));

        listEl.innerHTML = '';
        if (!resources.length) {
            listEl.innerHTML = '<p class="hint">No resources uploaded yet.</p>';
            return;
        }

        for (const r of resources) {
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
            openBtn.className = 'btn-secondary';
            openBtn.textContent = 'Open';
            openBtn.onclick = () => {
                const url = r.fileUrl || r.file_url;
                if (!url) return alert('No file URL available for this resource.');
                window.open(url, '_blank');
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-danger';
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                if (!confirm('Delete this resource?')) return;
                try {
                    if (storage.cloudReady && window.db && r.id) {
                        await db.deleteResource(r.id);
                    }
                    await storage.delete('resources', r.id);
                    await this.renderResourcesAdmin();
                } catch (err) {
                    console.error('❌ Delete failed:', err);
                    alert('Delete failed: ' + (err?.message || err));
                }
            };

            actions.appendChild(openBtn);
            actions.appendChild(delBtn);

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
// Monthly Reporting (Supabase forms)
// -----------------------------
async initReporting() {
    const monthEl = document.getElementById('report-month');
    const refreshBtn = document.getElementById('report-refresh');
    const exportBtn = document.getElementById('report-export');

    if (!monthEl || !refreshBtn || !exportBtn) return;

    // Default to current month
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    monthEl.value = ym;

    refreshBtn.addEventListener('click', async () => {
        await this.refreshReport();
    });

    exportBtn.addEventListener('click', async () => {
        await this.exportReportCsv();
    });

    await this.refreshReport();
}

getReportMonthRange() {
    const monthEl = document.getElementById('report-month');
    const val = (monthEl && monthEl.value) ? monthEl.value : null;
    if (!val) return null;
    const [y, m] = val.split('-').map(Number);
    const start = new Date(Date.UTC(y, m-1, 1, 0,0,0));
    const end = new Date(Date.UTC(y, m, 1, 0,0,0)); // next month
    return { startIso: start.toISOString(), endIso: end.toISOString(), y, m };
}

async fetchFormsForMonth() {
    if (!navigator.onLine || !storage.cloudReady || !window.supabaseClient) {
        throw new Error('Reporting requires internet connection.');
    }
    const range = this.getReportMonthRange();
    if (!range) throw new Error('Select a month.');
    const { data, error } = await supabaseClient
        .from('forms')
        .select('id, created_at, job_name, supervisor_name, pdf_url, email_sent, data')
        .gte('created_at', range.startIso)
        .lt('created_at', range.endIso)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}
    summarizeForms(rows) {
        const formsCount = rows.length;

        let attendeeTotal = 0;
        const uniqueEmployees = new Set();
        const uniqueJobs = new Set();

        const employeeCounts = new Map();   // name -> forms attended
        const jobCounts = new Map();        // job -> forms count
        const hazardCounts = new Map();     // hazard -> count
        const supervisorCounts = new Map(); // supervisor -> { forms, emailed }

        const bump = (map, key, inc=1) => {
            const k = (key || '').toString().trim();
            if (!k) return;
            map.set(k, (map.get(k) || 0) + inc);
        };

        for (const r of rows) {
            const data = r.data || {};

            const job = r.job_name || data.jobName || data.job_name || '';
            if (job) {
                uniqueJobs.add(job);
                bump(jobCounts, job, 1);
            }

            const sup = r.supervisor_name || data.supervisorName || data.supervisor_name || '';
            if (sup) {
                if (!supervisorCounts.has(sup)) supervisorCounts.set(sup, { supervisor: sup, forms: 0, emailed: 0 });
                const obj = supervisorCounts.get(sup);
                obj.forms += 1;
                if (r.email_sent) obj.emailed += 1;
            }

            const attendees = Array.isArray(data.attendees) ? data.attendees : [];
            attendeeTotal += attendees.length;

            for (const a of attendees) {
                const name = (a && a.name) ? String(a.name).trim() : '';
                if (!name) continue;
                uniqueEmployees.add(name.toLowerCase());
                employeeCounts.set(name, (employeeCounts.get(name) || 0) + 1);
            }

            const hm = Array.isArray(data.hazardMatrix) ? data.hazardMatrix : [];
            for (const row of hm) {
                const hz = (row && (row.hazard || row.hazardName)) ? String(row.hazard || row.hazardName).trim() : '';
                if (hz) hazardCounts.set(hz, (hazardCounts.get(hz) || 0) + 1);
            }
        }

        const topEmployees = Array.from(employeeCounts.entries())
            .map(([employee, forms]) => ({ employee, forms }))
            .sort((a,b) => b.forms - a.forms || a.employee.localeCompare(b.employee))
            .slice(0, 25);

        const topJobs = Array.from(jobCounts.entries())
            .map(([job, forms]) => ({ job, forms }))
            .sort((a,b) => b.forms - a.forms || a.job.localeCompare(b.job))
            .slice(0, 25);

        const topHazards = Array.from(hazardCounts.entries())
            .map(([hazard, count]) => ({ hazard, count }))
            .sort((a,b) => b.count - a.count || a.hazard.localeCompare(b.hazard))
            .slice(0, 25);

        const supervisorStats = Array.from(supervisorCounts.values())
            .map(s => ({ supervisor: s.supervisor, forms: String(s.forms), emailed: `${s.emailed}/${s.forms}` }))
            .sort((a,b) => parseInt(b.forms,10) - parseInt(a.forms,10) || a.supervisor.localeCompare(b.supervisor));

        return {
            formsCount,
            attendeeTotal,
            uniqueEmployees: uniqueEmployees.size,
            uniqueJobs: uniqueJobs.size,
            topEmployees,
            topJobs,
            topHazards,
            supervisorStats
        };
    }
        }
    }

    return {
        formsCount,
        attendeeTotal,
        uniqueEmployees: uniqueEmployees.size,
        uniqueJobs: uniqueJobs.size
    };
}

async refreshReport() {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    try {
        setText('report-forms', '…');
        setText('report-attendees', '…');
        setText('report-unique', '…');
        setText('report-jobs', '…');
        const tbody = document.getElementById('report-rows');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

        const rows = await this.fetchFormsForMonth();
        const s = this.summarizeForms(rows);

        setText('report-forms', String(s.formsCount));
        setText('report-attendees', String(s.attendeeTotal));
        setText('report-unique', String(s.uniqueEmployees));
        setText('report-jobs', String(s.uniqueJobs));

            // Breakdown tables
            this.renderSimpleTable('report-employee-rows', s.topEmployees, ['employee','forms']);
            this.renderSimpleTable('report-job-rows', s.topJobs, ['job','forms']);
            this.renderSimpleTable('report-hazard-rows', s.topHazards, ['hazard','count']);
            this.renderSimpleTable('report-supervisor-rows', s.supervisorStats, ['supervisor','forms','emailed']);

        if (tbody) {
            tbody.innerHTML = '';
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="6">No forms found for this month.</td></tr>';
            } else {
                for (const r of rows) {
                    const dt = r.created_at ? new Date(r.created_at) : null;
                    const dateStr = dt ? dt.toLocaleString() : '';
                    const job = r.job_name || (r.data && (r.data.jobName || r.data.job_name)) || '';
                    const sup = r.supervisor_name || (r.data && (r.data.supervisorName || r.data.supervisor_name)) || '';
                    const attendees = (r.data && Array.isArray(r.data.attendees)) ? r.data.attendees.length : 0;
                    const email = r.email_sent ? 'Yes' : 'No';
                    const pdf = r.pdf_url ? `<a class="report-link" href="${this.escapeHtml(r.pdf_url)}" target="_blank">Open</a>` : '';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${this.escapeHtml(dateStr)}</td>
                        <td>${this.escapeHtml(job)}</td>
                        <td>${this.escapeHtml(sup)}</td>
                        <td>${attendees}</td>
                        <td>${email}</td>
                        <td>${pdf}</td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    } catch (err) {
        console.error('❌ Report error:', err);
        alert('Reporting error: ' + (err?.message || err));
        const tbody = document.getElementById('report-rows');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Error loading report.</td></tr>';
    }
}

async exportReportCsv() {
    try {
        const rows = await this.fetchFormsForMonth();
        const header = ['created_at','job','supervisor','attendees','email_sent','pdf_url'];
        const lines = [header.join(',')];

        for (const r of rows) {
            const job = r.job_name || (r.data && (r.data.jobName || r.data.job_name)) || '';
            const sup = r.supervisor_name || (r.data && (r.data.supervisorName || r.data.supervisor_name)) || '';
            const attendees = (r.data && Array.isArray(r.data.attendees)) ? r.data.attendees.length : 0;
            const vals = [
                r.created_at || '',
                job,
                sup,
                String(attendees),
                r.email_sent ? 'true' : 'false',
                r.pdf_url || ''
            ].map(v => `"${String(v).replace(/"/g,'""')}"`);
            lines.push(vals.join(','));
        }

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const range = this.getReportMonthRange();
        const filename = range ? `report_${range.y}-${String(range.m).padStart(2,'0')}.csv` : 'report.csv';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('❌ Export error:', err);
        alert('Export error: ' + (err?.message || err));
    }
}


    buildFrequencyMap(items, normalizer=null) {
        const m = new Map();
        for (const it of items) {
            const keyRaw = (normalizer ? normalizer(it) : it);
            const key = (keyRaw ?? '').toString().trim();
            if (!key) continue;
            const k = key.toLowerCase();
            m.set(k, { label: key, count: (m.get(k)?.count || 0) + 1 });
        }
        return m;
    }

    renderSimpleTable(tbodyId, rows, cols) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!rows.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${cols.length}">No data</td>`;
            tbody.appendChild(tr);
            return;
        }
        for (const r of rows) {
            const tr = document.createElement('tr');
            tr.innerHTML = cols.map(c => `<td>${this.escapeHtml(r[c] ?? '')}</td>`).join('');
            tbody.appendChild(tr);
        }
    }

}

// Create global instance
const adminController = new AdminController();
