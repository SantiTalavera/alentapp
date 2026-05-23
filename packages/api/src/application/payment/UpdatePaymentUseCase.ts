import { PaymentDTO, UpdatePaymentRequest } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';

export class UpdatePaymentUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paymentValidator: PaymentValidator
    ) {}

    async execute(id: string, data: UpdatePaymentRequest): Promise<PaymentDTO> {
        this.paymentValidator.validateUpdateRequest(data);

        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

        this.paymentValidator.validateUpdateTransition(payment, data);

        const updatedData: Partial<PaymentDTO> = { ...data };

        if (data.status === 'Paid' && payment.status !== 'Paid') {
            updatedData.payment_date = new Date().toISOString();
        }

        return this.paymentRepository.update(id, updatedData);
    }
}
