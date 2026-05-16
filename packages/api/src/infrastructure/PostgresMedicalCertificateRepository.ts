import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { MedicalCertificateRepository } from '../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO } from '@alentapp/shared';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
});

type DBMedicalCertificate = {
    id: string;
    issue_date: Date;
    expiry_date: Date;
    doctor_license: string;
    is_validated: boolean;
    member_id: string;
};

export class PostgresMedicalCertificateRepository implements MedicalCertificateRepository {
    async findActiveByMemberId(memberId: string): Promise<MedicalCertificateDTO | null> {
        const row = await prisma.medicalCertificate.findFirst({
            where: {
                member_id: memberId,
                is_validated: true,
            },
        });
        return row ? this.mapToDTO(row) : null;
    }

    async invalidateAllByMemberId(memberId: string): Promise<void> {
        await prisma.medicalCertificate.updateMany({
            where: {
                member_id: memberId,
                is_validated: true,
            },
            data: {
                is_validated: false,
            },
        });
    }

    async create(certificate: Omit<MedicalCertificateDTO, 'id'>): Promise<MedicalCertificateDTO> {
        // Ejecución atómica: Invalida los anteriores y crea el nuevo
        const [_, created] = await prisma.$transaction([
            prisma.medicalCertificate.updateMany({
                where: {
                    member_id: certificate.member_id,
                    is_validated: true,
                },
                data: {
                    is_validated: false,
                },
            }),
            prisma.medicalCertificate.create({
                data: {
                    issue_date: new Date(certificate.issue_date),
                    expiry_date: new Date(certificate.expiry_date),
                    doctor_license: certificate.doctor_license,
                    is_validated: certificate.is_validated,
                    member_id: certificate.member_id,
                },
            }),
        ]);

        return this.mapToDTO(created);
    }

    async findById(id: string): Promise<MedicalCertificateDTO | null> {
        const row = await prisma.medicalCertificate.findUnique({ where: { id } });
        return row ? this.mapToDTO(row) : null;
    }

    async update(id: string, data: Partial<MedicalCertificateDTO>): Promise<MedicalCertificateDTO> {
        const updated = await prisma.medicalCertificate.update({
            where: { id },
            data: {
                issue_date: data.issue_date ? new Date(data.issue_date) : undefined,
                expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined,
                doctor_license: data.doctor_license,
                is_validated: data.is_validated,
            },
        });
        return this.mapToDTO(updated);
    }

    async delete(id: string): Promise<void> {
        await prisma.medicalCertificate.delete({ where: { id } });
    }

    async findByMemberId(memberId: string): Promise<MedicalCertificateDTO[]> {
        const rows = await prisma.medicalCertificate.findMany({
            where: { member_id: memberId },
            orderBy: { issue_date: 'desc' },
        });
        return rows.map((row) => this.mapToDTO(row));
    }

    private mapToDTO(row: DBMedicalCertificate): MedicalCertificateDTO {
        return {
            id: row.id,
            issue_date: row.issue_date.toISOString(),
            expiry_date: row.expiry_date.toISOString(),
            doctor_license: row.doctor_license,
            is_validated: row.is_validated,
            member_id: row.member_id,
        };
    }
}
