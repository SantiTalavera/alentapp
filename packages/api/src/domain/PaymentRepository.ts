import { PaymentDTO, CreatePaymentRequest } from '@alentapp/shared';

export interface PaymentRepository {
    findByPeriod(member_id: string, month: number, year: number): Promise<PaymentDTO | null>;
    create(data: CreatePaymentRequest & { status: string; payment_date: string | null }): Promise<PaymentDTO>;
}
