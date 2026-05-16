import { PrismaPg } from '@prisma/adapter-pg';
import { DisciplineDTO, MemberStatus } from '@alentapp/shared';
import { DisciplineRepository } from '../domain/DisciplineRepository.js';
import { PrismaClient } from '../generated/client/client.js';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBDiscipline = {
    id: string;
    member_id: string;
    reason: string;
    start_date: Date;
    end_date: Date;
    is_total_suspension: boolean;
    previous_member_status: MemberStatus | null;
};

export class PostgresDisciplineRepository implements DisciplineRepository {
    async create(discipline: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO> {
        const created = await prisma.discipline.create({
            data: {
                member_id: discipline.member_id,
                reason: discipline.reason,
                start_date: new Date(discipline.start_date),
                end_date: new Date(discipline.end_date),
                is_total_suspension: discipline.is_total_suspension,
                previous_member_status: discipline.previous_member_status,
            },
        });

        return this.mapToDTO(created);
    }

    async findActiveTotalSuspensionsByMemberId(
        memberId: string,
        referenceDate = new Date()
    ): Promise<DisciplineDTO[]> {
        const disciplines = await prisma.discipline.findMany({
            where: {
                member_id: memberId,
                is_total_suspension: true,
                start_date: {
                    lte: referenceDate,
                },
                end_date: {
                    gte: referenceDate,
                },
            },
            orderBy: {
                start_date: 'desc',
            },
        });

        return disciplines.map((discipline) => this.mapToDTO(discipline));
    }

    private mapToDTO(discipline: DBDiscipline): DisciplineDTO {
        return {
            id: discipline.id,
            member_id: discipline.member_id,
            reason: discipline.reason,
            start_date: discipline.start_date.toISOString(),
            end_date: discipline.end_date.toISOString(),
            is_total_suspension: discipline.is_total_suspension,
            previous_member_status: discipline.previous_member_status as Exclude<MemberStatus, 'Suspendido'> | null,
        };
    }
}
