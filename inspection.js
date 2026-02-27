
/* Worksite Inspection Controller */
class InspectionController {
    constructor() {
        this.signaturePad = null;
        this.signatureLocked = false;
        this.lockedSignature = null;
        this.photos = [];
        this.photosLocked = false;

        this.checklistItems = [
            { key: 'ppe', label: 'PPE being worn correctly' },
            { key: 'housekeeping', label: 'Housekeeping / trip hazards' },
            { key: 'equipment', label: 'Equipment condition / guards' },
            { key: 'traffic', label: 'Traffic control / signage' },
            { key: 'excavation', label: 'Excavation / edges / shoring' },
            { key: 'weather', label: 'Weather / ground conditions' }
        ];
    }

    async init() {
        const openBtn = document.getElementById('inspection-open');
        const backBtn = document.getElementById('inspection-back');
        const hazardBtn = document.getElementById('hazard-open');

        const screenMain = document.getElementById('form-screen');
        const screenInspection = document.getElementById('inspection-screen');
        const adminScreen = document.getElementById('admin-screen');
        const resourcesScreen = document.getElementById('resources-screen');
        const formsScreen = document.getElementById('forms-screen');

        if (!openBtn || !backBtn || !screenMain || !screenInspection) return;

        const d = new Date();
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const dateEl = document.getElementById('inspection-date');
        if (dateEl && !dateEl.value) dateEl.value = iso;

        const photoInput = document.getElementById('inspection-photos');
        if (photoInput) {
            photoInput.addEventListener('change', async () => {
                if (this.photosLocked) return;
                this.photos = await this.readAndCompressPhotos(photoInput.files);
                this.renderPhotoPreview('inspection-photo-preview');
            });
        }

        this.renderChecklist();
        this.initFindings();
        this.initSignature();

        openBtn.addEventListener('click', async () => {
            screenMain.style.display = 'none';
            if (adminScreen) adminScreen.style.display = 'none';
            if (resourcesScreen) resourcesScreen.style.display = 'none';
            if (formsScreen) formsScreen.style.display = 'none';
            screenInspection.style.display = 'block';
            await this.loadJobs();
        });

        backBtn.addEventListener('click', () => {
            screenInspection.style.display = 'none';
            screenMain.style.display = 'block';
        });

        if (hazardBtn) {
            hazardBtn.addEventListener('click', () => {
                screenInspection.style.display = 'none';
                screenMain.style.display = 'block';
            });
        }

        document.getElementById('inspection-add-finding')?.addEventListener('click', () => this.addFindingRow());

        const form = document.getElementById('inspection-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submit();
        });
    }

    async loadJobs() {
        const sel = document.getElementById('inspection-job');
        if (!sel) return;

        sel.innerHTML = '';
        let jobs = [];
        try { jobs = await storage.getJobs(); } catch {}

        if (!jobs.length) {
            const opt = document.createElement('option');
            opt.value = 'General';
            opt.textContent = 'General';
            sel.appendChild(opt);
            return;
        }

        for (const j of jobs) {
            const name = j.name || j.job_name || j.title || j.job || 'Job';
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        }
    }

    renderChecklist() {
        const wrap = document.getElementById('inspection-checklist');
        if (!wrap) return;

        wrap.innerHTML = '';
        for (const item of this.checklistItems) {
            const row = document.createElement('div');
            row.className = 'form-row';
            row.innerHTML = `
                <div class="form-group" style="flex:1;">
                    <label>${item.label}</label>
                    <select data-check="${item.key}" required>
                        <option value="OK">OK</option>
                        <option value="Issue">Issue</option>
                        <option value="N/A">N/A</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2;">
                    <label>Notes</label>
                    <input type="text" data-note="${item.key}" placeholder="Optional notes">
                </div>
            `;
            wrap.appendChild(row);
        }
    }

    initFindings() {
        const wrap = document.getElementById('inspection-findings');
        if (!wrap) return;
        wrap.innerHTML = '';
        this.addFindingRow();
    }

    addFindingRow() {
        const wrap = document.getElementById('inspection-findings');
        if (!wrap) return;

        const row = document.createElement('div');
        row.className = 'form-item';
        row.innerHTML = `
            <div class="form-meta" style="flex:1;">
                <div class="form-row">
                    <div class="form-group" style="flex:2;">
                        <label>Finding</label>
                        <input type="text" data-finding="finding" placeholder="What is the issue?">
                    </div>
                    <div class="form-group" style="flex:2;">
                        <label>Corrective action</label>
                        <input type="text" data-finding="action" placeholder="What will be done?">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex:1;">
                        <label>Due date</label>
                        <input type="date" data-finding="due">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Owner</label>
                        <input type="text" data-finding="owner" placeholder="Who is responsible?">
                    </div>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary">Remove</button>
            </div>
        `;
        row.querySelector('button').addEventListener('click', () => row.remove());
        wrap.appendChild(row);
    }

    initSignature() {
        const canvas = document.getElementById('inspection-signature');
        if (!canvas) return;

        this.signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });

        document.getElementById('inspection-clear')?.addEventListener('click', () => {
            if (this.signatureLocked) return alert('Signature is locked.');
            this.signaturePad.clear();
        });

        document.getElementById('inspection-lock')?.addEventListener('click', () => {
            if (this.signatureLocked) return;
            if (this.signaturePad.isEmpty()) return alert('Please sign before locking.');
            this.lockedSignature = this.signaturePad.toDataURL();
            this.signatureLocked = true;
            this.photosLocked = true;
            try { this.signaturePad.off(); } catch {}
            canvas.style.pointerEvents = 'none';

            const btn = document.getElementById('inspection-lock');
            if (btn) { btn.textContent = 'Locked'; btn.disabled = true; }
            const clr = document.getElementById('inspection-clear');
            const pi = document.getElementById('inspection-photos');
            if (pi) pi.disabled = true;
            if (clr) clr.disabled = true;
        });
    }

    collect() {
        const date = document.getElementById('inspection-date').value;
        const jobName = document.getElementById('inspection-job').value;
        const inspector = document.getElementById('inspection-inspector').value.trim();

        const checklist = [];
        for (const item of this.checklistItems) {
            const status = document.querySelector(`[data-check="${item.key}"]`)?.value || 'OK';
            const note = document.querySelector(`[data-note="${item.key}"]`)?.value || '';
            checklist.push({ key: item.key, label: item.label, status, note });
        }

        const findings = [];
        const wrap = document.getElementById('inspection-findings');
        if (wrap) {
            for (const row of Array.from(wrap.children)) {
                const finding = row.querySelector('[data-finding="finding"]')?.value?.trim() || '';
                const action = row.querySelector('[data-finding="action"]')?.value?.trim() || '';
                const due = row.querySelector('[data-finding="due"]')?.value || '';
                const owner = row.querySelector('[data-finding="owner"]')?.value?.trim() || '';
                if (finding || action || due || owner) findings.push({ finding, action, due, owner });
            }
        }

        return {
            formType: 'inspection',
            date,
            jobName,
            inspector,
            checklist,
            findings,
            signature: this.lockedSignature || (this.signaturePad && !this.signaturePad.isEmpty() ? this.signaturePad.toDataURL() : null),
            photos: (this.photos || []).map(p => ({ name: p.name, type: p.type, dataUrl: p.dataUrl })),
            createdAt: new Date().toISOString()
        };
    }

    async submit() {
        const formData = this.collect();

        // Always save locally first
        formData.submitted = false;
        formData.submittedAt = null;
        await storage.saveForm(formData);

        // PDF
        const pdfDoc = await pdfGenerator.generateInspectionPDF(formData);
        const filename = pdfGenerator.generateFilename(formData.jobName, formData.date, formData.inspector || 'Inspector');

        // Cloud backup + DB save before email
        if (navigator.onLine && storage.cloudReady) {
            try {
                const pdfBlob = pdfDoc.output('blob');
                const pdfUrl = await storage.uploadFormPDF(pdfBlob, filename);
                if (pdfUrl) {
                    formData.pdfUrl = pdfUrl;
                    formData.pdfFilename = filename;
                    formData.cloudBackup = true;
                    formData.cloudBackupAt = new Date().toISOString();
                    // Upload photos (optional)
                    try {
                        const photoBlobs = (formData.photos || []).map(p => ({ blob: this.dataUrlToBlob(p.dataUrl), ext: 'jpg' }));
                        const baseName = filename.replace(/\.pdf$/i,'');
                        const urls = await storage.uploadMultiplePhotos(photoBlobs, baseName);
                        if (urls.length) formData.photoUrls = urls;
                    } catch (e) {
                        console.warn('Photo upload failed', e);
                    }
                }
            } catch (e) {
                formData.cloudBackup = false;
                formData.cloudBackupError = e?.message || String(e);
            }

            try {
                const cloud = await storage.saveFormToCloud(formData);
                if (cloud.success) {
                    formData.cloudSaved = true;
                    formData.cloudSavedAt = new Date().toISOString();
                    if (cloud.data && cloud.data.id) formData.cloudId = cloud.data.id;
                } else {
                    formData.cloudSaved = false;
                    formData.cloudError = cloud.error;
                }
            } catch (e) {
                formData.cloudSaved = false;
                formData.cloudError = e?.message || String(e);
            }
        }

        // Email
        const result = await emailSender.sendFormEmail(pdfDoc, formData, filename);

        // Mark submitted and persist
        formData.submitted = true;
        formData.submittedAt = new Date().toISOString();
        await storage.update('forms', formData);

        if (result?.emailFailed || result?.needsManualEmail) {
            alert('Submitted. Saved locally (and uploaded if online). Email did not send automatically.');
        } else {
            alert('✅ Submitted and emailed.');
        }

        document.getElementById('inspection-screen').style.display = 'none';
        document.getElementById('form-screen').style.display = 'block';
    }

    async readAndCompressPhotos(fileList) {
        const files = Array.from(fileList || []);
        const out = [];
        const max = 6;
        for (const f of files.slice(0, max)) {
            const dataUrl = await this.fileToDataURL(f);
            const compressed = await this.compressImageDataUrl(dataUrl, 1280, 0.75);
            out.push({
                name: f.name || 'photo.jpg',
                type: 'image/jpeg',
                dataUrl: compressed
            });
        }
        return out;
    }

    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    compressImageDataUrl(dataUrl, maxSize, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    renderPhotoPreview(containerId) {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;
        wrap.innerHTML = '';
        const photos = this.photos || [];
        photos.forEach((p, idx) => {
            const div = document.createElement('div');
            div.className = 'photo-thumb';
            div.innerHTML = `<img src="${p.dataUrl}" alt="photo"><button type="button" class="btn-secondary">x</button>`;
            div.querySelector('button').addEventListener('click', () => {
                if (this.photosLocked) return;
                this.photos.splice(idx,1);
                this.renderPhotoPreview(containerId);
            });
            wrap.appendChild(div);
        });
    }

}

window.inspectionController = new InspectionController();
