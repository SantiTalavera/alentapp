import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';

export class GetPaymentByIdUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paymentValidator: PaymentValidator
    ) {}

    async execute(id: string): Promise<PaymentDTO> {
        this.paymentValidator.validateId(id);

        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

        return payment;
    }
}
