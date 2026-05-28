import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { MedicalCertificateDTO, MemberDTO } from '@alentapp/shared';

function buildCertificateDTO(overrides: Partial<MedicalCertificateDTO> = {}): MedicalCertificateDTO {
    return {
        id: 'cert-uuid-0001',
        member_id: 'member-uuid-0001',
        issue_date: '2025-01-01T00:00:00.000Z',
        expiry_date: '2026-01-01T00:00:00.000Z',
        doctor_license: 'MN-12345',
        is_validated: true,
        ...overrides,
    };
}

function buildMemberDTO(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: 'member-uuid-0001',
        dni: '12345678',
        name: 'Socio de Prueba',
        email: 'socio@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2024-01-01T00:00:00.000Z',
        ...overrides,
    };
}

let _prevActiveCert: MedicalCertificateDTO | null = null;

// Mock de PostgresMedicalCertificateRepository
// ---------------------------------------------------------------------------
vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => ({
    PostgresMedicalCertificateRepository: class {
        async findActiveByMemberId(_memberId: string): Promise<MedicalCertificateDTO | null> {
            return _prevActiveCert;
        }
        async invalidateAllByMemberId(_memberId: string): Promise<void> {
            return;
        }
        async create(_data: unknown): Promise<MedicalCertificateDTO> {
            // Simula la invalidación atómica que hace $transaction en la infra real:
            // después del create, el cert previo deja de estar activo.
            _prevActiveCert = null;
            return buildCertificateDTO();
        }
        async findById(id: string): Promise<MedicalCertificateDTO | null> {
            return id === 'cert-uuid-0001' ? buildCertificateDTO() : null;
        }
        async findByMemberId(_memberId: string): Promise<MedicalCertificateDTO[]> {
            return [buildCertificateDTO()];
        }
        async update(_id: string, _data: unknown): Promise<MedicalCertificateDTO> {
            return buildCertificateDTO();
        }
        async delete(_id: string): Promise<void> {
            return;
        }
    },
}));

// ---------------------------------------------------------------------------
// Mock de PostgresMemberRepository
// ---------------------------------------------------------------------------
vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findById(id: string): Promise<MemberDTO | null> {
            return id === 'member-uuid-0001' ? buildMemberDTO() : null;
        }
        async findAll(): Promise<MemberDTO[]> { return []; }
        async findByDni(_dni: string): Promise<MemberDTO | null> { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

// ---------------------------------------------------------------------------
// Stubs de los repositorios restantes.
// ---------------------------------------------------------------------------
vi.mock('../infrastructure/PostgresDisciplineRepository.js', () => ({
    PostgresDisciplineRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
        async findByMemberId() { return []; }
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

vi.mock('../infrastructure/PostgresPaymentRepository.js', () => ({
    PostgresPaymentRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByPeriod() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async cancel() { return {}; }
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
        async softDelete() { return {}; }
    },
}));

// ---------------------------------------------------------------------------
// Suite de tests de integración
// Ruta bajo prueba: POST /api/v1/medical-certificates
// ---------------------------------------------------------------------------

describe('MedicalCertificate API — tests de integración (POST /api/v1/medical-certificates)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        _prevActiveCert = null;
    });

    // TEST [1]: POST válido → 201 con MedicalCertificateDTO
    it('debe retornar 201 y un MedicalCertificateDTO con is_validated true cuando el payload es válido', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/medical-certificates',
            payload: {
                member_id: 'member-uuid-0001',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: MedicalCertificateDTO };
        expect(body.data.is_validated).toBe(true);
        expect(body.data.id).toBeDefined();
        expect(body.data.member_id).toBe('member-uuid-0001');
    });

    // TEST [2]: POST con certificado previo activo → 201 y nuevo cert es el activo
    it('debe retornar 201 con un cert de id distinto al previo cuando ya existía un certificado activo', async () => {
        const PREV_CERT_ID = 'cert-uuid-PREV';
        _prevActiveCert = buildCertificateDTO({ id: PREV_CERT_ID }); // simula cert previo activo

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/medical-certificates',
            payload: {
                member_id: 'member-uuid-0001',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: MedicalCertificateDTO };
        expect(body.data.is_validated).toBe(true);
        expect(body.data.id).not.toBe(PREV_CERT_ID);
    });

    // TEST [3]: POST con expiry_date <= issue_date → 400
    it('debe retornar 400 con el mensaje de error de fechas cuando expiry_date es anterior a issue_date', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/medical-certificates',
            payload: {
                member_id: 'member-uuid-0001',
                issue_date: '2026-01-01',
                expiry_date: '2025-01-01',
                doctor_license: 'MN-12345',
            },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('La fecha de vencimiento debe ser posterior a la fecha de emisión');
    });

    // TEST [4]: POST con member_id inexistente → 404
    it('debe retornar 404 con el mensaje "El socio no existe" cuando el member_id no corresponde a ningún socio', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/medical-certificates',
            payload: {
                member_id: 'member-inexistente',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio no existe');
    });
});

// ---------------------------------------------------------------------------
// Suite de tests de integración
// Ruta bajo prueba: PATCH /api/v1/medical-certificates/:id
// ---------------------------------------------------------------------------

describe('MedicalCertificate API — tests de integración (PATCH /api/v1/medical-certificates/:id)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    // TEST [1]: PATCH con expiry_date válida → 200 con MedicalCertificateDTO
    it('debe retornar 200 y un MedicalCertificateDTO actualizado cuando el payload es válido', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/medical-certificates/cert-uuid-0001',
            payload: {
                expiry_date: '2027-01-01',
            },
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: MedicalCertificateDTO };
        expect(body.data).toBeDefined();
        expect(body.data.id).toBe('cert-uuid-0001');
    });

    // TEST [2]: PATCH con member_id en body → 400
    it('debe retornar 400 con el mensaje de error cuando el body contiene member_id', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/medical-certificates/cert-uuid-0001',
            payload: {
                member_id: 'otro-member-uuid',
            },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio titular del certificado no puede modificarse');
    });
});
