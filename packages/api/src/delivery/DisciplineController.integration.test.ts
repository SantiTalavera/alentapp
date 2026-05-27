import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { DisciplineDTO, MemberDTO } from '@alentapp/shared';

const ACTIVE_MEMBER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SUSPENSION_MEMBER_ID = 'bbbbbbbb-cccc-dddd-eeeeeeeeeeee';
const NON_EXISTENT_MEMBER_ID = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';

function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

function buildMember(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: ACTIVE_MEMBER_ID,
        dni: '10000001',
        name: 'Socio Disciplina',
        email: 'disciplina@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2026-05-01T00:00:00.000Z',
        ...overrides,
    };
}

function buildPayload(memberId: string, overrides: Record<string, unknown> = {}) {
    return {
        member_id: memberId,
        reason: 'Incumplimiento del reglamento interno',
        start_date: daysFromNow(-1),
        end_date: daysFromNow(7),
        is_total_suspension: false,
        ...overrides,
    };
}

let mockMembers: Record<string, MemberDTO> = {};
let mockDisciplines: DisciplineDTO[] = [];

function buildMockDisciplineId(index: number): string {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function resetMockState() {
    mockMembers = {
        [ACTIVE_MEMBER_ID]: buildMember({ id: ACTIVE_MEMBER_ID }),
        [SUSPENSION_MEMBER_ID]: buildMember({
            id: SUSPENSION_MEMBER_ID,
            dni: '10000002',
            email: 'suspension@test.com',
            status: 'Moroso',
        }),
    };
    mockDisciplines = [];
}

resetMockState();

vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findAll(): Promise<MemberDTO[]> {
            return Object.values(mockMembers);
        }

        async findById(id: string): Promise<MemberDTO | null> {
            return mockMembers[id] ?? null;
        }

        async findByDni(dni: string): Promise<MemberDTO | null> {
            return Object.values(mockMembers).find((member) => member.dni === dni) ?? null;
        }

        async create(data: Omit<MemberDTO, 'id' | 'created_at'>): Promise<MemberDTO> {
            const member = buildMember({
                ...data,
                id: `member-${Object.keys(mockMembers).length + 1}`,
                created_at: new Date().toISOString(),
            });
            mockMembers[member.id] = member;
            return member;
        }

        async update(id: string, data: Partial<MemberDTO>): Promise<MemberDTO> {
            mockMembers[id] = {
                ...mockMembers[id],
                ...data,
            };
            return mockMembers[id];
        }

        async delete(id: string): Promise<void> {
            delete mockMembers[id];
        }
    },
}));

vi.mock('../infrastructure/PostgresDisciplineRepository.js', () => ({
    PostgresDisciplineRepository: class {
        async create(data: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO> {
            const discipline: DisciplineDTO = {
                id: buildMockDisciplineId(mockDisciplines.length + 1),
                ...data,
            };
            mockDisciplines.push(discipline);
            return discipline;
        }

        async findById(id: string): Promise<DisciplineDTO | null> {
            return mockDisciplines.find((discipline) => discipline.id === id) ?? null;
        }

        async findByMemberId(memberId: string): Promise<DisciplineDTO[]> {
            return mockDisciplines.filter((discipline) => discipline.member_id === memberId);
        }

        async findActiveTotalSuspensionsByMemberId(memberId: string): Promise<DisciplineDTO[]> {
            const now = new Date();
            return mockDisciplines.filter((discipline) => {
                return (
                    discipline.member_id === memberId &&
                    discipline.is_total_suspension &&
                    new Date(discipline.start_date) <= now &&
                    new Date(discipline.end_date) >= now
                );
            });
        }

        async update(id: string, data: Partial<DisciplineDTO>): Promise<DisciplineDTO> {
            const index = mockDisciplines.findIndex((discipline) => discipline.id === id);
            mockDisciplines[index] = {
                ...mockDisciplines[index],
                ...data,
            };
            return mockDisciplines[index];
        }

        async updateWithMemberStatus(
            id: string,
            data: Partial<DisciplineDTO>,
            memberId: string,
            memberStatus: MemberDTO['status'],
        ): Promise<DisciplineDTO> {
            mockMembers[memberId] = {
                ...mockMembers[memberId],
                status: memberStatus,
            };
            return this.update(id, data);
        }

        async delete(id: string): Promise<void> {
            mockDisciplines = mockDisciplines.filter((discipline) => discipline.id !== id);
        }

        async deleteWithMemberStatus(
            id: string,
            memberId: string,
            memberStatus: MemberDTO['status'],
        ): Promise<void> {
            await this.delete(id);
            mockMembers[memberId] = {
                ...mockMembers[memberId],
                status: memberStatus,
            };
        }
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

vi.mock('../infrastructure/PostgresPaymentRepository.js', () => ({
    PostgresPaymentRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
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

describe('Discipline API — tests de integración', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetMockState();
    });

    afterEach(() => {
        resetMockState();
    });

    afterAll(async () => {
        await app.close();
    });

    it('debe retornar 201 y un DisciplineDTO correcto cuando se crea sin suspensión total', async () => {
        const payload = buildPayload(ACTIVE_MEMBER_ID);

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload,
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: DisciplineDTO };

        expect(body.data.id).toBeDefined();
        expect(body.data.member_id).toBe(ACTIVE_MEMBER_ID);
        expect(body.data.reason).toBe(payload.reason);
        expect(body.data.is_total_suspension).toBe(false);
        expect(body.data.previous_member_status).toBeNull();
        expect(mockDisciplines).toHaveLength(1);
        expect(mockMembers[ACTIVE_MEMBER_ID].status).toBe('Activo');
    });

    const sameDate = '2026-05-20T00:00:00.000Z';

    it.each([
        ['igual a start_date', sameDate, sameDate],
        ['anterior a start_date', '2026-05-23T00:00:00.000Z', '2026-05-20T00:00:00.000Z'],
    ])(
        'debe retornar 400 con mensaje descriptivo cuando end_date es %s',
        async (_caseName, startDate, endDate) => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/disciplines',
                payload: buildPayload(ACTIVE_MEMBER_ID, {
                    start_date: startDate,
                    end_date: endDate,
                }),
            });

            expect(response.statusCode).toBe(400);

            const body = JSON.parse(response.payload) as { error: string };
            expect(body.error).toBe('La fecha de fin debe ser posterior a la fecha de inicio');
            expect(mockDisciplines).toHaveLength(0);
        },
    );

    it('debe retornar 404 cuando member_id no corresponde a un socio existente', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload: buildPayload(NON_EXISTENT_MEMBER_ID),
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio no existe');
        expect(mockDisciplines).toHaveLength(0);
    });

    it('debe retornar 201 y cambiar Member.status a Suspendido cuando la suspensión total está activa', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload: buildPayload(SUSPENSION_MEMBER_ID, {
                is_total_suspension: true,
            }),
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: DisciplineDTO };

        expect(body.data.is_total_suspension).toBe(true);
        expect(body.data.previous_member_status).toBe('Moroso');
        expect(mockDisciplines).toHaveLength(1);
        expect(mockMembers[SUSPENSION_MEMBER_ID].status).toBe('Suspendido');
    });

    it('debe retornar 200 y un DisciplineDTO actualizado cuando PATCH recibe campos válidos', async () => {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload: buildPayload(ACTIVE_MEMBER_ID),
        });
        const createdBody = JSON.parse(createResponse.payload) as { data: DisciplineDTO };

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/disciplines/${createdBody.data.id}`,
            payload: {
                reason: 'Nuevo motivo disciplinario',
                end_date: daysFromNow(10),
            },
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: DisciplineDTO };

        expect(body.data.id).toBe(createdBody.data.id);
        expect(body.data.member_id).toBe(ACTIVE_MEMBER_ID);
        expect(body.data.reason).toBe('Nuevo motivo disciplinario');
        expect(new Date(body.data.end_date).getTime()).toBeGreaterThan(
            new Date(body.data.start_date).getTime(),
        );
        expect(mockDisciplines[0].reason).toBe('Nuevo motivo disciplinario');
    });

    it('debe retornar 400 cuando PATCH recibe member_id en el body', async () => {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload: buildPayload(ACTIVE_MEMBER_ID),
        });
        const createdBody = JSON.parse(createResponse.payload) as { data: DisciplineDTO };

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/disciplines/${createdBody.data.id}`,
            payload: {
                member_id: SUSPENSION_MEMBER_ID,
            },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El socio de la disciplina no puede modificarse');
        expect(mockDisciplines[0].member_id).toBe(ACTIVE_MEMBER_ID);
    });

    it('debe retornar 204 y restaurar Member.status cuando DELETE elimina una suspensión total activa', async () => {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/disciplines',
            payload: buildPayload(SUSPENSION_MEMBER_ID, {
                is_total_suspension: true,
            }),
        });
        const createdBody = JSON.parse(createResponse.payload) as { data: DisciplineDTO };

        expect(mockMembers[SUSPENSION_MEMBER_ID].status).toBe('Suspendido');

        const response = await app.inject({
            method: 'DELETE',
            url: `/api/v1/disciplines/${createdBody.data.id}`,
        });

        expect(response.statusCode).toBe(204);
        expect(response.payload).toBe('');
        expect(mockDisciplines).toHaveLength(0);
        expect(mockMembers[SUSPENSION_MEMBER_ID].status).toBe('Moroso');
    });

    it('debe retornar 404 cuando DELETE apunta a una disciplina inexistente', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/disciplines/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('La disciplina no existe');
    });
});
