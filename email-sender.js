// Email Sender using EmailJS - Improved Reliability
class EmailSender {
    constructor() {
        // EmailJS credentials - configured for Brazel Construction
        this.serviceId = 'service_4wqtdk6';
        this.templateId = 'template_dldh7qg';
        this.publicKey = 'pTDTlEaGALtM2YRlA';
        
        this.recipientEmail = 'safety@brazelconstruction.com';
        this.initialized = false;
        this.initAttempted = false;
    }

    async init() {
        if (this.initAttempted) {
            return this.initialized;
        }
        
        this.initAttempted = true;
        
        // Check if credentials are configured
        if (this.serviceId.startsWith('YOUR_') || 
            this.templateId.startsWith('YOUR_') || 
            this.publicKey.startsWith('YOUR_')) {
            console.warn('⚠️ EmailJS not configured yet. PDFs will download only.');
            return false;
        }

        // Load EmailJS library with extended timeout
        return new Promise((resolve) => {
            if (typeof emailjs !== 'undefined') {
                try {
                    emailjs.init(this.publicKey);
                    this.initialized = true;
                    console.log('✅ EmailJS initialized successfully');
                    resolve(true);
                } catch (error) {
                    console.error('❌ EmailJS init error:', error);
                    resolve(false);
                }
            } else {
                console.log('⏳ Waiting for EmailJS library...');
                
                // Wait up to 10 seconds for library to load (increased from 5)
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof emailjs !== 'undefined') {
                        clearInterval(checkInterval);
                        try {
                            emailjs.init(this.publicKey);
                            this.initialized = true;
                            console.log('✅ EmailJS initialized after waiting');
                            resolve(true);
                        } catch (error) {
                            console.error('❌ EmailJS init error:', error);
                            resolve(false);
                        }
                    } else if (attempts >= 100) { // 10 seconds
                        clearInterval(checkInterval);
                        console.error('❌ EmailJS library failed to load');
                        resolve(false);
                    }
                }, 100);
            }
        });
    }

    async sendFormEmail(pdfDoc, formData) {
        const filename = pdfGenerator.generateFilename(
            formData.jobName,
            formData.date,
            formData.attendees[0]?.name || 'Unknown'
        );
        
        // Always download PDF to user's device first
        console.log('📥 Downloading PDF to device:', filename);
        try {
            pdfDoc.save(filename);
            console.log('✅ PDF downloaded successfully');
        } catch (error) {
            console.error('❌ PDF download error:', error);
            throw new Error('Failed to download PDF: ' + error.message);
        }
        
        // Try to initialize EmailJS if not already done
        if (!this.initialized && !this.initAttempted) {
            console.log('🔄 EmailJS not initialized, attempting now...');
            await this.init();
        }
        
        // If EmailJS is configured, send email with retry logic
        if (this.initialized) {
            try {
                console.log('📧 Attempting to send email...');
                await this.sendEmailWithRetry(pdfDoc, formData, filename);

                // Track email status
                formData.emailSent = true;
                formData.emailSentAt = new Date().toISOString();
                formData.emailError = null;
                
                // Mark form as submitted
                formData.submitted = true;
                formData.submittedAt = new Date().toISOString();
                if (formData.id) {
                    await storage.update('forms', formData);
                }
                
                return {
                    success: true,
                    message: `✅ Form submitted successfully!\n\n📥 PDF downloaded: "${filename}"\n📧 Complete form emailed to: ${this.recipientEmail}\n\nThe email contains all form details and can be read directly.\nPDF backup saved to your device.`,
                    filename: filename
                };
            } catch (error) {
                console.error('❌ Email send failed after retries:', error);
                
                // Track email status
                formData.emailSent = false;
                formData.emailSentAt = null;
                formData.emailError = error.message || String(error);

                // Still mark as submitted since PDF downloaded
                formData.submitted = true;
                formData.submittedAt = new Date().toISOString();
                if (formData.id) {
                    await storage.update('forms', formData);
                }
                
                return {
                    success: true, // PDF downloaded successfully
                    message: `✅ PDF downloaded as "${filename}"\n\n❌ Email failed to send: ${error.message}\n\nPlease manually forward the PDF to:\n${this.recipientEmail}`,
                    filename: filename,
                    emailFailed: true
                };
            }
        } else {
            // Track email status
            formData.emailSent = false;
            formData.emailSentAt = null;
            formData.emailError = 'Email service not available';

            // Email not configured - just save PDF
            formData.submitted = true;
            formData.submittedAt = new Date().toISOString();
            if (formData.id) {
                await storage.update('forms', formData);
            }
            
            return {
                success: true,
                message: `✅ PDF downloaded as "${filename}"\n\n⚠️ Email service not available.\nPlease manually forward the PDF to:\n${this.recipientEmail}`,
                filename: filename,
                needsManualEmail: true
            };
        }
    }

    async sendEmailWithRetry(pdfDoc, formData, filename, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📧 Email send attempt ${attempt}/${maxRetries}...`);
                await this.sendEmail(formData, filename);
                console.log('✅ Email sent successfully');
                return true;
            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error);
                lastError = error;
                
                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        throw lastError;
    }

    async sendEmail(formData, filename) {
        // Build complete form content for email body
        const emailBody = this.buildFormEmailBody(formData, filename);
        
        const templateParams = {
            to_email: this.recipientEmail,
            from_email: this.recipientEmail,
            job_name: formData.jobName,
            form_date: formData.date,
            supervisor_name: formData.attendees[0]?.name || 'Unknown',
            submission_time: new Date().toLocaleString('en-CA', { 
                timeZone: 'America/Edmonton',
                dateStyle: 'medium',
                timeStyle: 'short'
            }),
            // Complete form data for email body
            form_content: emailBody
        };

        console.log('📧 Sending email to:', this.recipientEmail);
        
        try {
            const response = await emailjs.send(
                this.serviceId,
                this.templateId,
                templateParams
            );
            
            console.log('✅ EmailJS response:', response);
            
            if (response.status !== 200) {
                throw new Error(`EmailJS returned status ${response.status}: ${response.text}`);
            }
            
            return response;
        } catch (error) {
            console.error('❌ EmailJS send error:', error);
            
            // Provide more helpful error messages
            if (error.text?.includes('rate limit')) {
                throw new Error('Email rate limit exceeded. Please wait a few minutes and try again.');
            } else if (error.text?.includes('Invalid')) {
                throw new Error('Email configuration error. Please check EmailJS settings.');
            } else {
                throw new Error(`Email send failed: ${error.text || error.message}`);
            }
        }
    }

    buildFormEmailBody(formData, filename) {
        // Build complete form content as plain text (EmailJS doesn't support HTML in free tier well)
        let body = '';
        
        body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        body += '   FIELD LEVEL HAZARD ASSESSMENT\n';
        body += '   Brazel Construction Ltd.\n';
        body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        
        body += '📋 JOB INFORMATION\n';
        body += '─────────────────────────────────────────\n';
        body += `Job: ${formData.jobName}\n`;
        body += `Date: ${formData.date}\n`;
        body += `Address: ${formData.address || 'Not specified'}\n`;
        if (formData.address2) {
            body += `Address Line 2: ${formData.address2}\n`;
        }
        body += `Emergency Phone: ${formData.emergencyPhone || 'Not specified'}\n`;
        body += `Muster Point: ${formData.musterPoint || 'Not specified'}\n`;
        body += `ERP Reviewed: ${formData.erpReviewed === 'yes' ? 'Yes' : 'No'}\n`;
        body += `Scope of Work: ${formData.scopeOfWork || 'Not specified'}\n\n`;
        
        // Hazards
        if (formData.hazardMatrix && formData.hazardMatrix.length > 0) {
            body += '⚠️  HAZARD ASSESSMENT MATRIX\n';
            body += '─────────────────────────────────────────\n';
            formData.hazardMatrix.forEach((item, index) => {
                body += `${index + 1}. ${item.hazard}\n`;
                body += `   Risk: ${item.risk} | Severity: ${item.severity}\n`;
                body += `   Controls: ${item.controls}\n\n`;
            });
        } else {
            body += '⚠️  HAZARD ASSESSMENT MATRIX\n';
            body += '─────────────────────────────────────────\n';
            body += 'No hazards identified\n\n';
        }
        
        // Safety Topics
        body += '💬 SAFETY MEETING TOPICS DISCUSSED\n';
        body += '─────────────────────────────────────────\n';
        if (formData.discussedTopics && formData.discussedTopics.length > 0) {
            formData.discussedTopics.forEach(topic => {
                body += `✓ ${topic.name}\n`;
            });
        } else {
            body += 'No topics selected\n';
        }
        body += '\n';
        
        if (formData.additionalTopics && formData.additionalTopics.trim()) {
            body += 'Additional Topics:\n';
            body += formData.additionalTopics + '\n\n';
        }
        
        if (formData.safetyMeeting && formData.safetyMeeting.trim()) {
            body += 'Safety Meeting Notes:\n';
            body += formData.safetyMeeting + '\n\n';
        }
        
        // Attendees
        body += '✍️  ATTENDEES & SIGNATURES\n';
        body += '─────────────────────────────────────────\n';
        if (formData.attendees && formData.attendees.length > 0) {
            formData.attendees.forEach((attendee, index) => {
                const role = index === 0 ? 'Supervisor' : 'Attendee';
                const signed = attendee.signature ? '✓ Signed' : '✗ Not signed';
                body += `${index + 1}. ${attendee.name} (${role}) - ${signed}\n`;
            });
        }
        body += '\n';
        
        // Photos
        if (formData.photos && formData.photos.length > 0) {
            body += '📷 PHOTOS\n';
            body += '─────────────────────────────────────────\n';
            body += `${formData.photos.length} photo(s) attached to form\n`;
            body += '(View in downloaded PDF)\n\n';
        }
        
        body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        body += `PDF File: ${filename}\n`;
        body += `Submitted: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Edmonton' })}\n`;
        body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        body += 'This form has been downloaded to the worker\'s device.\n';
        body += 'PDF backup is available on their device.\n';
        
        return body;
    }

    // Check if email is configured and working
    isConfigured() {
        return this.initialized && 
               !this.serviceId.startsWith('YOUR_') &&
               !this.templateId.startsWith('YOUR_') &&
               !this.publicKey.startsWith('YOUR_');
    }
}

// Create global instance
const emailSender = new EmailSender();

// Initialize on page load with better error handling
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing email sender...');
    try {
        const success = await emailSender.init();
        if (success) {
            console.log('✅ Email sender ready');
        } else {
            console.warn('⚠️ Email sender not available - PDFs will download only');
        }
    } catch (error) {
        console.error('❌ Email sender initialization error:', error);
    }
});
