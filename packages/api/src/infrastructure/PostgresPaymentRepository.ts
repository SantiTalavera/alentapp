import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { PaymentRepository } from '../domain/PaymentRepository.js';
import { PaymentDTO, CreatePaymentRequest } from '@alentapp/shared';
import { Prisma } from '../generated/client/client.js';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBPayment = {
    id: string;
    amount: number;
    month: number;
    year: number;
    due_date: Date;
    status: string;
    payment_date: Date | null;
    member_id: string;
};

export class PostgresPaymentRepository implements PaymentRepository {
    async findAll(filters?: { memberId?: string, status?: string, month?: number, year?: number }): Promise<PaymentDTO[]> {
        const whereClause: any = {};
        
        if (filters?.memberId) whereClause.member_id = filters.memberId;
        if (filters?.status) whereClause.status = filters.status;
        if (filters?.month !== undefined) whereClause.month = filters.month;
        if (filters?.year !== undefined) whereClause.year = filters.year;

        const payments = await prisma.payment.findMany({
            where: whereClause,
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
        });

        return payments.map(p => this.mapToDTO(p));
    }

    async findById(id: string): Promise<PaymentDTO | null> {
        const payment = await prisma.payment.findUnique({
            where: { id }
        });

        if (!payment) return null;
        return this.mapToDTO(payment);
    }

    async findByPeriod(member_id: string, month: number, year: number): Promise<PaymentDTO | null> {
        const row = await prisma.payment.findUnique({
            where: {
                member_id_month_year: {
                    member_id,
                    month,
                    year,
                },
            },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async create(data: CreatePaymentRequest & { status: string; payment_date: string | null }): Promise<PaymentDTO> {
        try {
            const created = await prisma.payment.create({
                data: {
                    member_id: data.member_id,
                    amount: data.amount,
                    month: data.month,
                    year: data.year,
                    due_date: new Date(data.due_date),
                    status: data.status,
                    payment_date: data.payment_date ? new Date(data.payment_date) : null,
                },
            });
            return this.mapToDTO(created);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new Error('Ya existe un pago para este período');
                }
            }
            throw error;
        }
    }

    async update(id: string, data: Partial<PaymentDTO>): Promise<PaymentDTO> {
        const updateData: any = {};
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.due_date !== undefined) updateData.due_date = new Date(data.due_date);
        if (data.status !== undefined) updateData.status = data.status;
        if (data.payment_date !== undefined) updateData.payment_date = data.payment_date ? new Date(data.payment_date) : null;

        const updated = await prisma.payment.update({
            where: { id },
            data: updateData
        });
        return this.mapToDTO(updated);
    }

    private mapToDTO(row: DBPayment): PaymentDTO {
        return {
            id: row.id,
            member_id: row.member_id,
            amount: row.amount,
            month: row.month,
            year: row.year,
            due_date: row.due_date.toISOString(),
            status: row.status as 'Pending' | 'Paid' | 'Canceled',
            payment_date: row.payment_date ? row.payment_date.toISOString() : null,
        };
    }
}
