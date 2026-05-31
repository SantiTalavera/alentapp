import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO } from '@alentapp/shared';
import { EnrollmentController } from './EnrollmentController.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID     = '11111111-1111-4111-8111-111111111111';
const VALID_SPORT_UUID      = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

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
// Mocks de los cinco casos de uso requeridos por el constructor real.
// Solo create recibe comportamiento real controlado en esta rama.
// ---------------------------------------------------------------------------

const mockCreateEnrollmentUseCase    = { execute: vi.fn() };
const mockUpdateEnrollmentUseCase    = { execute: vi.fn() };
const mockGetEnrollmentsUseCase      = { execute: vi.fn() };
const mockGetEnrollmentByIdUseCase   = { execute: vi.fn() };
const mockDeleteEnrollmentUseCase    = { execute: vi.fn() };

const controller = new EnrollmentController(
    mockCreateEnrollmentUseCase as any,
    mockUpdateEnrollmentUseCase as any,
    mockGetEnrollmentsUseCase as any,
    mockGetEnrollmentByIdUseCase as any,
    mockDeleteEnrollmentUseCase as any,
);

// ---------------------------------------------------------------------------
// Reply mínimo encadenable: permite .code(...).send(...) sin HTTP real.
// ---------------------------------------------------------------------------

function buildMockReply() {
    const reply = { code: vi.fn(), send: vi.fn() };
    reply.code.mockReturnValue(reply);
    return reply;
}

// ---------------------------------------------------------------------------
// Suite create() — tests unitarios
// ---------------------------------------------------------------------------

describe('EnrollmentController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Alta exitosa
    it('debe responder 201 con { data: EnrollmentDTO } cuando el alta es exitosa', async () => {
        const dto = buildEnrollmentDTO();
        mockCreateEnrollmentUseCase.execute.mockResolvedValueOnce(dto);

        const mockReply = buildMockReply();
        const mockRequest = { body: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockCreateEnrollmentUseCase.execute).toHaveBeenCalledWith(mockRequest.body);
        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: dto });
    });

    // TEST [2-4]: Errores de formato → 400 Bad Request
    it.each([
        'El socio es obligatorio',
        'El deporte es obligatorio',
        'Identificador inválido',
    ] as const)(
        'debe responder 400 cuando el use case lanza "%s"',
        async (message) => {
            mockCreateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply = buildMockReply();
            const mockRequest = {
                body: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID },
            };

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [5-6]: Entidades inexistentes → 404 Not Found
    it.each([
        'Socio no encontrado',
        'Deporte no encontrado',
    ] as const)(
        'debe responder 404 cuando el use case lanza "%s"',
        async (message) => {
            mockCreateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply = buildMockReply();
            const mockRequest = {
                body: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID },
            };

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(404);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [7-10]: Reglas de negocio violadas → 409 Conflict
    it.each([
        'El socio no está habilitado para inscribirse',
        'No se puede inscribir en un deporte eliminado',
        'El socio ya está inscripto en este deporte',
        'No hay cupo disponible para este deporte',
    ] as const)(
        'debe responder 409 cuando el use case lanza "%s"',
        async (message) => {
            mockCreateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply = buildMockReply();
            const mockRequest = {
                body: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID },
            };

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(409);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [11]: Error de infraestructura no mapeado → 500
    it('debe responder 500 ante un error inesperado', async () => {
        mockCreateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply = buildMockReply();
        const mockRequest = { body: { member_id: VALID_MEMBER_UUID, sport_id: VALID_SPORT_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// ---------------------------------------------------------------------------
// Suite getAll() — tests unitarios
// ---------------------------------------------------------------------------

describe('EnrollmentController — getAll()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Listado exitoso.
    it('debe responder 200 con la lista de inscripciones', async () => {
        const enrollments = [buildEnrollmentDTO()];
        mockGetEnrollmentsUseCase.execute.mockResolvedValueOnce(enrollments);

        const mockReply   = buildMockReply();
        const mockRequest = { query: {} };

        await controller.getAll(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: enrollments });
    });

    // TEST [2]: Repositorio vacío → array vacío.
    it('debe responder 200 con un array vacío cuando no existen inscripciones operativas', async () => {
        mockGetEnrollmentsUseCase.execute.mockResolvedValueOnce([]);

        const mockReply   = buildMockReply();
        const mockRequest = { query: {} };

        await controller.getAll(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: [] });
    });

    // TEST [3-5]: Filtros con formato inválido → 400 Bad Request.
    it.each([
        'Identificador de socio inválido',
        'Identificador de deporte inválido',
        'Filtro de vigencia inválido',
    ] as const)(
        'debe responder 400 cuando el use case lanza "%s"',
        async (message) => {
            mockGetEnrollmentsUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply   = buildMockReply();
            const mockRequest = { query: {} };

            await controller.getAll(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [6]: Error de infraestructura no mapeado → 500.
    it('debe responder 500 ante un error inesperado al listar', async () => {
        mockGetEnrollmentsUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply   = buildMockReply();
        const mockRequest = { query: {} };

        await controller.getAll(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// ---------------------------------------------------------------------------
// Suite getById() — tests unitarios
// ---------------------------------------------------------------------------

describe('EnrollmentController — getById()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Consulta exitosa.
    it('debe responder 200 con la inscripción cuando existe', async () => {
        const dto = buildEnrollmentDTO();
        mockGetEnrollmentByIdUseCase.execute.mockResolvedValueOnce(dto);

        const mockReply   = buildMockReply();
        const mockRequest = { params: { id: VALID_ENROLLMENT_UUID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: dto });
    });

    // TEST [2]: Identificador inválido → 400.
    it('debe responder 400 cuando el identificador es inválido', async () => {
        mockGetEnrollmentByIdUseCase.execute.mockRejectedValueOnce(
            new Error('Identificador de inscripción inválido')
        );

        const mockReply   = buildMockReply();
        const mockRequest = { params: { id: 'no-uuid' } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Identificador de inscripción inválido' });
    });

    // TEST [3]: Inscripción inexistente o eliminada → 404.
    it('debe responder 404 cuando la inscripción no existe o fue eliminada', async () => {
        mockGetEnrollmentByIdUseCase.execute.mockRejectedValueOnce(
            new Error('Inscripción no encontrada')
        );

        const mockReply   = buildMockReply();
        const mockRequest = { params: { id: VALID_ENROLLMENT_UUID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Inscripción no encontrada' });
    });

    // TEST [4]: Error de infraestructura no mapeado → 500.
    it('debe responder 500 ante un error inesperado al consultar', async () => {
        mockGetEnrollmentByIdUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply   = buildMockReply();
        const mockRequest = { params: { id: VALID_ENROLLMENT_UUID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// ---------------------------------------------------------------------------
// Suite update() — tests unitarios
// ---------------------------------------------------------------------------

describe('EnrollmentController — update()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Actualización exitosa → 200 con EnrollmentDTO actualizado.
    it('debe responder 200 con la inscripción actualizada', async () => {
        const dto = buildEnrollmentDTO({ is_active: false });
        mockUpdateEnrollmentUseCase.execute.mockResolvedValueOnce(dto);

        const mockReply   = buildMockReply();
        const mockRequest = {
            params: { id: VALID_ENROLLMENT_UUID },
            body: { is_active: false },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockUpdateEnrollmentUseCase.execute).toHaveBeenCalledWith(
            VALID_ENROLLMENT_UUID,
            { is_active: false }
        );
        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: dto });
    });

    // TEST [2-5]: Errores de validación de formato → 400 Bad Request.
    it.each([
        'Identificador de inscripción inválido',
        'Se requiere al menos un campo para actualizar',
        'Campo no permitido para modificación',
        'El campo is_active debe ser booleano',
    ] as const)(
        'debe responder 400 cuando el use case lanza "%s"',
        async (message) => {
            mockUpdateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply   = buildMockReply();
            const mockRequest = {
                params: { id: VALID_ENROLLMENT_UUID },
                body: {},
            };

            await controller.update(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [6]: Inscripción inexistente → 404.
    it('debe responder 404 cuando la inscripción no existe', async () => {
        const message = 'Inscripción no encontrada';
        mockUpdateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

        const mockReply   = buildMockReply();
        const mockRequest = {
            params: { id: VALID_ENROLLMENT_UUID },
            body: { is_active: false },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: message });
    });

    // TEST [7-11]: Reglas de negocio violadas → 409 Conflict.
    it.each([
        'No se puede modificar una inscripción eliminada',
        'El socio no está habilitado',
        'El deporte no está disponible',
        'Ya existe una inscripción activa para este deporte',
        'No hay cupo disponible para este deporte',
    ] as const)(
        'debe responder 409 cuando el use case lanza "%s"',
        async (message) => {
            mockUpdateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error(message));

            const mockReply   = buildMockReply();
            const mockRequest = {
                params: { id: VALID_ENROLLMENT_UUID },
                body: { is_active: true },
            };

            await controller.update(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(409);
            expect(mockReply.send).toHaveBeenCalledWith({ error: message });
        }
    );

    // TEST [12]: Error de infraestructura no mapeado → 500.
    it('debe responder 500 ante un error inesperado', async () => {
        mockUpdateEnrollmentUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply   = buildMockReply();
        const mockRequest = {
            params: { id: VALID_ENROLLMENT_UUID },
            body: { is_active: false },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});
