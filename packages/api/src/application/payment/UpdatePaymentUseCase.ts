import { PaymentDTO, UpdatePaymentRequest } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';

export class UpdatePaymentUseCase {
    constructor(private readonly paymentRepository: PaymentRepository) {}

    async execute(id: string, data: UpdatePaymentRequest): Promise<PaymentDTO> {
        if ('member_id' in data) {
            throw new Error('El campo member_id es inmutable');
        }

        if ('payment_date' in data) {
            throw new Error('No se acepta payment_date en el request');
        }

        if (data.amount !== undefined && data.amount <= 0) {
            throw new Error('Monto debe ser mayor a cero');
        }

        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new Error('Pago no encontrado');
        }

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

        const updatedData: Partial<PaymentDTO> = { ...data };

        if (data.status === 'Paid' && payment.status !== 'Paid') {
            updatedData.payment_date = new Date().toISOString();
        }

        return this.paymentRepository.update(id, updatedData);
    }
}
