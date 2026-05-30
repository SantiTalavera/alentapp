import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { EnrollmentDTO, MemberDTO, SportDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID     = '11111111-1111-4111-8111-111111111111';
const OTHER_MEMBER_UUID     = '22222222-2222-4222-8222-222222222222';
const VALID_SPORT_UUID      = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';

// ---------------------------------------------------------------------------
// Stores en memoria: uno por entidad para aislar responsabilidades.
// Se resetean en beforeEach para garantizar independencia entre tests.
// ---------------------------------------------------------------------------

let mockEnrollments: EnrollmentDTO[] = [];
let mockMembers: MemberDTO[]         = [];
let mockSports: SportDTO[]           = [];
let enrollmentNextId = 1;

function resetEnrollmentStore() { mockEnrollments = []; enrollmentNextId = 1; }
function resetMemberStore()     { mockMembers = []; }
function resetSportStore()      { mockSports = []; }

// ---------------------------------------------------------------------------
// Builders reutilizables para poblar los stores en cada test.
// ---------------------------------------------------------------------------

function buildMemberDTO(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: VALID_MEMBER_UUID,
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

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: VALID_SPORT_UUID,
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 10,
        additional_price: 500,
        requires_medical_certificate: false,
        deleted_at: null,
        ...overrides,
    };
}

function buildEnrollmentDTO(overrides: Partial<EnrollmentDTO> = {}): EnrollmentDTO {
    return {
        id: VALID_ENROLLMENT_UUID,
        member_id: VALID_MEMBER_UUID,
        sport_id: VALID_SPORT_UUID,
        enrollment_date: '2026-01-01T00:00:00.000Z',
        is_active: true,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mock principal: PostgresEnrollmentRepository
// create, findActiveByMemberAndSport y countActiveBySportId son los métodos
// activamente usados por CREATE Enrollment.
// Duplicados y cupo solo consideran inscripciones con is_active=true y deleted_at=null.
// findById, findAll, update y softDelete son stubs para ramas futuras.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresEnrollmentRepository.js', () => ({
    PostgresEnrollmentRepository: class {
        async create(data: { member_id: string; sport_id: string }): Promise<EnrollmentDTO> {
            const enrollment: EnrollmentDTO = {
                id: `00000000-0000-4000-8000-${String(enrollmentNextId++).padStart(12, '0')}`,
                member_id: data.member_id,
                sport_id: data.sport_id,
                enrollment_date: new Date().toISOString(),
                is_active: true,
                deleted_at: null,
            };
            mockEnrollments.push(enrollment);
            return enrollment;
        }

        async findActiveByMemberAndSport(
            member_id: string,
            sport_id: string
        ): Promise<EnrollmentDTO | null> {
            return (
                mockEnrollments.find(
                    (e) =>
                        e.member_id === member_id &&
                        e.sport_id === sport_id &&
                        e.is_active === true &&
                        e.deleted_at === null
                ) ?? null
            );
        }

        async countActiveBySportId(sport_id: string): Promise<number> {
            return mockEnrollments.filter(
                (e) =>
                    e.sport_id === sport_id &&
                    e.is_active === true &&
                    e.deleted_at === null
            ).length;
        }

        async findById(id: string): Promise<EnrollmentDTO | null> {
            return mockEnrollments.find((e) => e.id === id) ?? null;
        }

        async findAll(): Promise<EnrollmentDTO[]> {
            return mockEnrollments.filter((e) => e.deleted_at === null);
        }

        async update(id: string, data: unknown): Promise<EnrollmentDTO> {
            const idx = mockEnrollments.findIndex((e) => e.id === id);
            if (idx === -1) throw new Error('Inscripción no encontrada');
            mockEnrollments[idx] = {
                ...mockEnrollments[idx],
                ...(data as Partial<EnrollmentDTO>),
            };
            return mockEnrollments[idx];
        }

        async softDelete(id: string): Promise<EnrollmentDTO> {
            const e = mockEnrollments.find((e) => e.id === id);
            if (!e) throw new Error('Inscripción no encontrada');
            e.deleted_at = new Date().toISOString();
            e.is_active = false;
            return e;
        }
    },
}));

// ---------------------------------------------------------------------------
// Mock de PostgresMemberRepository
// findById es el único método activo en CREATE; el resto son stubs.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findById(id: string): Promise<MemberDTO | null> {
            return mockMembers.find((m) => m.id === id) ?? null;
        }
        async findAll() { return mockMembers; }
        async findByDni(dni: string) {
            return mockMembers.find((m) => m.dni === dni) ?? null;
        }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

// ---------------------------------------------------------------------------
// Mock de PostgresSportRepository
// findById es el único método activo en CREATE; el resto son stubs.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresSportRepository.js', () => ({
    PostgresSportRepository: class {
        async findById(id: string): Promise<SportDTO | null> {
            return mockSports.find((s) => s.id === id) ?? null;
        }
        async findAll() { return mockSports.filter((s) => s.deleted_at === null); }
        async findByName(name: string) {
            return mockSports.find((s) => s.name === name) ?? null;
        }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
    },
}));

// ---------------------------------------------------------------------------
// Stubs de los repositorios auxiliares importados por app.ts.
// Necesarios para evitar que DATABASE_URL lance errores al inicializar los módulos.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresDisciplineRepository.js', () => ({
    PostgresDisciplineRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
        async findByMemberId() { return []; }
        async findActiveTotalSuspensionsByMemberId() { return []; }
        async updateWithMemberStatus() { return {}; }
        async deleteWithMemberStatus() { return {}; }
        async delete() { return; }
    },
}));

vi.mock('../infrastructure/PostgresLockerRepository.js', () => ({
    PostgresLockerRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByNumber() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async softDelete() { return {}; }
    },
}));

vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => ({
    PostgresMedicalCertificateRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByMemberId() { return []; }
        async findActiveByMemberId() { return null; }
        async invalidateAllByMemberId() { return; }
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
// Suite de integración
// Ruta bajo prueba: POST /api/v1/enrollments
// Orden de validaciones: formato → socio existe → socio activo → deporte existe
// → deporte no eliminado → sin duplicado activo → cupo disponible → persistencia.
// ---------------------------------------------------------------------------

describe('Enrollment API — tests de integración (POST /api/v1/enrollments)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetEnrollmentStore();
        resetMemberStore();
        resetSportStore();
    });

    afterAll(async () => {
        await app.close();
    });

    const validPayload = {
        member_id: VALID_MEMBER_UUID,
        sport_id: VALID_SPORT_UUID,
    };

    // TEST [1]: Alta válida → 201 con EnrollmentDTO completo
    it('debe retornar 201 y un EnrollmentDTO activo cuando el payload es válido', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO({ max_capacity: 10 }));

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.id).toBeDefined();
        expect(body.data.member_id).toBe(VALID_MEMBER_UUID);
        expect(body.data.sport_id).toBe(VALID_SPORT_UUID);
        expect(() => new Date(body.data.enrollment_date).toISOString()).not.toThrow();
        expect(body.data.is_active).toBe(true);
        expect(body.data.deleted_at).toBeNull();
        expect(mockEnrollments).toHaveLength(1);
    });

    // TEST [2]: member_id ausente → 400
    it('debe retornar 400 cuando member_id está ausente', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: { sport_id: VALID_SPORT_UUID },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio es obligatorio');
    });

    // TEST [3]: sport_id ausente → 400
    it('debe retornar 400 cuando sport_id está ausente', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: { member_id: VALID_MEMBER_UUID },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El deporte es obligatorio');
    });

    // TEST [4]: Identificador con formato inválido → 400
    it.each([
        { member_id: 'no-uuid', sport_id: VALID_SPORT_UUID },
        { member_id: VALID_MEMBER_UUID, sport_id: 'no-uuid' },
    ])(
        'debe retornar 400 cuando un identificador no es UUID válido (%o)',
        async (payload) => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/enrollments',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload) as { error: string };
            expect(body.error).toBe('Identificador inválido');
            expect(mockEnrollments).toHaveLength(0);
        }
    );

    // TEST [5]: Socio inexistente → 404
    it('debe retornar 404 cuando el socio no existe', async () => {
        mockSports.push(buildSportDTO());
        // No se agrega ningún member al store.

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Socio no encontrado');
    });

    // TEST [6]: Socio con status Moroso → 409
    it('debe retornar 409 cuando el socio no está habilitado para inscribirse', async () => {
        mockMembers.push(buildMemberDTO({ status: 'Moroso' }));
        mockSports.push(buildSportDTO());

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio no está habilitado para inscribirse');
    });

    // TEST [7]: Deporte inexistente → 404
    it('debe retornar 404 cuando el deporte no existe', async () => {
        mockMembers.push(buildMemberDTO());
        // No se agrega ningún sport al store.

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Deporte no encontrado');
    });

    // TEST [8]: Deporte con baja lógica → 409
    it('debe retornar 409 cuando el deporte fue eliminado lógicamente', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO({ deleted_at: '2024-01-01T00:00:00.000Z' }));

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No se puede inscribir en un deporte eliminado');
    });

    // TEST [9]: Inscripción activa duplicada → 409
    it('debe retornar 409 cuando ya existe una inscripción activa para el mismo socio y deporte', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO());
        // Inscripción activa preexistente para el mismo socio y deporte.
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio ya está inscripto en este deporte');
        // No debe haberse creado una segunda inscripción.
        expect(mockEnrollments).toHaveLength(1);
    });

    // TEST [10]: Cupo completo → 409
    // Se usa OTHER_MEMBER_UUID para la inscripción preexistente: así la validación de
    // duplicado (mismo member+sport) no intercepta el escenario antes del conteo de cupo.
    it('debe retornar 409 cuando el cupo del deporte está completo', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO({ max_capacity: 1 }));
        // Inscripción de otro socio que ocupa el único cupo disponible.
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                member_id: OTHER_MEMBER_UUID,
                is_active: true,
                deleted_at: null,
            })
        );

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No hay cupo disponible para este deporte');
        expect(mockEnrollments).toHaveLength(1);
    });

    // TEST [11]: Inscripción previa inactiva → no bloquea nueva inscripción
    it('debe permitir crear una nueva inscripción cuando la inscripción previa está inactiva', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO());
        // Inscripción inactiva: no cuenta como duplicado activo ni ocupa cupo.
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(201);
        expect(mockEnrollments).toHaveLength(2);
    });

    // TEST [12]: Inscripción previa con baja lógica → no bloquea nueva inscripción
    it('debe permitir crear una nueva inscripción cuando la inscripción previa fue eliminada lógicamente', async () => {
        mockMembers.push(buildMemberDTO());
        mockSports.push(buildSportDTO());
        // Inscripción soft-deleted: tampoco cuenta como duplicado activo ni para cupo.
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                is_active: false,
                deleted_at: '2025-01-01T00:00:00.000Z',
            })
        );

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(201);
        expect(mockEnrollments).toHaveLength(2);
    });

    // TEST [13]: Inscripción histórica de otro socio no afecta el cupo disponible
    it('debe ignorar inscripciones históricas al calcular el cupo disponible', async () => {
        mockMembers.push(buildMemberDTO());
        // max_capacity 1: si la inscripción inactiva contara, el alta fallaría.
        mockSports.push(buildSportDTO({ max_capacity: 1 }));
        // Inscripción de otro socio, inactiva: no debe computar en el conteo de cupo.
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                member_id: OTHER_MEMBER_UUID,
                is_active: false,
                deleted_at: null,
            })
        );

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(201);
        expect(mockEnrollments).toHaveLength(2);
    });
});
