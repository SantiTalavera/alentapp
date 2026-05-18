import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, LoanStatus as PrismaLoanStatus } from '../generated/client/client.js';
import { EquipmentLoanRepository } from '../domain/EquipmentLoanRepository.js';
import { EquipmentLoanDTO, LoanStatus } from '@alentapp/shared';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBEquipmentLoan = {
    id: string;
    item_name: string;
    status: PrismaLoanStatus;
    loan_date: Date;
    due_date: Date | null;
    member_id: string;
    deleted_at: Date | null;
};

const STATUS_MAP: Record<PrismaLoanStatus, LoanStatus> = {
    Prestado: 'Prestado',
    Devuelto: 'Devuelto',
    Dañado: 'Dañado',
};

export class PostgresEquipmentLoanRepository implements EquipmentLoanRepository {
    async create(
        data: Pick<EquipmentLoanDTO, 'item_name' | 'due_date' | 'member_id'>,
    ): Promise<EquipmentLoanDTO> {
        const row = await prisma.equipmentLoan.create({
            data: {
                item_name: data.item_name,
                member_id: data.member_id,
                ...(data.due_date != null && { due_date: new Date(data.due_date) }),
            },
        });
        return this.mapToDTO(row);
    }

    async findById(id: string): Promise<EquipmentLoanDTO | null> {
        const row = await prisma.equipmentLoan.findFirst({
            where: {
                id,
                deleted_at: null,
            },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async findAll(filters?: { memberId?: string }): Promise<EquipmentLoanDTO[]> {
        const rows = await prisma.equipmentLoan.findMany({
            where: {
                deleted_at: null,
                ...(filters?.memberId !== undefined && { member_id: filters.memberId }),
            },
            orderBy: { loan_date: 'desc' },
        });
        return rows.map((row) => this.mapToDTO(row));
    }

    async update(
        id: string,
        data: Partial<Pick<EquipmentLoanDTO, 'status' | 'due_date'>>,
    ): Promise<EquipmentLoanDTO> {
        const row = await prisma.equipmentLoan.update({
            where: { id },
            data: {
                ...(data.status && { status: data.status as PrismaLoanStatus }),
                ...(data.due_date !== undefined && { due_date: data.due_date ? new Date(data.due_date) : null }),
            },
        });
        return this.mapToDTO(row);
    }

    async softDelete(id: string): Promise<EquipmentLoanDTO> {
        throw new Error(`softDelete not implemented yet (id: ${id})`);
    }

    private mapToDTO(row: DBEquipmentLoan): EquipmentLoanDTO {
        return {
            id: row.id,
            item_name: row.item_name,
            status: STATUS_MAP[row.status],
            loan_date: row.loan_date.toISOString(),
            due_date: row.due_date ? row.due_date.toISOString() : null,
            member_id: row.member_id,
            deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
        };
    }
}
