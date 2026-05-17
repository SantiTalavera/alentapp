import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import {
    EnrollmentFilters,
    EnrollmentRepository,
} from '../domain/EnrollmentRepository.js';
import {
    CreateEnrollmentRequest,
    EnrollmentDTO,
    UpdateEnrollmentRequest,
} from '@alentapp/shared';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBEnrollment = {
    id: string;
    member_id: string;
    sport_id: string;
    enrollment_date: Date;
    is_active: boolean;
    deleted_at: Date | null;
};

export class PostgresEnrollmentRepository implements EnrollmentRepository {
    async create(data: CreateEnrollmentRequest): Promise<EnrollmentDTO> {
        const row = await prisma.enrollment.create({
            data: {
                member_id: data.member_id,
                sport_id: data.sport_id,
            },
        });
        return this.mapToDTO(row);
    }

    async findById(id: string): Promise<EnrollmentDTO | null> {
        const row = await prisma.enrollment.findUnique({
            where: { id },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async findAll(filters?: EnrollmentFilters): Promise<EnrollmentDTO[]> {
        const rows = await prisma.enrollment.findMany({
            where: {
                deleted_at: null,
                ...(filters?.memberId !== undefined && {
                    member_id: filters.memberId,
                }),
                ...(filters?.sportId !== undefined && {
                    sport_id: filters.sportId,
                }),
                ...(filters?.isActive !== undefined && {
                    is_active: filters.isActive,
                }),
            },
            orderBy: { enrollment_date: 'desc' },
        });
        return rows.map((row) => this.mapToDTO(row));
    }

    async findActiveByMemberAndSport(
        member_id: string,
        sport_id: string
    ): Promise<EnrollmentDTO | null> {
        const row = await prisma.enrollment.findFirst({
            where: {
                member_id,
                sport_id,
                is_active: true,
                deleted_at: null,
            },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async countActiveBySportId(sport_id: string): Promise<number> {
        return prisma.enrollment.count({
            where: {
                sport_id,
                is_active: true,
                deleted_at: null,
            },
        });
    }

    async update(
        id: string,
        data: UpdateEnrollmentRequest
    ): Promise<EnrollmentDTO> {
        const updated = await prisma.enrollment.update({
            where: { id },
            data: {
                ...(data.is_active !== undefined && {
                    is_active: data.is_active,
                }),
            },
        });
        return this.mapToDTO(updated);
    }

    async softDelete(id: string): Promise<EnrollmentDTO> {
        const updated = await prisma.enrollment.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                is_active: false,
            },
        });
        return this.mapToDTO(updated);
    }

    private mapToDTO(row: DBEnrollment): EnrollmentDTO {
        return {
            id: row.id,
            member_id: row.member_id,
            sport_id: row.sport_id,
            enrollment_date: row.enrollment_date.toISOString(),
            is_active: row.is_active,
            deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
        };
    }
}
