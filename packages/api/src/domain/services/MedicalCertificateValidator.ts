import { CreateMedicalCertificateRequest } from '@alentapp/shared';

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
}
