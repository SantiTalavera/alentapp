import { CreatePaymentRequest, PaymentDTO, UpdatePaymentRequest } from '@alentapp/shared';
import { PaymentRepository } from '../PaymentRepository.js';
import { MemberRepository } from '../MemberRepository.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PaymentValidator {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly memberRepository: MemberRepository
    ) {}

    validateId(id: string): void {
        if (!UUID_REGEX.test(id)) {
            throw new Error('Formato de id inválido');
        }
    }

    validateCreateRequest(data: CreatePaymentRequest): void {
        if (!data.member_id) {
            throw new Error('Campo requerido: member_id');
        }
        if (data.amount === undefined || data.amount === null) {
            throw new Error('Campo requerido: amount');
        }
        if (data.month === undefined || data.month === null) {
            throw new Error('Campo requerido: month');
        }
        if (data.year === undefined || data.year === null) {
            throw new Error('Campo requerido: year');
        }
        if (!data.due_date) {
            throw new Error('Campo requerido: due_date');
        }

        if (data.amount <= 0) {
            throw new Error('Monto debe ser mayor a cero');
        }

        if (data.month < 1 || data.month > 12) {
            throw new Error('Mes inválido');
        }
    }

    async validateNewPayment(data: CreatePaymentRequest): Promise<void> {
        this.validateCreateRequest(data);

        const member = await this.memberRepository.findById(data.member_id);
        if (!member) {
            throw new Error('Socio no encontrado');
        }

        const existingPayment = await this.paymentRepository.findByPeriod(
            data.member_id,
            data.month,
            data.year
        );
        if (existingPayment) {
            throw new Error('Ya existe un pago para este período');
        }
    }

    validateFilters(filters: {
        memberId?: string;
        status?: string;
        month?: number;
        year?: number;
    }): void {
        if (filters.status && !['Pending', 'Paid', 'Canceled'].includes(filters.status)) {
            throw new Error('Estado de pago no válido');
        }

        if (filters.memberId && !UUID_REGEX.test(filters.memberId)) {
            throw new Error('Formato de id de socio inválido');
        }

        if (filters.month !== undefined && (filters.month < 1 || filters.month > 12)) {
            throw new Error('Mes inválido');
        }
    }

    validateUpdateRequest(data: UpdatePaymentRequest): void {
        if ('member_id' in data) {
            throw new Error('El campo member_id es inmutable');
        }

        if ('payment_date' in data) {
            throw new Error('No se acepta payment_date en el request');
        }

        if (data.amount !== undefined && data.amount <= 0) {
            throw new Error('Monto debe ser mayor a cero');
        }
    }

    validateUpdateTransition(payment: PaymentDTO, data: UpdatePaymentRequest): void {
        if (payment.status === 'Paid') {
            if (data.status === 'Paid') {
                throw new Error('El pago ya fue registrado como pagado');
            }
            if (data.status === 'Canceled') {
                throw new Error('Transición de estado no permitida');
            }
            if (data.amount !== undefined || data.due_date !== undefined) {
                throw new Error('El pago no puede modificarse en su estado actual');
            }
        }

        if (payment.status === 'Canceled' && data.status !== undefined) {
            throw new Error('Transición de estado no permitida');
        }
    }

    validateCancel(payment: PaymentDTO): void {
        if (payment.status === 'Canceled') {
            throw new Error('El pago ya se encuentra cancelado');
        }

        if (payment.status === 'Paid') {
            throw new Error('No se puede cancelar un pago ya efectuado');
        }
    }
}
