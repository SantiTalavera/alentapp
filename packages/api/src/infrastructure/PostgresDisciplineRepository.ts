import { DisciplineDTO, MemberStatus } from '@alentapp/shared';
import { DisciplineRepository } from '../domain/DisciplineRepository.js';
import { PrismaClient } from '../generated/client/client.js';

type PrismaDiscipline = Awaited<
    ReturnType<PrismaClient['discipline']['findFirst']>
>;

export class PostgresDisciplineRepository implements DisciplineRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(discipline: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO> {
        const created = await this.prisma.discipline.create({
            data: {
                member_id: discipline.member_id,
                reason: discipline.reason,
                start_date: new Date(discipline.start_date),
                end_date: new Date(discipline.end_date),
                is_total_suspension: discipline.is_total_suspension,
                previous_member_status: discipline.previous_member_status as MemberStatus | null,
            },
        });

        return this.mapToDTO(created);
    }

    async findActiveTotalSuspensionsByMemberId(
        memberId: string,
        referenceDate = new Date()
    ): Promise<DisciplineDTO[]> {
        const disciplines = await this.prisma.discipline.findMany({
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

    private mapToDTO(discipline: NonNullable<PrismaDiscipline>): DisciplineDTO {
        return {
            id: discipline.id,
            member_id: discipline.member_id,
            reason: discipline.reason,
            start_date: discipline.start_date.toISOString(),
            end_date: discipline.end_date.toISOString(),
            is_total_suspension: discipline.is_total_suspension,
            previous_member_status: discipline.previous_member_status,
        };
    }
}
