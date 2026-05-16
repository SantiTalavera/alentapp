import { CreateMedicalCertificateRequest, UpdateMedicalCertificateRequest } from '@alentapp/shared';

export class MedicalCertificateValidator {
    validateCreateRequest(data: CreateMedicalCertificateRequest): void {
        this.validateMemberId(data.member_id);
        this.validateDoctorLicense(data.doctor_license);
        
        const issueDate = this.validateDate(data.issue_date, 'emisión');
        const expiryDate = this.validateDate(data.expiry_date, 'vencimiento');
        
        this.validateDatesLogical(issueDate, expiryDate);
    }

    validateMemberId(memberId: unknown): void {
        if (typeof memberId !== 'string' || memberId.trim() === '') {
            throw new Error('El socio es requerido');
        }
    }

    validateDoctorLicense(license: unknown): void {
        if (typeof license !== 'string' || license.trim() === '') {
            throw new Error('La matrícula del médico es requerida');
        }
    }

    validateDate(dateString: unknown, fieldName: string): Date {
        if (typeof dateString !== 'string' || dateString.trim() === '') {
            throw new Error(`La fecha de ${fieldName} es requerida`);
        }
        
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            throw new Error('Las fechas proporcionadas no son válidas');
        }
        return date;
    }

    validateDatesLogical(issueDate: Date, expiryDate: Date): void {
        if (expiryDate <= issueDate) {
            throw new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión');
        }
    }

    validateUpdateRequest(data: UpdateMedicalCertificateRequest & Record<string, unknown>): void {
        if (!data || Object.keys(data).length === 0) {
            throw new Error('Se debe enviar al menos un campo para actualizar');
        }

        if ('member_id' in data) {
            throw new Error('El socio titular del certificado no puede modificarse');
        }

        const allowedFields = ['issue_date', 'expiry_date', 'doctor_license'];
        const hasAllowedField = Object.keys(data).some((key) => allowedFields.includes(key));

        if (!hasAllowedField) {
            throw new Error('Se debe enviar al menos un campo para actualizar');
        }

        if (data.issue_date !== undefined) {
            this.validateDate(data.issue_date, 'emisión');
        }

        if (data.expiry_date !== undefined) {
            this.validateDate(data.expiry_date, 'vencimiento');
        }

        if (data.doctor_license !== undefined) {
            this.validateDoctorLicense(data.doctor_license);
        }
    }

    validateResultingDateRange(issueDateStr: string, expiryDateStr: string): void {
        const issueDate = new Date(issueDateStr);
        const expiryDate = new Date(expiryDateStr);
        this.validateDatesLogical(issueDate, expiryDate);
    }
}
