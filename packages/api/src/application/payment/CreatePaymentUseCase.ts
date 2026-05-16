import { CreatePaymentRequest, PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';

export class CreatePaymentUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly memberRepository: MemberRepository
    ) {}

    async execute(data: CreatePaymentRequest): Promise<PaymentDTO> {
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

        const member = await this.memberRepository.findById(data.member_id);
        if (!member) {
            throw new Error('Socio no encontrado');
        }

        const existingPayment = await this.paymentRepository.findByPeriod(data.member_id, data.month, data.year);
        if (existingPayment) {
            throw new Error('Ya existe un pago para este período');
        }

        return this.paymentRepository.create({
            ...data,
            status: 'Pending',
            payment_date: null,
        });
    }
}
