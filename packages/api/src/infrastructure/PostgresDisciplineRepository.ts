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

    async findById(id: string): Promise<DisciplineDTO | null> {
        const discipline = await prisma.discipline.findUnique({
            where: { id },
        });

        return discipline ? this.mapToDTO(discipline) : null;
    }

    async findByMemberId(memberId: string): Promise<DisciplineDTO[]> {
        const disciplines = await prisma.discipline.findMany({
            where: {
                member_id: memberId,
            },
            orderBy: {
                start_date: 'desc',
            },
        });

        return disciplines.map((discipline) => this.mapToDTO(discipline));
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



    async update(
        id: string,
        discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>
    ): Promise<DisciplineDTO> {
        const updated = await prisma.discipline.update({
            where: { id },
            data: this.buildUpdateData(discipline),
        });

        return this.mapToDTO(updated);
    }

    //Se agrega este metodo para actualizar la disciplina y el estado del socio en una sola transaccion
    //Esto evita condiciones de carrera 
    async updateWithMemberStatus(
        id: string,
        discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>,
        memberId: string,
        memberStatus: MemberStatus
    ): Promise<DisciplineDTO> {
        return prisma.$transaction(async (tx) => {
            await tx.member.update({
                where: { id: memberId },
                data: { status: memberStatus },
            });

            const updated = await tx.discipline.update({
                where: { id },
                data: this.buildUpdateData(discipline),
            });

            return this.mapToDTO(updated);
        });
    }

    async delete(id: string): Promise<void> {
        await prisma.discipline.delete({
            where: { id },
        });
    }

    async deleteWithMemberStatus(
        id: string,
        memberId: string,
        memberStatus: MemberStatus
    ): Promise<void> {
        await prisma.$transaction(async (tx) => {
            await tx.discipline.delete({
                where: { id },
            });

            await tx.member.update({
                where: { id: memberId },
                data: { status: memberStatus },
            });
        });
    }
    
    //Se agrega este metodo helper para construir el objeto de actualizacion, 
    //permitiendo que solo se actualicen los campos que se enviaron
    private buildUpdateData(discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>) {
        return {
            ...(discipline.reason !== undefined && { reason: discipline.reason }),
            ...(discipline.start_date !== undefined && {
                start_date: new Date(discipline.start_date),
            }),
            ...(discipline.end_date !== undefined && {
                end_date: new Date(discipline.end_date),
            }),
            ...(discipline.is_total_suspension !== undefined && {
                is_total_suspension: discipline.is_total_suspension,
            }),
            ...(discipline.previous_member_status !== undefined && {
                previous_member_status: discipline.previous_member_status,
            }),
        };
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
