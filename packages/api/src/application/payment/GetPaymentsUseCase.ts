import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';

export class GetPaymentsUseCase {
    constructor(private readonly paymentRepository: PaymentRepository) {}

    async execute(filters: { memberId?: string, status?: string, month?: number, year?: number }): Promise<PaymentDTO[]> {
        if (filters.status && !['Pending', 'Paid', 'Canceled'].includes(filters.status)) {
            throw new Error('Estado de pago no válido');
        }

        if (filters.memberId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.memberId)) {
            throw new Error('Formato de id de socio inválido');
        }

        if (filters.month !== undefined && (filters.month < 1 || filters.month > 12)) {
            throw new Error('Mes inválido');
        }

        return this.paymentRepository.findAll(filters);
    }
}
