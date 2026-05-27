import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { CreatePaymentRequest, PaymentDTO, MemberDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAYMENT_ID = 'p1a2b3c4-d5e6-7890-abcd-ef1234567890';

// Mock values
const MOCK_MEMBER: MemberDTO = {
    id: MEMBER_ID,
    dni: '12345678',
    name: 'Socio Integracion',
    email: 'socio@test.com',
    birthdate: '1990-01-01',
    category: 'Pleno',
    status: 'Activo',
    created_at: '2026-05-01T00:00:00.000Z',
};

// Mock de PostgresMemberRepository
vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findById(id: string): Promise<MemberDTO | null> {
            return id === MEMBER_ID ? MOCK_MEMBER : null;
        }
        async findAll() { return []; }
        async findByDni() { return null; }
        async create(data: any) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

// Mock de PostgresPaymentRepository
vi.mock('../infrastructure/PostgresPaymentRepository.js', () => ({
    PostgresPaymentRepository: class {
        async findByPeriod(member_id: string, month: number, year: number): Promise<PaymentDTO | null> {
            return null;
        }
        async create(data: CreatePaymentRequest & { status: string; payment_date: string | null }): Promise<PaymentDTO> {
            return {
                id: PAYMENT_ID,
                member_id: data.member_id,
                amount: data.amount,
                month: data.month,
                year: data.year,
                due_date: data.due_date,
                status: data.status as 'Pending' | 'Paid' | 'Canceled',
                payment_date: data.payment_date,
            };
        }
        async findAll() { return []; }
        async findById() { return null; }
        async update() { return {}; }
        async cancel() { return {}; }
    },
}));

// Stub rest of repositories
vi.mock('../infrastructure/PostgresDisciplineRepository.js', () => ({
    PostgresDisciplineRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresSportRepository.js', () => ({
    PostgresSportRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresLockerRepository.js', () => ({
    PostgresLockerRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => ({
    PostgresMedicalCertificateRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByMemberId() { return []; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresEnrollmentRepository.js', () => ({
    PostgresEnrollmentRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresEquipmentLoanRepository.js', () => ({
    PostgresEquipmentLoanRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

describe('Payment API Integration Tests — POST /api/v1/payments', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    // Test [1] — POST con datos válidos → 201 con PaymentDTO
    it('debe retornar 201 y un PaymentDTO con status Pending y payment_date null cuando se realiza una petición válida', async () => {
        const payload: CreatePaymentRequest = {
            member_id: MEMBER_ID,
            amount: 2500,
            month: 6,
            year: 2026,
            due_date: '2026-06-30T00:00:00.000Z',
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/payments',
            payload,
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: PaymentDTO };
        expect(body.data).toBeDefined();
        expect(body.data.id).toBe(PAYMENT_ID);
        expect(body.data.member_id).toBe(MEMBER_ID);
        expect(body.data.amount).toBe(2500);
        expect(body.data.month).toBe(6);
        expect(body.data.year).toBe(2026);
        expect(body.data.status).toBe('Pending');
        expect(body.data.payment_date).toBeNull();
    });

    // Test [2] — POST con member_id inexistente → 404
    it('debe retornar 404 y un mensaje de error si el socio no existe', async () => {
        const payload: CreatePaymentRequest = {
            member_id: 'non-existent-member-uuid',
            amount: 2500,
            month: 6,
            year: 2026,
            due_date: '2026-06-30T00:00:00.000Z',
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/payments',
            payload,
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Socio no encontrado');
    });
});
