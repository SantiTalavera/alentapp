import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { SportDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Almacenamiento en memoria para el mock de PostgresSportRepository.
// Reseteable en beforeEach para aislar cada test.
// ---------------------------------------------------------------------------

let mockSports: SportDTO[] = [];
let nextId = 1;

function buildMockSportId(): string {
    return `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
}

function resetSportStore() {
    mockSports = [];
    nextId = 1;
}

// ---------------------------------------------------------------------------
// Mock principal: PostgresSportRepository
// Implementa el contrato completo del puerto para facilitar ramas futuras.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresSportRepository.js', () => ({
    PostgresSportRepository: class {
        async create(data: Omit<SportDTO, 'id'>): Promise<SportDTO> {
            const sport: SportDTO = {
                id: buildMockSportId(),
                ...data,
            };
            mockSports.push(sport);
            return sport;
        }

        async findByName(name: string): Promise<SportDTO | null> {
            return mockSports.find((s) => s.name === name) ?? null;
        }

        async findAll(): Promise<SportDTO[]> {
            return mockSports.filter((s) => s.deleted_at === null);
        }

        async findById(id: string): Promise<SportDTO | null> {
            return mockSports.find((s) => s.id === id) ?? null;
        }

        async update(id: string, data: unknown): Promise<SportDTO> {
            const idx = mockSports.findIndex((s) => s.id === id);
            if (idx === -1) throw new Error('Deporte no encontrado');
            // Aplica solo los campos recibidos, preservando el resto del DTO.
            mockSports[idx] = { ...mockSports[idx], ...(data as Partial<SportDTO>) };
            return mockSports[idx];
        }

        async softDelete(id: string): Promise<SportDTO> {
            const sport = mockSports.find((s) => s.id === id)!;
            sport.deleted_at = new Date().toISOString();
            return sport;
        }
    },
}));

// ---------------------------------------------------------------------------
// Stubs de los demás repositorios importados por app.ts.
// Necesarios para evitar que DATABASE_URL lance errores al cargar el módulo.
// ---------------------------------------------------------------------------

vi.mock('../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByDni() { return null; }
        async create(data: unknown) { return data; }
        async update() { return {}; }
        async delete() { return; }
    },
}));

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
// Suite de integración
// Ruta bajo prueba: POST /api/v1/sports
// ---------------------------------------------------------------------------

describe('Sport API — tests de integración (POST /api/v1/sports)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetSportStore();
    });

    afterAll(async () => {
        await app.close();
    });

    const validPayload = {
        name: 'Futbol',
        description: 'Deporte de equipo con pelota',
        max_capacity: 22,
        additional_price: 1000,
        requires_medical_certificate: false,
    };

    // TEST [1]: POST válido → 201 con SportDTO y deleted_at null
    it('debe retornar 201 y un SportDTO con deleted_at null cuando el payload es válido', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: validPayload,
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.payload) as { data: SportDTO };
        expect(body.data.id).toBeDefined();
        expect(body.data.name).toBe('Futbol');
        expect(body.data.description).toBe('Deporte de equipo con pelota');
        expect(body.data.max_capacity).toBe(22);
        expect(body.data.additional_price).toBe(1000);
        expect(body.data.requires_medical_certificate).toBe(false);
        expect(body.data.deleted_at).toBeNull();
    });

    // TEST [2]: POST con nombre duplicado → 409
    it('debe retornar 409 cuando el nombre ya está registrado', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: validPayload,
        });

        const second = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: validPayload,
        });

        expect(second.statusCode).toBe(409);

        const body = JSON.parse(second.payload) as { error: string };
        expect(body.error).toBe('Ya existe un deporte con ese nombre');
    });

    // TEST [3]: POST con name vacío → 400
    it('debe retornar 400 cuando name está vacío', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: { ...validPayload, name: '' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El nombre del deporte es obligatorio');
    });

    // TEST [4]: POST con description vacía → 400
    it('debe retornar 400 cuando description está vacía', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: { ...validPayload, description: '' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('La descripción del deporte es obligatoria');
    });

    // TEST [5]: POST con max_capacity <= 0 → 400 (it.each: 0, -1)
    it.each([0, -1])(
        'debe retornar 400 cuando max_capacity es menor o igual a cero (%s)',
        async (max_capacity) => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload: { ...validPayload, max_capacity },
            });

            expect(response.statusCode).toBe(400);

            const body = JSON.parse(response.payload) as { error: string };
            expect(body.error).toBe('La capacidad máxima debe ser mayor a cero');
        },
    );

    // TEST [6]: POST con max_capacity decimal → 400
    it('debe retornar 400 cuando max_capacity no es entero', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: { ...validPayload, max_capacity: 1.5 },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('La capacidad máxima debe ser un número entero');
    });

    // TEST [7]: POST con additional_price negativo → 400
    it('debe retornar 400 cuando additional_price es negativo', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: { ...validPayload, additional_price: -100 },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El precio adicional debe ser mayor o igual a cero');
    });

    // TEST [8]: POST sin additional_price → 400
    it('debe retornar 400 cuando additional_price está ausente', async () => {
        const { additional_price: _, ...payloadSinPrecio } = validPayload;

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: payloadSinPrecio,
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El precio adicional es obligatorio');
    });

    // TEST [9]: POST con requires_medical_certificate no booleano → 400
    it('debe retornar 400 cuando requires_medical_certificate no es booleano', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: {
                ...validPayload,
                requires_medical_certificate: 'si' as unknown as boolean,
            },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El campo requiere certificado médico debe ser verdadero o falso');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: GET /api/v1/sports
// El listado operativo excluye deportes con baja lógica (deleted_at !== null).
// ---------------------------------------------------------------------------

describe('Sport API — tests de integración (GET /api/v1/sports)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetSportStore();
    });

    afterAll(async () => {
        await app.close();
    });

    const basePayload = {
        name: 'Futbol',
        description: 'Deporte de equipo con pelota',
        max_capacity: 22,
        additional_price: 1000,
        requires_medical_certificate: false,
    };

    // TEST [1]: Sin deportes creados → array vacío
    it('debe retornar 200 con un array vacío cuando no hay deportes activos', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sports',
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO[] };
        expect(body.data).toEqual([]);
    });

    // TEST [2]: Deportes activos creados previamente aparecen en el listado
    it('debe retornar 200 con los deportes activos', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: basePayload,
        });
        await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: { ...basePayload, name: 'Tenis' },
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sports',
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO[] };
        expect(body.data).toHaveLength(2);
        expect(body.data.map((s) => s.name)).toContain('Futbol');
        expect(body.data.map((s) => s.name)).toContain('Tenis');
    });

    // TEST [3]: Deportes con baja lógica quedan excluidos del listado operativo
    it('debe excluir deportes eliminados lógicamente del listado', async () => {
        // Insertar un deporte activo y uno con deleted_at poblado directamente en el store
        const activoId = buildMockSportId();
        const eliminadoId = buildMockSportId();
        mockSports.push({
            id: activoId,
            name: 'Natación',
            description: 'Deporte acuático',
            max_capacity: 30,
            additional_price: 800,
            requires_medical_certificate: false,
            deleted_at: null,
        });
        mockSports.push({
            id: eliminadoId,
            name: 'Karate',
            description: 'Arte marcial',
            max_capacity: 15,
            additional_price: 600,
            requires_medical_certificate: true,
            deleted_at: '2024-01-01T00:00:00.000Z',
        });

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sports',
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe('Natación');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: GET /api/v1/sports/:id
// Un deporte con baja lógica debe responder como no disponible (404).
// ---------------------------------------------------------------------------

describe('Sport API — tests de integración (GET /api/v1/sports/:id)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetSportStore();
    });

    afterAll(async () => {
        await app.close();
    });

    const basePayload = {
        name: 'Futbol',
        description: 'Deporte de equipo con pelota',
        max_capacity: 22,
        additional_price: 1000,
        requires_medical_certificate: false,
    };

    // TEST [1]: Deporte existente y activo → 200 con DTO
    it('debe retornar 200 con el deporte cuando existe y está activo', async () => {
        const postResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload: basePayload,
        });
        const created = JSON.parse(postResponse.payload) as { data: SportDTO };
        const id = created.data.id;

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/sports/${id}`,
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO };
        expect(body.data.id).toBe(id);
        expect(body.data.name).toBe('Futbol');
        expect(body.data.deleted_at).toBeNull();
    });

    // TEST [2]: ID con formato inválido (no UUID) → 400
    it('debe retornar 400 cuando el identificador tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sports/no-es-un-uuid',
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de deporte inválido');
    });

    // TEST [3]: UUID válido pero sin registro → 404
    it('debe retornar 404 cuando el deporte no existe', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sports/00000000-0000-4000-8000-000000000099',
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Deporte no encontrado');
    });

    // TEST [4]: Deporte con baja lógica debe responder como no disponible
    it('debe retornar 404 cuando el deporte fue eliminado lógicamente', async () => {
        const eliminadoId = buildMockSportId();
        mockSports.push({
            id: eliminadoId,
            name: 'Karate',
            description: 'Arte marcial',
            max_capacity: 15,
            additional_price: 600,
            requires_medical_certificate: true,
            deleted_at: '2024-01-01T00:00:00.000Z',
        });

        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/sports/${eliminadoId}`,
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Deporte no encontrado');
    });
});

// ---------------------------------------------------------------------------
// Suite de integración
// Ruta bajo prueba: PATCH /api/v1/sports/:id
// ---------------------------------------------------------------------------

describe('Sport API — tests de integración (PATCH /api/v1/sports/:id)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        resetSportStore();
    });

    afterAll(async () => {
        await app.close();
    });

    const basePayload = {
        name: 'Futbol',
        description: 'Deporte de equipo con pelota',
        max_capacity: 22,
        additional_price: 1000,
        requires_medical_certificate: false,
    };

    // POST como setup del recurso: crea un deporte real en el store y devuelve su id.
    async function crearDeporte(payload = basePayload): Promise<string> {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload,
        });
        const body = JSON.parse(response.payload) as { data: SportDTO };
        return body.data.id;
    }

    // TEST [1]: Actualización exitosa de todos los campos editables.
    it('debe retornar 200 y actualizar los campos permitidos', async () => {
        // POST como setup del recurso: se crea el deporte para obtener su id real.
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: {
                description: 'Descripción actualizada',
                max_capacity: 50,
                additional_price: 200,
                requires_medical_certificate: true,
            },
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO };
        expect(body.data.description).toBe('Descripción actualizada');
        expect(body.data.max_capacity).toBe(50);
        expect(body.data.additional_price).toBe(200);
        expect(body.data.requires_medical_certificate).toBe(true);
    });

    // TEST [2]: Los valores falsy 0 y false son válidos y no deben descartarse en la actualización.
    it('debe conservar additional_price igual a cero y requires_medical_certificate igual a false', async () => {
        const id = await crearDeporte({
            ...basePayload,
            additional_price: 500,
            requires_medical_certificate: true,
        });

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: { additional_price: 0, requires_medical_certificate: false },
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.payload) as { data: SportDTO };
        expect(body.data.additional_price).toBe(0);
        expect(body.data.requires_medical_certificate).toBe(false);
    });

    // TEST [3]: Body vacío → sin campos para actualizar.
    it('debe retornar 400 cuando el body está vacío', async () => {
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: {},
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Se requiere al menos un campo para actualizar');
    });

    // TEST [4]: name es inmutable luego de la creación.
    it('debe retornar 400 cuando se intenta modificar el nombre', async () => {
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: { name: 'Otro deporte' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El nombre del deporte no puede modificarse');
    });

    // TEST [5]: Campo no permitido.
    // La implementación trata deleted_at con su propio mensaje (no el genérico).
    it('debe retornar 400 cuando se intenta modificar un campo no permitido', async () => {
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: { deleted_at: '2026-01-01T00:00:00.000Z' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No se puede modificar el campo deleted_at');
    });

    // TEST [6]: max_capacity inválido (it.each con mensajes distintos por caso).
    it.each([
        [0, 'La capacidad máxima debe ser mayor a cero'],
        [1.5, 'La capacidad máxima debe ser un número entero'],
    ] as Array<[number, string]>)(
        'debe retornar 400 cuando max_capacity es inválido (%s)',
        async (max_capacity, expectedError) => {
            const id = await crearDeporte();

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/sports/${id}`,
                payload: { max_capacity },
            });

            expect(response.statusCode).toBe(400);

            const body = JSON.parse(response.payload) as { error: string };
            expect(body.error).toBe(expectedError);
        },
    );

    // TEST [7]: additional_price negativo.
    it('debe retornar 400 cuando additional_price es negativo', async () => {
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: { additional_price: -1 },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El precio adicional no puede ser negativo');
    });

    // TEST [8]: requires_medical_certificate debe ser booleano.
    it('debe retornar 400 cuando requires_medical_certificate no es booleano', async () => {
        const id = await crearDeporte();

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${id}`,
            payload: { requires_medical_certificate: 'si' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('El campo requiere certificado médico debe ser verdadero o falso');
    });

    // TEST [9]: ID con formato inválido.
    it('debe retornar 400 cuando el identificador tiene formato inválido', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/sports/no-es-un-uuid',
            payload: { description: 'x' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Identificador de deporte inválido');
    });

    // TEST [10]: UUID válido pero sin registro en el store.
    it('debe retornar 404 cuando el deporte no existe', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/sports/00000000-0000-4000-8000-000000000099',
            payload: { description: 'x' },
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('Deporte no encontrado');
    });

    // TEST [11]: Deporte con baja lógica.
    // Preparación manual de un deporte eliminado en el store para simular baja lógica
    // sin necesidad de implementar ni ejecutar el endpoint DELETE.
    it('debe retornar 409 cuando el deporte fue eliminado lógicamente', async () => {
        const eliminadoId = buildMockSportId();
        mockSports.push({
            id: eliminadoId,
            name: 'Karate',
            description: 'Arte marcial',
            max_capacity: 15,
            additional_price: 600,
            requires_medical_certificate: true,
            deleted_at: '2024-01-01T00:00:00.000Z',
        });

        const response = await app.inject({
            method: 'PATCH',
            url: `/api/v1/sports/${eliminadoId}`,
            payload: { description: 'Actualizado' },
        });

        expect(response.statusCode).toBe(409);

        const body = JSON.parse(response.payload) as { error: string };
        expect(body.error).toBe('No se puede modificar un deporte eliminado');
    });
});

