import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { EnrollmentDTO, MemberDTO, SportDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID      = '11111111-1111-4111-8111-111111111111';
const OTHER_MEMBER_UUID      = '22222222-2222-4222-8222-222222222222';
const VALID_SPORT_UUID       = '33333333-3333-4333-8333-333333333333';
const OTHER_SPORT_UUID       = '55555555-5555-4555-8555-555555555555';
const VALID_ENROLLMENT_UUID  = '44444444-4444-4444-8444-444444444444';
const SECOND_ENROLLMENT_UUID = '66666666-6666-4666-8666-666666666666';
const THIRD_ENROLLMENT_UUID  = '77777777-7777-4777-8777-777777777777';
const NONEXISTENT_UUID       = '99999999-9999-4999-8999-999999999999';

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
// findAll aplica filtros acumulativos con lógica AND y excluye eliminadas lógicamente.
// findById retorna la inscripción sin filtrar: el use case decide si está disponible.
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

        // Una inscripción histórica (is_active=false, deleted_at=null) sigue siendo visible.
        // Una inscripción eliminada (deleted_at!=null) queda fuera del circuito operativo;
        // el use case es quien decide rechazarla.
        async findById(id: string): Promise<EnrollmentDTO | null> {
            return mockEnrollments.find((e) => e.id === id) ?? null;
        }

        // El listado operativo siempre excluye inscripciones con deleted_at !== null.
        // Los filtros opcionales se acumulan con lógica AND.
        async findAll(filters?: {
            memberId?: string;
            sportId?: string;
            isActive?: boolean;
        }): Promise<EnrollmentDTO[]> {
            return mockEnrollments.filter(
                (e) =>
                    e.deleted_at === null &&
                    (filters?.memberId === undefined || e.member_id === filters.memberId) &&
                    (filters?.sportId === undefined || e.sport_id === filters.sportId) &&
                    (filters?.isActive === undefined || e.is_active === filters.isActive)
            );
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

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: GET /api/v1/enrollments
// Para GET no hace falta poblar stores de Members o Sports:
// las consultas operan exclusivamente sobre Enrollment.
// ---------------------------------------------------------------------------

describe('Enrollment API — tests de integración (GET /api/v1/enrollments)', () => {
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

    // TEST [1]: Store vacío → 200 con array vacío.
    it('debe retornar 200 con un array vacío cuando no existen inscripciones operativas', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toEqual([]);
    });

    // TEST [2]: Vigentes e históricas no eliminadas aparecen todas.
    it('debe listar inscripciones vigentes e históricas no eliminadas', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null }),
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(2);
    });

    // TEST [3]: Las eliminadas lógicamente no se incluyen.
    it('debe excluir inscripciones eliminadas lógicamente', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null }),
            buildEnrollmentDTO({
                id: SECOND_ENROLLMENT_UUID,
                is_active: false,
                deleted_at: '2025-01-01T00:00:00.000Z',
            })
        );

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(VALID_ENROLLMENT_UUID);
    });

    // TEST [4]: Filtro por memberId.
    it('debe filtrar por memberId', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, member_id: VALID_MEMBER_UUID }),
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, member_id: OTHER_MEMBER_UUID })
        );

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments?memberId=${VALID_MEMBER_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].member_id).toBe(VALID_MEMBER_UUID);
    });

    // TEST [5]: Filtro por sportId.
    it('debe filtrar por sportId', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, sport_id: VALID_SPORT_UUID }),
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, sport_id: OTHER_SPORT_UUID })
        );

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments?sportId=${VALID_SPORT_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].sport_id).toBe(VALID_SPORT_UUID);
    });

    // TEST [6]: Filtro isActive=true.
    it('debe filtrar por isActive true', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true }),
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, is_active: false })
        );

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments?isActive=true',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].is_active).toBe(true);
    });

    // TEST [7]: Filtro isActive=false.
    it('debe filtrar por isActive false', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true }),
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments?isActive=false',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].is_active).toBe(false);
    });

    // TEST [8]: Filtros acumulativos con lógica AND.
    it('debe aplicar filtros acumulativos con lógica AND', async () => {
        mockEnrollments.push(
            // Coincidencia exacta: mismo member, mismo sport, histórica.
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                member_id: VALID_MEMBER_UUID,
                sport_id: VALID_SPORT_UUID,
                is_active: false,
                deleted_at: null,
            }),
            // Distinto member.
            buildEnrollmentDTO({
                id: SECOND_ENROLLMENT_UUID,
                member_id: OTHER_MEMBER_UUID,
                sport_id: VALID_SPORT_UUID,
                is_active: false,
                deleted_at: null,
            }),
            // Distinto sport.
            buildEnrollmentDTO({
                id: THIRD_ENROLLMENT_UUID,
                member_id: VALID_MEMBER_UUID,
                sport_id: OTHER_SPORT_UUID,
                is_active: false,
                deleted_at: null,
            })
        );

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments?memberId=${VALID_MEMBER_UUID}&sportId=${VALID_SPORT_UUID}&isActive=false`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(VALID_ENROLLMENT_UUID);
    });

    // TEST [9]: Filtros sin coincidencias → 200 con array vacío.
    it('debe retornar 200 con array vacío cuando los filtros no encuentran coincidencias', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, member_id: OTHER_MEMBER_UUID })
        );

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments?memberId=${VALID_MEMBER_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO[] };
        expect(body.data).toEqual([]);
    });

    // TEST [10]: memberId con formato inválido → 400.
    it('debe retornar 400 cuando memberId tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments?memberId=no-uuid',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de socio inválido');
    });

    // TEST [11]: sportId con formato inválido → 400.
    it('debe retornar 400 cuando sportId tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments?sportId=no-uuid',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de deporte inválido');
    });

    // TEST [12]: isActive con valor no booleano → 400.
    it('debe retornar 400 cuando isActive tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments?isActive=si',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Filtro de vigencia inválido');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: GET /api/v1/enrollments/:id
// ---------------------------------------------------------------------------

describe('Enrollment API — tests de integración (GET /api/v1/enrollments/:id)', () => {
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

    // TEST [1]: Inscripción vigente.
    it('debe retornar 200 con una inscripción vigente', async () => {
        const dto = buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null });
        mockEnrollments.push(dto);

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.id).toBe(VALID_ENROLLMENT_UUID);
        expect(body.data.is_active).toBe(true);
    });

    // TEST [2]: Inscripción histórica no eliminada visible.
    it('debe retornar 200 con una inscripción histórica no eliminada', async () => {
        const dto = buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null });
        mockEnrollments.push(dto);

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.id).toBe(VALID_ENROLLMENT_UUID);
        expect(body.data.is_active).toBe(false);
    });

    // TEST [3]: Identificador con formato inválido → 400.
    it('debe retornar 400 cuando el identificador tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments/no-uuid',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de inscripción inválido');
    });

    // TEST [4]: UUID válido inexistente → 404.
    it('debe retornar 404 cuando la inscripción no existe', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments/${NONEXISTENT_UUID}`,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Inscripción no encontrada');
    });

    // TEST [5]: Inscripción eliminada lógicamente → 404.
    it('debe retornar 404 cuando la inscripción fue eliminada lógicamente', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                deleted_at: '2025-01-01T00:00:00.000Z',
            })
        );

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Inscripción no encontrada');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: PATCH /api/v1/enrollments/:id
// Diferencia clave entre desactivación y reactivación:
//   - Desactivar (true→false): no revalida socio ni deporte; no requiere dependencias.
//   - Reactivar (false→true): consulta member, sport, duplicados y cupo.
// enrollment_date representa el historial de la inscripción y debe conservarse siempre.
// ---------------------------------------------------------------------------

describe('Enrollment API — tests de integración (PATCH /api/v1/enrollments/:id)', () => {
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

    // TEST [1]: Desactivación exitosa.
    // enrollment_date representa historial y debe conservarse sin modificaciones.
    it('debe retornar 200 y desactivar una inscripción vigente', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true })
        );

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: false },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.is_active).toBe(false);
        expect(body.data.enrollment_date).toBe('2026-01-01T00:00:00.000Z');
    });

    // TEST [2]: La desactivación no revalida socio ni deporte.
    // Se puede desactivar aunque el socio o el deporte no estén en los stores.
    it('debe desactivar sin revalidar socio ni deporte', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true })
        );
        // No se insertan member ni sport; la desactivación no los necesita.

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: false },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.is_active).toBe(false);
    });

    // TEST [3]: Reactivación exitosa cuando se cumplen todas las condiciones operativas.
    it('debe retornar 200 y reactivar una inscripción histórica cuando se cumplen las condiciones', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID, status: 'Activo' }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, max_capacity: 10, deleted_at: null }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.is_active).toBe(true);
    });

    // TEST [4]: Mismo valor actual → retorna la inscripción sin cambios estructurales en el store.
    it('debe retornar 200 sin modificar la inscripción cuando se envía el mismo valor actual', async () => {
        const enrollment = buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true });
        mockEnrollments.push(enrollment);

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.is_active).toBe(true);
        expect(mockEnrollments).toHaveLength(1);
    });

    // TEST [5]: Body vacío → 400.
    it('debe retornar 400 cuando el body está vacío', async () => {
        mockEnrollments.push(buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: {},
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Se requiere al menos un campo para actualizar');
    });

    // TEST [6]: Campo no permitido → 400.
    it('debe retornar 400 cuando se intenta modificar un campo no permitido', async () => {
        mockEnrollments.push(buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { member_id: OTHER_MEMBER_UUID },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Campo no permitido para modificación');
    });

    // TEST [7]: is_active como string → 400.
    it('debe retornar 400 cuando is_active no es booleano', async () => {
        mockEnrollments.push(buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: 'false' },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El campo is_active debe ser booleano');
    });

    // TEST [8]: ID con formato inválido → 400.
    it('debe retornar 400 cuando el identificador tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/enrollments/no-uuid',
            payload: { is_active: false },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de inscripción inválido');
    });

    // TEST [9]: UUID válido pero inexistente → 404.
    it('debe retornar 404 cuando la inscripción no existe', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${NONEXISTENT_UUID}`,
            payload: { is_active: false },
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Inscripción no encontrada');
    });

    // TEST [10]: Inscripción eliminada lógicamente → 409.
    it('debe retornar 409 cuando la inscripción está eliminada lógicamente', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: VALID_ENROLLMENT_UUID,
                deleted_at: '2025-01-01T00:00:00.000Z',
            })
        );

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No se puede modificar una inscripción eliminada');
    });

    // TEST [11]: Socio no habilitado al reactivar → 409.
    it('debe retornar 409 cuando el socio no está habilitado para reactivar', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID, status: 'Moroso' }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, deleted_at: null }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio no está habilitado');
    });

    // TEST [12]: Deporte no disponible al reactivar → 409.
    it('debe retornar 409 cuando el deporte no está disponible para reactivar', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID, status: 'Activo' }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, deleted_at: '2025-01-01T00:00:00.000Z' }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El deporte no está disponible');
    });

    // TEST [13]: Duplicado activo con ID distinto al reactivar → 409.
    it('debe retornar 409 cuando existe otra inscripción activa para el mismo socio y deporte', async () => {
        // Inscripción histórica a reactivar.
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );
        // Otra inscripción activa con ID distinto para el mismo socio y deporte.
        mockEnrollments.push(
            buildEnrollmentDTO({ id: SECOND_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID, status: 'Activo' }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, deleted_at: null }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Ya existe una inscripción activa para este deporte');
    });

    // TEST [14]: Cupo completo al reactivar → 409.
    // Se usa OTHER_MEMBER_UUID para la inscripción que ocupa el cupo: así el check de
    // duplicado (mismo member+sport) no intercepta el escenario antes del conteo de cupo.
    it('debe retornar 409 cuando el cupo está completo al intentar reactivar', async () => {
        // Inscripción histórica a reactivar.
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );
        // Inscripción activa de otro socio que ocupa el único cupo disponible.
        mockEnrollments.push(
            buildEnrollmentDTO({
                id: SECOND_ENROLLMENT_UUID,
                member_id: OTHER_MEMBER_UUID,
                is_active: true,
                deleted_at: null,
            })
        );
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID, status: 'Activo' }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, max_capacity: 1, deleted_at: null }));

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
            payload: { is_active: true },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No hay cupo disponible para este deporte');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: DELETE /api/v1/enrollments/:id
// Diferencia entre desactivar (PATCH is_active=false) y dar de baja (DELETE):
//   - Desactivar: el registro queda con is_active=false, deleted_at=null; puede reactivarse.
//   - Dar de baja: el registro queda con deleted_at poblado; no puede volver a eliminarse.
// En ambos casos el registro continúa presente en el store (baja lógica, no física).
// ---------------------------------------------------------------------------

describe('Enrollment API — tests de integración (DELETE /api/v1/enrollments/:id)', () => {
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

    // TEST [1]: Baja lógica exitosa de una inscripción vigente.
    // El registro continúa presente en el store pero con deleted_at poblado.
    it('debe retornar 200 y realizar la baja lógica de una inscripción vigente', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        const response = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.deleted_at).not.toBeNull();
        expect(body.data.is_active).toBe(false);
        expect(body.data.member_id).toBe(VALID_MEMBER_UUID);
        expect(body.data.sport_id).toBe(VALID_SPORT_UUID);
        expect(body.data.enrollment_date).toBe('2026-01-01T00:00:00.000Z');
        // El registro sigue existiendo en el store; solo fue marcado como eliminado.
        expect(mockEnrollments).toHaveLength(1);
        expect(mockEnrollments[0].deleted_at).not.toBeNull();
    });

    // TEST [2]: Baja lógica sobre una inscripción histórica (is_active=false, deleted_at=null).
    // Una inscripción puede estar desactivada sin haber sido dada de baja formalmente.
    it('debe permitir dar de baja una inscripción histórica no eliminada', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: false, deleted_at: null })
        );

        const response = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload) as { data: EnrollmentDTO };
        expect(body.data.deleted_at).not.toBeNull();
        expect(body.data.is_active).toBe(false);
    });

    // TEST [3]: Una inscripción dada de baja desaparece del listado operativo.
    // findAll excluye registros con deleted_at !== null.
    it('debe excluir del listado operativo una inscripción dada de baja', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        const listResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/enrollments',
        });

        expect(listResponse.statusCode).toBe(200);
        const listBody = JSON.parse(listResponse.payload) as { data: EnrollmentDTO[] };
        expect(listBody.data).toHaveLength(0);
    });

    // TEST [4]: Una inscripción dada de baja no es accesible por ID.
    // GetEnrollmentByIdUseCase rechaza registros con deleted_at poblado.
    it('debe retornar 404 al consultar por id una inscripción dada de baja', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        const getResponse = await app.inject({
            method: 'GET',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(getResponse.statusCode).toBe(404);
        const body = JSON.parse(getResponse.payload) as { error: string };
        expect(body.error).toBe('Inscripción no encontrada');
    });

    // TEST [5]: No se puede dar de baja dos veces la misma inscripción.
    it('debe retornar 409 cuando la inscripción ya fue eliminada', async () => {
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        const secondResponse = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });

        expect(secondResponse.statusCode).toBe(409);
        const body = JSON.parse(secondResponse.payload) as { error: string };
        expect(body.error).toBe('La inscripción ya fue eliminada');
    });

    // TEST [6]: ID con formato no UUID → 400.
    it('debe retornar 400 cuando el identificador tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/enrollments/no-uuid',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de inscripción inválido');
    });

    // TEST [7]: UUID válido pero sin registro en el store → 404.
    it('debe retornar 404 cuando la inscripción no existe', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${NONEXISTENT_UUID}`,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Inscripción no encontrada');
    });

    // TEST [8]: Después de una baja lógica, el mismo socio puede volver a inscribirse.
    // Una inscripción eliminada deja de contar como duplicado activo (findActiveByMemberAndSport
    // solo considera is_active=true y deleted_at=null).
    it('debe permitir una nueva inscripción del mismo socio y deporte después de la baja lógica', async () => {
        mockMembers.push(buildMemberDTO({ id: VALID_MEMBER_UUID }));
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, max_capacity: 10 }));
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, is_active: true, deleted_at: null })
        );

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });
        expect(deleteResponse.statusCode).toBe(200);

        const postResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID },
        });
        expect(postResponse.statusCode).toBe(201);

        // El store debe contener la inscripción eliminada y la nueva inscripción activa.
        expect(mockEnrollments).toHaveLength(2);
        const deleted = mockEnrollments.find((e) => e.id === VALID_ENROLLMENT_UUID);
        const created = mockEnrollments.find((e) => e.id !== VALID_ENROLLMENT_UUID);
        expect(deleted?.deleted_at).not.toBeNull();
        expect(created?.deleted_at).toBeNull();
        expect(created?.is_active).toBe(true);
    });

    // TEST [9]: Una inscripción eliminada libera el cupo para otro socio.
    // Se usan dos socios distintos: socio A (inscripción eliminada) y socio B (nueva inscripción).
    // Esto es necesario para que la validación de duplicado no intercepte el escenario
    // antes de llegar al conteo de cupo.
    it('debe liberar cupo después de dar de baja una inscripción', async () => {
        const MEMBER_A_UUID = VALID_MEMBER_UUID;
        const MEMBER_B_UUID = OTHER_MEMBER_UUID;

        mockMembers.push(
            buildMemberDTO({ id: MEMBER_A_UUID }),
            buildMemberDTO({ id: MEMBER_B_UUID, dni: '87654321', email: 'b@test.com' })
        );
        // Deporte con cupo máximo 1: después de eliminar la inscripción de A, B puede entrar.
        mockSports.push(buildSportDTO({ id: VALID_SPORT_UUID, max_capacity: 1 }));
        mockEnrollments.push(
            buildEnrollmentDTO({ id: VALID_ENROLLMENT_UUID, member_id: MEMBER_A_UUID, is_active: true, deleted_at: null })
        );

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/api/v1/enrollments/${VALID_ENROLLMENT_UUID}`,
        });
        expect(deleteResponse.statusCode).toBe(200);

        const postResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/enrollments',
            payload: { member_id: MEMBER_B_UUID, sport_id: VALID_SPORT_UUID },
        });
        expect(postResponse.statusCode).toBe(201);

        // La inscripción eliminada no se computa en countActiveBySportId.
        expect(mockEnrollments).toHaveLength(2);
        const deletedEnrollment = mockEnrollments.find((e) => e.id === VALID_ENROLLMENT_UUID);
        expect(deletedEnrollment?.deleted_at).not.toBeNull();
    });
});
