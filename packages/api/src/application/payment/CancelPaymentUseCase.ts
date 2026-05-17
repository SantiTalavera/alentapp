import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';

export class CancelPaymentUseCase {
    constructor(private readonly paymentRepository: PaymentRepository) {}

    async execute(id: string): Promise<PaymentDTO> {
        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

        if (payment.status === 'Canceled') {
            throw new Error('El pago ya se encuentra cancelado');
        }

        if (payment.status === 'Paid') {
            throw new Error('No se puede cancelar un pago ya efectuado');
        }

        return this.paymentRepository.cancel(id);
    }
}
