import { PaymentDTO } from '@alentapp/shared';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';

export class GetPaymentsUseCase {
    constructor(
        private readonly paymentRepository: PaymentRepository,
        private readonly paymentValidator: PaymentValidator
    ) {}

    async execute(filters: {
        memberId?: string;
        status?: string;
        month?: number;
        year?: number;
    }): Promise<PaymentDTO[]> {
        this.paymentValidator.validateFilters(filters);

        return this.paymentRepository.findAll(filters);
    }
}
