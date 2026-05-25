import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { EquipmentLoanDTO, MemberDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Mock del repositorio de infraestructura de Postgres.
// Al reemplazar esta clase, evitamos cualquier conexión real a la base de datos
// y probamos el ciclo completo: Fastify → Controller → UseCase → Validator.
// ---------------------------------------------------------------------------

// Socio Pleno activo (categoría habilitada para préstamos)
const SENIOR_MEMBER_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
// Socio Cadete (categoría NO habilitada para préstamos)
const CADET_MEMBER_UUID = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';
// Socio Moroso (status no activo)
const DELINQUENT_MEMBER_UUID = 'dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb';

const MOCK_MEMBERS: Record<string, MemberDTO> = {
    [SENIOR_MEMBER_UUID]: {
        id: SENIOR_MEMBER_UUID,
        dni: '10000001',
        name: 'Juan Pleno',
        email: 'juan@club.com',
        birthdate: '1990-05-15',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2024-01-01T00:00:00.000Z',
    },
    [CADET_MEMBER_UUID]: {
        id: CADET_MEMBER_UUID,
        dni: '10000002',
        name: 'Pedro Cadete',
        email: 'pedro@club.com',
        birthdate: '2010-03-20',
        category: 'Cadete',
        status: 'Activo',
        created_at: '2024-01-01T00:00:00.000Z',
    },
    [DELINQUENT_MEMBER_UUID]: {
        id: DELINQUENT_MEMBER_UUID,
        dni: '10000003',
        name: 'Carlos Moroso',
        email: 'carlos@club.com',
        birthdate: '1985-07-10',
        category: 'Pleno',
        status: 'Moroso',
        created_at: '2024-01-01T00:00:00.000Z',
    },
};

// Préstamo que devuelve la BD falsa al persistir
const MOCK_CREATED_LOAN: EquipmentLoanDTO = {
    id: 'loan-integration-0001',
    item_name: 'Pelota de Básquet',
    status: 'Prestado',
    loan_date: '2026-05-24T00:00:00.000Z',
    due_date: null,
    member_id: SENIOR_MEMBER_UUID,
    deleted_at: null,
};

// Mock de PostgresMemberRepository — devuelve socios en memoria
vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findAll(): Promise<MemberDTO[]> {
            return Object.values(MOCK_MEMBERS);
        }
        async findById(id: string): Promise<MemberDTO | null> {
            return MOCK_MEMBERS[id] ?? null;
        }
        async findByDni(dni: string): Promise<MemberDTO | null> {
            return Object.values(MOCK_MEMBERS).find((m) => m.dni === dni) ?? null;
        }
        async create(data: Omit<MemberDTO, 'id'>): Promise<MemberDTO> {
            return { id: 'new-member-uuid', ...data } as MemberDTO;
        }
        async update(id: string, data: Partial<MemberDTO>): Promise<MemberDTO> {
            return { ...MOCK_MEMBERS[id], ...data } as MemberDTO;
        }
        async delete(_id: string): Promise<void> {
            return;
        }
    },
}));

// ---------------------------------------------------------------------------
// Stubs para los demás repositorios de infraestructura importados por app.ts.
// Son necesarios para evitar que los guards "DATABASE_URL is not set" lancen un
// error a nivel de módulo cuando vitest importa app.ts durante la carga del test.
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
        async softDelete() { return {}; }
    },
}));

vi.mock('../infrastructure/PostgresLockerRepository.js', () => ({
    PostgresLockerRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
    },
}));

vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => ({
    PostgresMedicalCertificateRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
        async findByMemberId() { return []; }
    },
}));

vi.mock('../infrastructure/PostgresPaymentRepository.js', () => ({
    PostgresPaymentRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
    },
}));

vi.mock('../infrastructure/PostgresEnrollmentRepository.js', () => ({
    PostgresEnrollmentRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
    },
}));

// Mock de PostgresEquipmentLoanRepository — simula la persistencia sin BD real
vi.mock('../infrastructure/PostgresEquipmentLoanRepository.js', () => ({
    PostgresEquipmentLoanRepository: class {
        async create(
            data: Pick<EquipmentLoanDTO, 'item_name' | 'due_date' | 'member_id'>,
        ): Promise<EquipmentLoanDTO> {
            return {
                ...MOCK_CREATED_LOAN,
                item_name: data.item_name,
                member_id: data.member_id,
                due_date: data.due_date ?? null,
                loan_date: new Date().toISOString(),
            };
        }
        async findById(_id: string): Promise<EquipmentLoanDTO | null> {
            return null;
        }
        async findAll(): Promise<EquipmentLoanDTO[]> {
            return [MOCK_CREATED_LOAN];
        }
        async update(_id: string, _data: Partial<EquipmentLoanDTO>): Promise<EquipmentLoanDTO> {
            return MOCK_CREATED_LOAN;
        }
        async softDelete(_id: string): Promise<EquipmentLoanDTO> {
            return MOCK_CREATED_LOAN;
        }
    },
}));

// ---------------------------------------------------------------------------
// Suite de tests de integración
// ---------------------------------------------------------------------------

describe('EquipmentLoan API — tests de integración (POST /api/v1/loans)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    // -------------------------------------------------------------------------
    // Test [1] – Socio Pleno activo → 201 con EquipmentLoanDTO (status "Prestado")
    // -------------------------------------------------------------------------
    it('debe retornar 201 y un EquipmentLoanDTO con status "Prestado" cuando el socio Pleno está activo', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/loans',
            payload: {
                item_name: 'Pelota de Básquet',
                member_id: SENIOR_MEMBER_UUID,
            },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: EquipmentLoanDTO };

        expect(body.data).toBeDefined();
        expect(body.data.status).toBe('Prestado');
        expect(body.data.item_name).toBe('Pelota de Básquet');
        expect(body.data.member_id).toBe(SENIOR_MEMBER_UUID);
        // loan_date debe ser generado por la capa de persistencia (no nulo)
        expect(body.data.loan_date).toBeTruthy();
        expect(body.data.id).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Test [2] – Socio Cadete → 422 con mensaje específico de categoría
    // -------------------------------------------------------------------------
    it('debe retornar 422 con el mensaje de Cadete cuando el socio tiene categoría Cadete', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/loans',
            payload: {
                item_name: 'Raqueta de Squash',
                member_id: CADET_MEMBER_UUID,
            },
        });

        expect(response.statusCode).toBe(422);

        const body = JSON.parse(response.payload) as { error: string };

        expect(body.error).toBe(
            'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.',
        );
    });

    // -------------------------------------------------------------------------
    // Test [3] – Socio Moroso → 422 porque no está activo
    // -------------------------------------------------------------------------
    it('debe retornar 422 cuando el socio tiene status Moroso (Delinquent) y no puede solicitar un préstamo', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/loans',
            payload: {
                item_name: 'Guantes de Box',
                member_id: DELINQUENT_MEMBER_UUID,
            },
        });

        expect(response.statusCode).toBe(422);

        const body = JSON.parse(response.payload) as { error: string };

        expect(body.error).toBe('El socio no está activo y no puede solicitar un préstamo');
    });
});
