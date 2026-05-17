import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';

export class GetPaymentByIdUseCase {
    constructor(private readonly paymentRepository: PaymentRepository) {}

    async execute(id: string): Promise<PaymentDTO> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            throw new Error('Formato de id inválido');
        }

        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

        return payment;
    }
}
