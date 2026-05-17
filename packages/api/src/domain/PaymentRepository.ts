import { PaymentDTO, CreatePaymentRequest } from '@alentapp/shared';

export interface PaymentRepository {
    findAll(filters?: { memberId?: string, status?: string, month?: number, year?: number }): Promise<PaymentDTO[]>;
    findById(id: string): Promise<PaymentDTO | null>;
    findByPeriod(member_id: string, month: number, year: number): Promise<PaymentDTO | null>;
    create(data: CreatePaymentRequest & { status: string; payment_date: string | null }): Promise<PaymentDTO>;
    update(id: string, data: Partial<PaymentDTO>): Promise<PaymentDTO>;
}
