import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';

export class CancelPaymentUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paymentValidator: PaymentValidator
    ) {}

    async execute(id: string): Promise<PaymentDTO> {
        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

        this.paymentValidator.validateCancel(payment);

        return this.paymentRepository.cancel(id);
    }
}
