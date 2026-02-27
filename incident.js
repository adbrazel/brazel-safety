
/* Incident / Near Miss Controller */
class IncidentController {
    constructor() {
        this.signaturePad = null;
        this.signatureLocked = false;
        this.lockedSignature = null;
        this.photos = [];
        this.photosLocked = false;
    }

    async init() {
        const openBtn = document.getElementById('incident-open');
        const backBtn = document.getElementById('incident-back');
        const hazardBtn = document.getElementById('hazard-open');

        const screenMain = document.getElementById('form-screen');
        const screenIncident = document.getElementById('incident-screen');
        const adminScreen = document.getElementById('admin-screen');
        const resourcesScreen = document.getElementById('resources-screen');
        const formsScreen = document.getElementById('forms-screen');

        if (!openBtn || !backBtn || !screenMain || !screenIncident) return;

        const d = new Date();
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const dateEl = document.getElementById('incident-date');
        if (dateEl && !dateEl.value) dateEl.value = iso;
        const timeEl = document.getElementById('incident-time');
        if (timeEl && !timeEl.value) {
            const t = new Date();
            timeEl.value = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
        }

        const photoInput = document.getElementById('incident-photos');
        if (photoInput) {
            photoInput.addEventListener('change', async () => {
                if (this.photosLocked) return;
                this.photos = await this.readAndCompressPhotos(photoInput.files);
                this.renderPhotoPreview('incident-photo-preview');
            });
        }

        openBtn.addEventListener('click', async () => {
            screenMain.style.display = 'none';
            if (adminScreen) adminScreen.style.display = 'none';
            if (resourcesScreen) resourcesScreen.style.display = 'none';
            if (formsScreen) formsScreen.style.display = 'none';
            screenIncident.style.display = 'block';
            await this.loadJobs();
        });

        backBtn.addEventListener('click', () => {
            screenIncident.style.display = 'none';
            screenMain.style.display = 'block';
        });

        if (hazardBtn) {
            hazardBtn.addEventListener('click', () => {
                screenIncident.style.display = 'none';
                screenMain.style.display = 'block';
            });
        }

        this.initSignature();

        const form = document.getElementById('incident-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submit();
        });
    }

    initSignature() {
        const canvas = document.getElementById('incident-signature');
        if (!canvas) return;

        this.signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });

        document.getElementById('incident-clear')?.addEventListener('click', () => {
            if (this.signatureLocked) return alert('Signature is locked.');
            this.signaturePad.clear();
        });

        document.getElementById('incident-lock')?.addEventListener('click', () => {
            if (this.signatureLocked) return;
            if (this.signaturePad.isEmpty()) return alert('Please sign before locking.');
            this.lockedSignature = this.signaturePad.toDataURL();
            this.signatureLocked = true;
            this.photosLocked = true;
            try { this.signaturePad.off(); } catch {}
            canvas.style.pointerEvents = 'none';

            const btn = document.getElementById('incident-lock');
            if (btn) { btn.textContent = 'Locked'; btn.disabled = true; }
            const clr = document.getElementById('incident-clear');
            // Lock photo picker too
            const pi = document.getElementById('incident-photos');
            if (pi) pi.disabled = true;
            if (clr) clr.disabled = true;
        });
    }

    async loadJobs() {
        const sel = document.getElementById('incident-job');
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

    collect() {
        return {
            formType: 'incident',
            date: document.getElementById('incident-date').value,
            time: document.getElementById('incident-time')?.value || '',
            location: document.getElementById('incident-location')?.value?.trim() || '',
            jobName: document.getElementById('incident-job').value,
            reporter: document.getElementById('incident-reporter').value.trim(),
            supervisor: document.getElementById('incident-supervisor')?.value?.trim() || '',
            incidentType: document.getElementById('incident-type').value,
            description: document.getElementById('incident-description').value.trim(),
            actions: document.getElementById('incident-actions').value.trim(),
            injury: document.getElementById('incident-injury').value,
            classification: document.getElementById('incident-classification')?.value || '',
            reportedToOHS: document.getElementById('incident-reported-ohs')?.value || '',
            involvedWorker: document.getElementById('incident-worker')?.value?.trim() || '',
            equipment: document.getElementById('incident-equipment')?.value?.trim() || '',
            rootCauses: document.getElementById('incident-rootcause')?.value?.trim() || '',
            correctiveActions: document.getElementById('incident-corrective')?.value?.trim() || '',
            witnesses: document.getElementById('incident-witnesses').value.trim(),
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
        const pdfDoc = await pdfGenerator.generateIncidentPDF(formData);
        const filename = pdfGenerator.generateFilename(formData.jobName, formData.date, formData.reporter || 'Reporter');

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
                        const photoBlobs = (formData.photos || []).map(p => ({
                            blob: this.dataUrlToBlob(p.dataUrl),
                            ext: 'jpg'
                        }));
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

        document.getElementById('incident-screen').style.display = 'none';
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

window.incidentController = new IncidentController();
