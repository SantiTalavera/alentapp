import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { CreatePaymentRequest, PaymentDTO, MemberDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAYMENT_ID = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';

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

    describe('PATCH /api/v1/payments/:id', () => {
        it('debe retornar 200 y el PaymentDTO con status Paid y payment_date autogenerado al pasar de Pending a Paid', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
            const existingPayment = {
                id: paymentId,
                member_id: MEMBER_ID,
                amount: 1500,
                month: 5,
                year: 2026,
                due_date: '2026-05-31T00:00:00.000Z',
                status: 'Pending' as const,
                payment_date: null,
            };

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(existingPayment);

            const updateSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'update')
                .mockClear()
                .mockImplementationOnce(async (id, data) => ({
                    ...existingPayment,
                    ...data,
                }));

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/payments/${paymentId}`,
                payload: {
                    status: 'Paid',
                },
            });

            expect(response.statusCode).toBe(200);

            const body = JSON.parse(response.payload);
            expect(body.data).toBeDefined();
            expect(body.data.status).toBe('Paid');
            expect(body.data.payment_date).not.toBeNull();
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
            expect(updateSpy).toHaveBeenCalledWith(paymentId, expect.objectContaining({
                status: 'Paid',
                payment_date: expect.any(String),
            }));
        });

        it('debe retornar 200 al transicionar de Pending a Canceled', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
            const existingPayment = {
                id: paymentId,
                member_id: MEMBER_ID,
                amount: 1500,
                month: 5,
                year: 2026,
                due_date: '2026-05-31T00:00:00.000Z',
                status: 'Pending' as const,
                payment_date: null,
            };

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(existingPayment);

            const updateSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'update')
                .mockClear()
                .mockImplementationOnce(async (id, data) => ({
                    ...existingPayment,
                    ...data,
                }));

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/payments/${paymentId}`,
                payload: {
                    status: 'Canceled',
                },
            });

            expect(response.statusCode).toBe(200);

            const body = JSON.parse(response.payload);
            expect(body.data).toBeDefined();
            expect(body.data.status).toBe('Canceled');
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
            expect(updateSpy).toHaveBeenCalledWith(paymentId, { status: 'Canceled' });
        });
    });

    describe('DELETE /api/v1/payments/:id', () => {
        it('debe retornar 200 y el PaymentDTO cancelado si el pago es pendiente', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
            const existingPayment = {
                id: paymentId,
                member_id: MEMBER_ID,
                amount: 1500,
                month: 5,
                year: 2026,
                due_date: '2026-05-31T00:00:00.000Z',
                status: 'Pending' as const,
                payment_date: null,
            };

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(existingPayment);

            const cancelSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'cancel')
                .mockClear()
                .mockResolvedValueOnce({
                    ...existingPayment,
                    status: 'Canceled',
                });

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/payments/${paymentId}`,
            });

            expect(response.statusCode).toBe(200);

            const body = JSON.parse(response.payload);
            expect(body.data).toBeDefined();
            expect(body.data.status).toBe('Canceled');
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
            expect(cancelSpy).toHaveBeenCalledWith(paymentId);
        });

        it('debe retornar 422 si el pago ya se encuentra pagado', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
            const existingPayment = {
                id: paymentId,
                member_id: MEMBER_ID,
                amount: 1500,
                month: 5,
                year: 2026,
                due_date: '2026-05-31T00:00:00.000Z',
                status: 'Paid' as const,
                payment_date: '2026-05-27T00:00:00.000Z',
            };

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(existingPayment);

            const cancelSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'cancel')
                .mockClear();

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/payments/${paymentId}`,
            });

            expect(response.statusCode).toBe(422);

            const body = JSON.parse(response.payload);
            expect(body.error).toBe('No se puede cancelar un pago ya efectuado');
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
            expect(cancelSpy).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/v1/payments', () => {
        it('debe retornar 200 y la lista de pagos', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const expectedPayments = [
                {
                    id: 'p-1',
                    member_id: MEMBER_ID,
                    amount: 1500,
                    month: 5,
                    year: 2026,
                    due_date: '2026-05-31T00:00:00.000Z',
                    status: 'Pending' as const,
                    payment_date: null,
                }
            ];

            const findAllSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findAll')
                .mockClear()
                .mockResolvedValueOnce(expectedPayments);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/payments',
            });

            expect(response.statusCode).toBe(200);

            const body = JSON.parse(response.payload);
            expect(body.data).toBeDefined();
            expect(body.data).toBeInstanceOf(Array);
            expect(body.data[0].id).toBe('p-1');
            expect(findAllSpy).toHaveBeenCalledWith({});
        });

        it('debe retornar 400 si se envía un filtro de estado inválido', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/payments?status=InvalidStatus',
            });

            expect(response.statusCode).toBe(400);

            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Estado de pago no válido');
        });
    });

    describe('GET /api/v1/payments/:id', () => {
        it('debe retornar 200 y el PaymentDTO si el pago existe', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
            const expectedPayment = {
                id: paymentId,
                member_id: MEMBER_ID,
                amount: 1500,
                month: 5,
                year: 2026,
                due_date: '2026-05-31T00:00:00.000Z',
                status: 'Pending' as const,
                payment_date: null,
            };

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(expectedPayment);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/payments/${paymentId}`,
            });

            expect(response.statusCode).toBe(200);

            const body = JSON.parse(response.payload);
            expect(body.data).toBeDefined();
            expect(body.data.id).toBe(paymentId);
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
        });

        it('debe retornar 404 si el pago no existe', async () => {
            const { PostgresPaymentRepository } = await import('../infrastructure/PostgresPaymentRepository.js');
            const paymentId = '00000000-0000-0000-0000-000000000000';

            const findByIdSpy = vi.spyOn(PostgresPaymentRepository.prototype, 'findById')
                .mockClear()
                .mockResolvedValueOnce(null);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/payments/${paymentId}`,
            });

            expect(response.statusCode).toBe(404);

            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Pago no encontrado');
            expect(findByIdSpy).toHaveBeenCalledWith(paymentId);
        });
    });
});
