import { CreatePaymentRequest, PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';

export class CreatePaymentUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paymentValidator: PaymentValidator
    ) {}

    async execute(data: CreatePaymentRequest): Promise<PaymentDTO> {
        await this.paymentValidator.validateNewPayment(data);

        return this.paymentRepository.create({
            ...data,
            status: 'Pending',
            payment_date: null,
        });
    }
}
