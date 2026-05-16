import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { SportRepository } from '../domain/SportRepository.js';
import { SportDTO, UpdateSportRequest } from '@alentapp/shared';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBSport = {
    id: string;
    name: string;
    description: string;
    max_capacity: number;
    additional_price: number;
    requires_medical_certificate: boolean;
    deleted_at: Date | null;
};

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
    );
}

export class PostgresSportRepository implements SportRepository {
    async create(sport: Omit<SportDTO, 'id'>): Promise<SportDTO> {
        try {
            const created = await prisma.sport.create({
                data: {
                    name: sport.name,
                    description: sport.description,
                    max_capacity: sport.max_capacity,
                    additional_price: sport.additional_price,
                    requires_medical_certificate: sport.requires_medical_certificate,
                    deleted_at: null,
                },
            });
            return this.mapToDTO(created);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new Error('Ya existe un deporte con ese nombre');
            }
            throw error;
        }
    }

    async findByName(name: string): Promise<SportDTO | null> {
        const row = await prisma.sport.findUnique({
            where: { name },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async findAll(): Promise<SportDTO[]> {
        const rows = await prisma.sport.findMany({
            where: { deleted_at: null },
            orderBy: { name: 'asc' },
        });
        return rows.map((row) => this.mapToDTO(row));
    }

    async findById(id: string): Promise<SportDTO | null> {
        const row = await prisma.sport.findUnique({
            where: { id },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async update(id: string, data: UpdateSportRequest): Promise<SportDTO> {
        const patch: {
            description?: string;
            max_capacity?: number;
            additional_price?: number;
            requires_medical_certificate?: boolean;
        } = {};
        if (data.description !== undefined) {
            patch.description = data.description;
        }
        if (data.max_capacity !== undefined) {
            patch.max_capacity = data.max_capacity;
        }
        if (data.additional_price !== undefined) {
            patch.additional_price = data.additional_price;
        }
        if (data.requires_medical_certificate !== undefined) {
            patch.requires_medical_certificate = data.requires_medical_certificate;
        }

        const updated = await prisma.sport.update({
            where: { id },
            data: patch,
        });
        return this.mapToDTO(updated);
    }

    private mapToDTO(row: DBSport): SportDTO {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            max_capacity: row.max_capacity,
            additional_price: row.additional_price,
            requires_medical_certificate: row.requires_medical_certificate,
            deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
        };
    }
}
