// PDF Generator for Hazard Assessment Forms
class PDFGenerator {
    constructor() {
        this.logo = null;
    }

    setLogo(logoDataUrl) {
        this.logo = logoDataUrl;
    }

    async generateHazardAssessmentPDF(formData) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let y = 20;
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - (margin * 2);

        // Add red header box with white text
        doc.setFillColor(220, 53, 69); // Red color (#dc3545)
        doc.rect(margin, y, maxWidth, 16, 'F'); // Filled rectangle
        
        // Add company name in white
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255); // White text
        doc.setFont(undefined, 'bold');
        doc.text('Brazel Construction Ltd.', pageWidth / 2, y + 11, { align: 'center' });
        
        y += 20;
        
        // Reset text color to black for rest of document
        doc.setTextColor(0, 0, 0);

        // Emergency Contact
        doc.setFontSize(10);
        doc.setTextColor(231, 76, 60); // Red color
        doc.text('Emergency Contact: Aaron Brazel', margin, y);
        y += 5;
        doc.text('(403) 669-2900', margin, y);
        y += 10;

        // Title
        doc.setFontSize(18);
        doc.setTextColor(44, 62, 80);
        doc.setFont(undefined, 'bold');
        doc.text('FIELD LEVEL HAZARD ASSESSMENT', margin, y);
        y += 12;

        // Separator line
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // Form Information
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('FORM INFORMATION', margin, y);
        y += 7;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        // Job details
        y = this.addField(doc, 'Date:', formData.date, margin, y, maxWidth);
        y = this.addField(doc, 'Job:', formData.jobName, margin, y, maxWidth);
        y = this.addField(doc, 'Address:', formData.address, margin, y, maxWidth);
        if (formData.address2) {
            y = this.addField(doc, 'Address Line 2:', formData.address2, margin, y, maxWidth);
        }
        y = this.addField(doc, 'Emergency Phone:', formData.emergencyPhone, margin, y, maxWidth);
        y = this.addField(doc, 'Muster Point:', formData.musterPoint, margin, y, maxWidth);
        y = this.addField(doc, 'Emergency Response Plan Reviewed:', formData.erpReviewed, margin, y, maxWidth);
        y += 5;

        // Scope of Work
        doc.setFont(undefined, 'bold');
        doc.text('Scope of Work:', margin, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        y = this.addWrappedText(doc, formData.scopeOfWork, margin, y, maxWidth);
        y += 8;

        // Check if we need a new page
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        // Identified Hazards
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('IDENTIFIED HAZARDS', margin, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        if (formData.selectedHazards && formData.selectedHazards.length > 0) {
            formData.selectedHazards.forEach(hazard => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text('☑ ' + hazard, margin + 5, y);
                y += 5;
            });
        }
        y += 5;

        // Hazard Assessment Matrix
        if (y > 220) {
            doc.addPage();
            y = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('HAZARD ASSESSMENT MATRIX', margin, y);
        y += 7;

        // Matrix entries
        if (formData.hazardMatrix && formData.hazardMatrix.length > 0) {
            formData.hazardMatrix.forEach((item, index) => {
                if (y > 240) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFont(undefined, 'bold');
                doc.setFontSize(10);
                doc.text(`${index + 1}. ${item.hazard}`, margin, y);
                y += 6;

                doc.setFont(undefined, 'normal');
                doc.setFontSize(9);
                
                // Risk and Severity badges
                doc.text(`Risk: ${item.risk} | Severity: ${item.severity}`, margin + 5, y);
                y += 5;

                // Separator
                doc.setLineWidth(0.3);
                doc.line(margin + 5, y, pageWidth - margin, y);
                y += 5;

                // Corrective Action
                doc.setFont(undefined, 'bold');
                doc.text('Corrective Action:', margin + 5, y);
                y += 5;
                doc.setFont(undefined, 'normal');
                y = this.addWrappedText(doc, item.controls || 'Not specified', margin + 5, y, maxWidth - 5);
                y += 8;
            });
        }

        // Safety Topics Discussed
        if (y > 240) {
            doc.addPage();
            y = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('SAFETY MEETING TOPICS DISCUSSED', margin, y);
        y += 7;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        if (formData.discussedTopics && formData.discussedTopics.length > 0) {
            formData.discussedTopics.forEach(topic => {
                doc.text('✓ ' + topic.name, margin + 5, y);
                y += 6;
            });
        } else {
            doc.text('No topics selected', margin, y);
            y += 6;
        }
        
        y += 5;

        // Additional Topics
        if (formData.additionalTopics && formData.additionalTopics.trim()) {
            doc.setFont(undefined, 'bold');
            doc.setFontSize(10);
            doc.text('Additional Topics:', margin, y);
            y += 6;
            
            doc.setFont(undefined, 'normal');
            y = this.addWrappedText(doc, formData.additionalTopics, margin, y, maxWidth);
            y += 5;
        }

        // Safety Meeting Notes
        if (formData.safetyMeeting && formData.safetyMeeting.trim()) {
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            doc.setFont(undefined, 'bold');
            doc.setFontSize(10);
            doc.text('Safety Meeting Notes:', margin, y);
            y += 6;

            doc.setFont(undefined, 'normal');
            y = this.addWrappedText(doc, formData.safetyMeeting, margin, y, maxWidth);
        }
        
        y += 8;

        // Attendees
        if (y > 220) {
            doc.addPage();
            y = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('ATTENDEES', margin, y);
        y += 7;

        if (formData.attendees && formData.attendees.length > 0) {
            formData.attendees.forEach((attendee, index) => {
                if (y > 260) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                
                const label = index === 0 ? 'Supervisor: ' : `Attendee ${index}: `;
                doc.text(label + attendee.name, margin, y);
                
                // Add signature if available
                if (attendee.signature) {
                    try {
                        y += 5;
                        doc.addImage(attendee.signature, 'PNG', margin + 5, y, 40, 15);
                        y += 18;
                    } catch (e) {
                        y += 5;
                        console.error('Error adding signature:', e);
                    }
                } else {
                    y += 5;
                }
            });
        }
        y += 5;

        // Photos
        if (formData.photos && formData.photos.length > 0) {
            if (y > 200) {
                doc.addPage();
                y = 20;
            }

            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text('PHOTOS', margin, y);
            y += 7;

            for (let i = 0; i < formData.photos.length; i++) {
                if (y > 200) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                doc.text(`Photo ${i + 1}:`, margin, y);
                y += 5;

                try {
                    const imgWidth = maxWidth;
                    const imgHeight = 80;
                    doc.addImage(formData.photos[i], 'JPEG', margin, y, imgWidth, imgHeight);
                    y += imgHeight + 10;
                } catch (e) {
                    console.error('Error adding photo:', e);
                    y += 5;
                }
            }
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(127, 140, 141);
        const footer = `Form generated by Brazel Safety System | Submitted: ${new Date().toLocaleString()}`;
        doc.text(footer, margin, doc.internal.pageSize.getHeight() - 10);

        return doc;
    }

    addField(doc, label, value, x, y, maxWidth) {
        doc.setFont(undefined, 'bold');
        doc.text(label, x, y);
        doc.setFont(undefined, 'normal');
        
        const labelWidth = doc.getTextWidth(label);
        const valueX = x + labelWidth + 3;
        const remainingWidth = maxWidth - labelWidth - 3;
        
        const lines = doc.splitTextToSize(value || 'N/A', remainingWidth);
        doc.text(lines, valueX, y);
        
        return y + (lines.length * 5);
    }

    addWrappedText(doc, text, x, y, maxWidth) {
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach(line => {
            doc.text(line, x, y);
            y += 5;
        });
        return y;
    }

    // Wrap helper for paragraphs
    writeWrappedText(doc, text, x, y, maxWidth, lineHeight) {
        const t = (text || '').toString();
        const lines = doc.splitTextToSize(t, maxWidth);
        for (const ln of lines) {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(ln, x, y);
            y += lineHeight;
        }
        return y;
    }

    async renderPhotoSection(doc, photos, startY) {
        let y = startY;
        const list = Array.isArray(photos) ? photos : [];
        if (!list.length) return y;

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Photos', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');

        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p || !p.dataUrl) continue;
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(10);
            doc.text(`Photo ${i+1}`, 14, y);
            y += 4;
            try {
                doc.addImage(p.dataUrl, 'JPEG', 14, y, 180, 120);
                y += 128;
            } catch (e) {
                console.warn('Photo addImage failed', e);
                y += 6;
            }
        }
        return y;
    }

    async generateIncidentPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 18;

        doc.setFillColor(220, 53, 69);
        doc.rect(14, 12, 182, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text('INCIDENT / NEAR MISS REPORT', 105, 21, { align: 'center' });

        y = 34;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        const topLines = [
            `Date: ${data.date || ''} ${data.time ? (' ' + data.time) : ''}`,
            `Job: ${data.jobName || ''}`,
            `Location: ${data.location || ''}`,
            `Reported by: ${data.reporter || ''}`,
            `Supervisor: ${data.supervisor || ''}`,
            `Type: ${data.incidentType || ''}`,
            `Classification: ${data.classification || ''}`,
            `Reported to Alberta OHS: ${data.reportedToOHS || ''}`,
            `Injury: ${data.injury || 'No'}`,
            `Involved worker: ${data.involvedWorker || ''}`,
            `Equipment: ${data.equipment || ''}`
        ];
        for (const line of topLines) {
            y = this.writeWrappedText(doc, line, 14, y, 180, 6);
        }

        y += 3;
        doc.setFont(undefined, 'bold');
        doc.text('What happened?', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        y = this.writeWrappedText(doc, data.description || '', 14, y, 180, 6);

        y += 4;
        doc.setFont(undefined, 'bold');
        doc.text('Immediate actions taken', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        y = this.writeWrappedText(doc, data.actions || '', 14, y, 180, 6);

        if (data.rootCauses) {
            y += 4;
            doc.setFont(undefined, 'bold');
            doc.text('Root cause(s)', 14, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            y = this.writeWrappedText(doc, data.rootCauses, 14, y, 180, 6);
        }

        if (data.correctiveActions) {
            y += 4;
            doc.setFont(undefined, 'bold');
            doc.text('Corrective actions', 14, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            y = this.writeWrappedText(doc, data.correctiveActions, 14, y, 180, 6);
        }

        if (data.witnesses) {
            y += 4;
            doc.setFont(undefined, 'bold');
            doc.text('Witnesses', 14, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            y = this.writeWrappedText(doc, data.witnesses, 14, y, 180, 6);
        }

        y = await this.renderPhotoSection(doc, data.photos, y + 4);

        if (data.signature) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFont(undefined, 'bold');
            doc.text('Signature', 14, y);
            y += 4;
            try {
                doc.addImage(data.signature, 'PNG', 14, y, 80, 30);
            } catch (e) {
                console.warn('Signature addImage failed', e);
            }
        }

        return doc;
    }

    async generateInspectionPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 18;

        doc.setFillColor(220, 53, 69);
        doc.rect(14, 12, 182, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text('WORKSITE INSPECTION REPORT', 105, 21, { align: 'center' });

        y = 34;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        y = this.writeWrappedText(doc, `Date: ${data.date || ''}`, 14, y, 180, 6);
        y = this.writeWrappedText(doc, `Job: ${data.jobName || ''}`, 14, y, 180, 6);
        y = this.writeWrappedText(doc, `Inspector: ${data.inspector || ''}`, 14, y, 180, 6);

        y += 4;
        doc.setFont(undefined, 'bold');
        doc.text('Checklist', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        const checklist = Array.isArray(data.checklist) ? data.checklist : [];
        for (const item of checklist) {
            const line = `${item.label || item.key}: ${item.status || ''}${item.note ? ' — ' + item.note : ''}`;
            y = this.writeWrappedText(doc, line, 14, y, 180, 5);
        }

        y += 4;
        doc.setFont(undefined, 'bold');
        doc.text('Findings / Corrective Actions', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        const findings = Array.isArray(data.findings) ? data.findings : [];
        if (!findings.length) {
            y = this.writeWrappedText(doc, 'None recorded.', 14, y, 180, 5);
        } else {
            let i = 1;
            for (const f of findings) {
                const line = `${i}. ${f.finding || ''} | Action: ${f.action || ''} | Owner: ${f.owner || ''} | Due: ${f.due || ''}`;
                y = this.writeWrappedText(doc, line, 14, y, 180, 5);
                i += 1;
            }
        }

        y = await this.renderPhotoSection(doc, data.photos, y + 4);

        if (data.signature) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFont(undefined, 'bold');
            doc.text('Signature', 14, y);
            y += 4;
            try {
                doc.addImage(data.signature, 'PNG', 14, y, 80, 30);
            } catch (e) {
                console.warn('Signature addImage failed', e);
            }
        }

        return doc;
    }

    // Generate filename based on job, date, and supervisor
    generateFilename(jobName, date, supervisorName) {
        const cleanJobName = jobName.replace(/[^a-z0-9]/gi, '-');
        const cleanSupervisor = supervisorName.replace(/[^a-z0-9]/gi, '-');
        return `${cleanJobName}-${date}-${cleanSupervisor}.pdf`;
    }
}

// Create global instance
const pdfGenerator = new PDFGenerator();
