// Form Controller for Hazard Assessment
class FormController {
    constructor() {
        this.currentForm = null;
        this.selectedHazards = [];
        this.attendees = [];
        this.photos = [];
        this.autoSaveInterval = null;
    }

    async init() {
        this.setupEventListeners();
        await this.loadJobs();
        await this.loadHazards();
        await this.loadSafetyTopics();
        this.setupAutoSave();
    }

    setupEventListeners() {
        // Form buttons
        document.getElementById('new-form-btn')?.addEventListener('click', () => {
            this.startNewForm();
        });

        document.getElementById('duplicate-form-btn')?.addEventListener('click', () => {
            this.showDuplicateOptions();
        });

        document.getElementById('cancel-duplicate-btn')?.addEventListener('click', () => {
            this.hideDuplicateOptions();
        });

        // Job selection
        document.getElementById('job-select')?.addEventListener('change', (e) => {
            this.onJobSelected(e.target.value);
        });

        // Hazard checklist changes
        document.getElementById('hazard-checklist')?.addEventListener('change', () => {
            this.updateHazardMatrix();
        });

        // Attendees
        document.getElementById('add-attendee-btn')?.addEventListener('click', () => {
            this.addAttendee();
        });

        // Photos
        document.getElementById('add-photo-btn')?.addEventListener('click', () => {
            document.getElementById('photo-input').click();
        });

        document.getElementById('photo-input')?.addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Form submission
        document.getElementById('hazard-assessment-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm();
        });

        document.getElementById('save-draft-btn')?.addEventListener('click', () => {
            this.saveDraft();
        });
    }

    // Form Management
    startNewForm() {
        this.currentForm = null;
        this.selectedHazards = [];
        this.attendees = [];
        this.photos = [];
        
        document.getElementById('hazard-assessment-form').reset();
        document.getElementById('hazard-assessment-form').style.display = 'block';
        document.getElementById('recent-forms').style.display = 'none';
        
        // Set today's date
        document.getElementById('form-date').valueAsDate = new Date();
        
        // Initialize with supervisor attendee
        this.addAttendee(true);
        
        // Clear matrix
        document.getElementById('hazard-matrix').innerHTML = '';
        document.getElementById('photos-preview').innerHTML = '';
    }

    async showDuplicateOptions() {
        const recentForms = await storage.getRecentForms(30);
        const container = document.getElementById('recent-forms-list');
        
        if (recentForms.length === 0) {
            container.innerHTML = '<p>No recent forms found.</p>';
        } else {
            container.innerHTML = recentForms.map(form => `
                <div class="recent-form-item" onclick="formController.duplicateForm(${form.id})">
                    <h4>${this.escapeHtml(form.jobName)}</h4>
                    <p>Date: ${form.date}</p>
                    <p>Supervisor: ${form.attendees && form.attendees[0] ? this.escapeHtml(form.attendees[0].name) : 'Unknown'}</p>
                </div>
            `).join('');
        }
        
        document.getElementById('recent-forms').style.display = 'block';
        document.getElementById('hazard-assessment-form').style.display = 'none';
    }

    hideDuplicateOptions() {
        document.getElementById('recent-forms').style.display = 'none';
    }

    async duplicateForm(formId) {
        const form = await storage.get('forms', formId);
        if (!form) return;
        
        this.currentForm = null; // Create new form, don't update old one
        
        // Populate form fields
        document.getElementById('job-select').value = form.jobId || '';
        await this.onJobSelected(form.jobId);
        
        document.getElementById('form-date').valueAsDate = new Date(); // Today's date
        document.getElementById('muster-point').value = form.musterPoint || '';
        
        if (form.erpReviewed) {
            const erpRadio = document.querySelector(`input[name="erp-reviewed"][value="${form.erpReviewed}"]`);
            if (erpRadio) erpRadio.checked = true;
        }
        
        document.getElementById('scope-of-work').value = form.scopeOfWork || '';
        document.getElementById('safety-meeting').value = form.safetyMeeting || '';
        
        // Restore hazard selections
        if (form.selectedHazardIds) {
            form.selectedHazardIds.forEach(hazardId => {
                const checkbox = document.querySelector(`#hazard-checklist input[value="${hazardId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        this.updateHazardMatrix();
        
        // Restore hazard matrix edits
        if (form.hazardMatrix) {
            form.hazardMatrix.forEach((item, index) => {
                const riskSelect = document.querySelector(`#matrix-row-${index} select[name="risk"]`);
                const severitySelect = document.querySelector(`#matrix-row-${index} select[name="severity"]`);
                const controlsTextarea = document.querySelector(`#matrix-row-${index} textarea[name="controls"]`);
                
                if (riskSelect) riskSelect.value = item.risk;
                if (severitySelect) severitySelect.value = item.severity;
                if (controlsTextarea) controlsTextarea.value = item.controls || '';
            });
        }
        
        // Clear attendees - fresh signatures needed each day
        this.attendees = [];
        document.getElementById('attendees-list').innerHTML = '';
        this.addAttendee(true); // Add supervisor slot
        
        // Don't restore photos - fresh photos each day
        this.photos = [];
        
        this.hideDuplicateOptions();
        document.getElementById('hazard-assessment-form').style.display = 'block';
    }

    // Job Management
    async loadJobs() {
        const jobs = await storage.getAll('jobs');
        const select = document.getElementById('job-select');
        
        select.innerHTML = '<option value="">Select Job...</option>';
        jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = job.name;
            select.appendChild(option);
        });
    }

    async onJobSelected(jobId) {
        if (!jobId) {
            document.getElementById('job-details').style.display = 'none';
            return;
        }
        
        const job = await storage.get('jobs', parseInt(jobId));
        if (job) {
            document.getElementById('job-address').textContent = job.address;
            document.getElementById('job-address2').textContent = job.address2 || 'N/A';
            document.getElementById('job-emergency-phone').textContent = job.emergencyPhone;
            document.getElementById('job-details').style.display = 'block';
        }
    }

    // Hazard Management
    async loadHazards() {
        const hazards = await storage.getAll('hazards');
        const container = document.getElementById('hazard-checklist');
        
        if (!hazards || hazards.length === 0) {
            container.innerHTML = '<p>No hazards configured. Please add hazards in the Admin panel.</p>';
            return;
        }
        
        container.innerHTML = hazards.map(hazard => `
            <div class="hazard-checkbox">
                <input type="checkbox" id="hazard-${hazard.id}" value="${hazard.id}" 
                       data-name="${this.escapeHtml(hazard.name)}"
                       data-risk="${hazard.risk}"
                       data-severity="${hazard.severity}"
                       data-controls="${this.escapeHtml(hazard.suggestedControls || '')}">
                <label for="hazard-${hazard.id}">${this.escapeHtml(hazard.name)}</label>
            </div>
        `).join('');
    }

    async loadSafetyTopics() {
        const topics = await storage.getAll('safety_topics');
        const container = document.getElementById('safety-topics-checklist');
        
        if (!container) return; // Container might not exist yet
        
        if (!topics || topics.length === 0) {
            container.innerHTML = '<p>No safety topics configured.</p>';
            return;
        }
        
        // Sort by sort order
        topics.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        container.innerHTML = topics.map(topic => `
            <div class="topic-checkbox">
                <input type="checkbox" id="topic-${topic.id}" value="${topic.id}" 
                       data-name="${this.escapeHtml(topic.name)}">
                <label for="topic-${topic.id}">${this.escapeHtml(topic.name)}</label>
            </div>
        `).join('');
    }

    updateHazardMatrix() {
        const checkboxes = document.querySelectorAll('#hazard-checklist input[type="checkbox"]:checked');
        const matrix = document.getElementById('hazard-matrix');
        
        matrix.innerHTML = '';
        
        checkboxes.forEach((checkbox, index) => {
            const hazardName = checkbox.dataset.name;
            const risk = checkbox.dataset.risk;
            const severity = checkbox.dataset.severity;
            const controls = checkbox.dataset.controls;
            
            const row = this.createMatrixRow(index, hazardName, risk, severity, controls);
            matrix.appendChild(row);
        });
        
        // Add a blank row for additional hazards
        const blankRow = this.createMatrixRow(checkboxes.length, '', 'Low', 'Minor', '', true);
        matrix.appendChild(blankRow);
    }

    createMatrixRow(index, hazardName = '', risk = 'Low', severity = 'Minor', controls = '', isBlank = false) {
        const row = document.createElement('div');
        row.className = 'matrix-row';
        row.id = `matrix-row-${index}`;
        
        row.innerHTML = `
            <h4>${isBlank ? 'Additional Hazard' : this.escapeHtml(hazardName)}</h4>
            <div class="matrix-row-header">
                <div>
                    <label>Risk</label>
                    <select name="risk">
                        <option value="Low" ${risk === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Medium" ${risk === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="High" ${risk === 'High' ? 'selected' : ''}>High</option>
                    </select>
                </div>
                <div>
                    <label>Severity</label>
                    <select name="severity">
                        <option value="Minor" ${severity === 'Minor' ? 'selected' : ''}>Minor</option>
                        <option value="Moderate" ${severity === 'Moderate' ? 'selected' : ''}>Moderate</option>
                        <option value="Severe" ${severity === 'Severe' ? 'selected' : ''}>Severe</option>
                        <option value="Critical" ${severity === 'Critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
            </div>
            ${isBlank ? `
                <div class="matrix-controls">
                    <label>Hazard Name</label>
                    <input type="text" name="hazard-name" placeholder="Enter additional hazard...">
                </div>
            ` : ''}
            <div class="matrix-controls">
                <label>Corrective Action / Controls *</label>
                <textarea name="controls" rows="3" required>${this.escapeHtml(controls)}</textarea>
            </div>
            ${isBlank ? `
                <div class="matrix-actions">
                    <button type="button" class="btn-secondary" onclick="formController.addBlankHazardRow()">+ Add Another</button>
                </div>
            ` : ''}
        `;
        
        return row;
    }

    addBlankHazardRow() {
        const matrix = document.getElementById('hazard-matrix');
        const currentRows = matrix.querySelectorAll('.matrix-row').length;
        const newRow = this.createMatrixRow(currentRows, '', 'Low', 'Minor', '', true);
        matrix.appendChild(newRow);
    }

    // Attendees
    addAttendee(isSupervisor = false, name = '') {
        const container = document.getElementById('attendees-list');
        const index = this.attendees.length;
        
        // First attendee is always supervisor, rest are regular attendees
        const isFirstAttendee = index === 0;
        const labelText = isFirstAttendee ? 'Supervisor' : 'Attendee';
        const placeholderText = isFirstAttendee ? 'Supervisor name' : 'Attendee name';
        
        const row = document.createElement('div');
        row.className = 'attendee-row' + (isFirstAttendee ? ' supervisor' : '');
        row.id = `attendee-${index}`;
        
        row.innerHTML = `
            <div class="attendee-name-group">
                <label>${labelText} *</label>
                <input type="text" name="attendee-name" value="${this.escapeHtml(name)}" required 
                       placeholder="${placeholderText}">
            </div>
            <div>
                <label>Signature *</label>
                <canvas class="signature-pad" width="300" height="120"></canvas>
                <div class="signature-actions">
                    <button type="button" class="btn-clear-signature" onclick="formController.clearSignature(${index})">Clear</button>
                </div>
            </div>
            ${!isFirstAttendee ? `
                <button type="button" class="btn-icon delete" onclick="formController.removeAttendee(${index})" 
                        style="align-self: start; margin-top: 30px;">×</button>
            ` : '<div></div>'}
        `;
        
        container.appendChild(row);
        
        // Initialize signature pad
        const canvas = row.querySelector('.signature-pad');
        const signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)',
            minWidth: 0.5,
            maxWidth: 2.5,
            throttle: 0, // Disable throttling for smoother drawing
            minDistance: 0 // Minimum distance for better touch responsiveness
        });
        
        // Prevent scrolling when drawing on signature pad (mobile fix)
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        this.attendees.push({
            index,
            isSupervisor: isFirstAttendee,
            signaturePad
        });
    }

    clearSignature(index) {
        const attendee = this.attendees[index];
        if (attendee && attendee.signaturePad) {
            attendee.signaturePad.clear();
        }
    }

    removeAttendee(index) {
        const row = document.getElementById(`attendee-${index}`);
        if (row) {
            row.remove();
        }
        // Note: We don't remove from array to keep indices consistent
    }

    // Photos
    async handlePhotoUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        if (this.photos.length >= 3) {
            alert('Maximum 3 photos allowed');
            return;
        }
        
        const file = files[0];
        
        // Compress and convert to base64
        const compressedImage = await this.compressImage(file);
        this.photos.push(compressedImage);
        
        this.updatePhotosPreview();
        
        // Reset input
        event.target.value = '';
    }

    async compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Max dimensions
                    const maxWidth = 800;
                    const maxHeight = 600;
                    
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG at 80% quality
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    updatePhotosPreview() {
        const container = document.getElementById('photos-preview');
        container.innerHTML = this.photos.map((photo, index) => `
            <div class="photo-item">
                <img src="${photo}" alt="Photo ${index + 1}">
                <button type="button" class="photo-remove" onclick="formController.removePhoto(${index})">×</button>
            </div>
        `).join('');
    }

    removePhoto(index) {
        this.photos.splice(index, 1);
        this.updatePhotosPreview();
    }

    // Form Submission
    async collectFormData() {
        const jobId = parseInt(document.getElementById('job-select').value);
        const job = await storage.get('jobs', jobId);
        
        if (!job) {
            throw new Error('Please select a job');
        }
        
        // Collect hazard matrix data
        const matrixRows = document.querySelectorAll('.matrix-row');
        const hazardMatrix = [];
        
        matrixRows.forEach(row => {
            const hazardNameInput = row.querySelector('input[name="hazard-name"]');
            const hazardName = hazardNameInput ? hazardNameInput.value : row.querySelector('h4').textContent;
            const risk = row.querySelector('select[name="risk"]').value;
            const severity = row.querySelector('select[name="severity"]').value;
            const controls = row.querySelector('textarea[name="controls"]').value;
            
            if (hazardName && hazardName !== 'Additional Hazard' && controls.trim()) {
                hazardMatrix.push({ hazard: hazardName, risk, severity, controls });
            }
        });
        
        // Collect attendees
        const attendeeData = [];
        for (const attendee of this.attendees) {
            const row = document.getElementById(`attendee-${attendee.index}`);
            if (!row) continue;
            
            const nameInput = row.querySelector('input[name="attendee-name"]');
            const name = nameInput ? nameInput.value : '';
            
            if (!name.trim()) continue;
            
            let signature = null;
            if (attendee.signaturePad && !attendee.signaturePad.isEmpty()) {
                signature = attendee.signaturePad.toDataURL();
            }
            
            attendeeData.push({ name, signature, isSupervisor: attendee.isSupervisor });
        }
        
        if (attendeeData.length === 0) {
            throw new Error('At least one attendee (supervisor) is required');
        }
        
        // Collect selected hazards for duplication
        const selectedHazardIds = Array.from(document.querySelectorAll('#hazard-checklist input:checked'))
            .map(cb => parseInt(cb.value));
        
        // Collect discussed safety topics
        const discussedTopics = Array.from(document.querySelectorAll('#safety-topics-checklist input:checked'))
            .map(cb => ({
                id: parseInt(cb.value),
                name: cb.dataset.name
            }));
        
        // Get additional topics text
        const additionalTopics = document.getElementById('additional-topics')?.value || '';
        
        const formData = {
            jobId: jobId,
            jobName: job.name,
            address: job.address,
            address2: job.address2,
            emergencyPhone: job.emergencyPhone,
            date: document.getElementById('form-date').value,
            musterPoint: document.getElementById('muster-point').value,
            erpReviewed: document.querySelector('input[name="erp-reviewed"]:checked')?.value || 'no',
            scopeOfWork: document.getElementById('scope-of-work').value,
            selectedHazardIds: selectedHazardIds,
            hazardMatrix: hazardMatrix,
            discussedTopics: discussedTopics,
            additionalTopics: additionalTopics,
            safetyMeeting: document.getElementById('safety-meeting').value,
            attendees: attendeeData,
            photos: this.photos,
            submitted: false,
            createdAt: new Date().toISOString()
        };
        
        return formData;
    }

    async submitForm() {
        try {
            const formData = await this.collectFormData();
            
            // Generate PDF
            const pdfDoc = await pdfGenerator.generateHazardAssessmentPDF(formData);
            
            // Generate filename
            const filename = pdfGenerator.generateFilename(
                formData.jobName,
                formData.date,
                formData.attendees[0]?.name || 'Unknown'
            );
            
            // Upload PDF to cloud storage if available
            let pdfUrl = null;
            if (storage.cloudReady) {
                try {
                    console.log('☁️ Uploading PDF to cloud storage...');
                    // Convert PDF to Blob
                    const pdfBlob = pdfDoc.output('blob');
                    pdfUrl = await storage.uploadFormPDF(pdfBlob, filename);
                    if (pdfUrl) {
                        formData.pdfUrl = pdfUrl;
                        formData.pdfFilename = filename;
                        console.log('✅ PDF uploaded to cloud:', pdfUrl);
                    }
                } catch (error) {
                    console.error('❌ PDF upload error:', error);
                    console.log('📦 Continuing without cloud PDF storage');
                }
            }
            
            // Send email / save PDF to device
            const result = await emailSender.sendFormEmail(pdfDoc, formData);
            
            // If emailSender didn't set flags (older caches), infer from result
            if (result && result.success) {
                if (result.emailFailed || result.needsManualEmail) {
                    formData.emailSent = false;
                    formData.emailSentAt = null;
                    formData.emailError = result.message || 'Email not sent';
                } else if (formData.emailSent !== false) {
                    formData.emailSent = true;
                    formData.emailSentAt = formData.emailSentAt || new Date().toISOString();
                    formData.emailError = null;
                }
            }

            if (result.success) {
                // Mark as submitted
                formData.submitted = true;
                formData.submittedAt = new Date().toISOString();
                
                // Save form to storage (will sync to cloud if available)
                if (this.currentForm) {
                    formData.id = this.currentForm.id;
                    await storage.update('forms', formData);

            // Attempt to save the form record to Supabase (best-effort)
            if (navigator.onLine) {
                const cloud = await storage.saveFormToCloud(formData);
                if (cloud.success) {
                    formData.cloudSaved = true;
                    formData.cloudSavedAt = new Date().toISOString();
                    formData.cloudError = null;
                    // Store returned id if present
                    if (cloud.data && cloud.data.id) formData.cloudId = cloud.data.id;
                    await storage.update('forms', formData);
                } else {
                    formData.cloudSaved = false;
                    formData.cloudSavedAt = null;
                    formData.cloudError = cloud.error || 'Unknown cloud save error';
                    await storage.update('forms', formData);
                }
            }

                } else {
                    await storage.add('forms', formData);
                }
                
                let successMsg = `✅ Form submitted successfully!\n\n📥 PDF downloaded: ${result.filename}\n📧 Email sent to: safety@brazelconstruction.com`;
                
                if (pdfUrl) {
                    successMsg += `\n☁️ PDF backed up to cloud storage`;
                }
                
                alert(successMsg);
                
                // Reset form
                this.startNewForm();
            } else {
                alert('Error submitting form: ' + result.message);
            }
            
        } catch (error) {
            console.error('Form submission error:', error);
            alert('Error: ' + error.message);
        }
    }

    async saveDraft() {
        try {
            const formData = await this.collectFormData();
            formData.submitted = false;
            
            if (this.currentForm) {
                formData.id = this.currentForm.id;
                await storage.update('forms', formData);

            // Attempt to save the form record to Supabase (best-effort)
            if (navigator.onLine) {
                const cloud = await storage.saveFormToCloud(formData);
                if (cloud.success) {
                    formData.cloudSaved = true;
                    formData.cloudSavedAt = new Date().toISOString();
                    formData.cloudError = null;
                    // Store returned id if present
                    if (cloud.data && cloud.data.id) formData.cloudId = cloud.data.id;
                    await storage.update('forms', formData);
                } else {
                    formData.cloudSaved = false;
                    formData.cloudSavedAt = null;
                    formData.cloudError = cloud.error || 'Unknown cloud save error';
                    await storage.update('forms', formData);
                }
            }

            } else {
                const id = await storage.add('forms', formData);
                this.currentForm = { id };
            }
            
            alert('Draft saved successfully');
        } catch (error) {
            console.error('Save draft error:', error);
            alert('Error saving draft: ' + error.message);
        }
    }

    // Auto-save
    setupAutoSave() {
        // Check time every minute
        this.autoSaveInterval = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            
            // Auto-save at 8:00 PM (20:00)
            if (hours === 20 && minutes === 0) {
                this.autoSubmit();
            }
        }, 60000); // Check every minute
    }

    async autoSubmit() {
        const form = document.getElementById('hazard-assessment-form');
        if (form.style.display === 'none') return; // Form not active
        
        try {
            await this.submitForm();
        } catch (error) {
            console.error('Auto-submit error:', error);
            // Just save as draft if submission fails
            await this.saveDraft();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const formController = new FormController();
