import { CreateDisciplineRequest, MemberStatus } from '@alentapp/shared';

export class DisciplineValidator {
    validateCreateRequest(data: CreateDisciplineRequest): void {
        this.validateMemberId(data.member_id);
        this.validateReason(data.reason);
        this.validateDateRequired(data.start_date, 'La fecha de inicio es requerida');
        this.validateDateRequired(data.end_date, 'La fecha de fin es requerida');
        this.validateDateRange(data.start_date, data.end_date);
        this.validateIsTotalSuspension(data.is_total_suspension);
    }

    validateMemberId(memberId: string): void {
        if (!memberId || memberId.trim() === '') {
            throw new Error('El socio es requerido');
        }
    }

    validateReason(reason: string): void {
        if (!reason || reason.trim() === '') {
            throw new Error('El motivo de la disciplina es requerido');
        }
    }

    validateDateRequired(value: string, message: string): void {
        if (!value || value.trim() === '') {
            throw new Error(message);
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new Error(message);
        }
    }

    validateDateRange(startDate: string, endDate: string): void {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
    }

    validateIsTotalSuspension(value: boolean): void {
        if (typeof value !== 'boolean') {
            throw new Error('El campo suspensión total debe ser verdadero o falso');
        }
    }

    validatePreviousMemberStatus(status: MemberStatus | null): void {
        if (status === 'Suspendido') {
            throw new Error('El estado previo del socio debe ser Activo o Moroso');
        }
    }

    isActive(startDate: string | Date, endDate: string | Date, referenceDate = new Date()): boolean {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return start <= referenceDate && end >= referenceDate;
    }
}
