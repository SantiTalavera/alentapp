import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { LockerRepository } from '../domain/LockerRepository.js';
import { LockerDTO, LockerStatus } from '@alentapp/shared';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBLocker = {
    id: string;
    number: number;
    location: string;
    status: 'Available' | 'Occupied' | 'Maintenance';
    member_id: string | null;
    is_active: boolean;
};

export class PostgresLockerRepository implements LockerRepository {
    async create(locker: Omit<LockerDTO, 'id'>): Promise<LockerDTO> {
        const created = await prisma.locker.create({
            data: {
                number: locker.number,
                location: locker.location,
                status: locker.status,
                member_id: locker.member_id,
                is_active: locker.is_active,
            },
        });
        return this.mapToDTO(created as DBLocker);
    }

    async findByNumber(number: number): Promise<LockerDTO | null> {
        const row = await prisma.locker.findUnique({
            where: { number },
        });
        return row ? this.mapToDTO(row as DBLocker) : null;
    }

    private mapToDTO(row: DBLocker): LockerDTO {
        return {
            id: row.id,
            number: row.number,
            location: row.location,
            status: row.status as LockerStatus,
            member_id: row.member_id,
            is_active: row.is_active,
        };
    }
}
