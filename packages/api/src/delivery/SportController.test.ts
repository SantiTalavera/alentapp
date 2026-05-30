import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateSportRequest, SportDTO } from '@alentapp/shared';
import { SportController } from './SportController.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildCreateRequest(overrides: Partial<CreateSportRequest> = {}): CreateSportRequest {
    return {
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        ...overrides,
    };
}

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: SPORT_ID,
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks de casos de uso
// ---------------------------------------------------------------------------

// Se mockean todos los casos de uso requeridos por el constructor.
const mockNewSportUseCase = { execute: vi.fn() };
const mockGetSportsUseCase = { execute: vi.fn() };
const mockGetSportByIdUseCase = { execute: vi.fn() };
const mockUpdateSportUseCase = { execute: vi.fn() };
const mockDeleteSportUseCase = { execute: vi.fn() };

const controller = new SportController(
    mockNewSportUseCase as any,
    mockGetSportsUseCase as any,
    mockGetSportByIdUseCase as any,
    mockUpdateSportUseCase as any,
    mockDeleteSportUseCase as any,
);

// ---------------------------------------------------------------------------
// Mock de FastifyReply con encadenamiento .code().send()
// ---------------------------------------------------------------------------

// FastifyReply mínimo encadenable para probar el controller sin levantar HTTP real.
function buildMockReply() {
    const reply = {
        code: vi.fn(),
        send: vi.fn(),
    };
    // code() retorna el mismo objeto para permitir .code(...).send(...)
    reply.code.mockReturnValue(reply);
    return reply;
}

// ---------------------------------------------------------------------------
// Suite create() - Tests unitarios
// ---------------------------------------------------------------------------

describe('SportController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] - Alta exitosa
    it('debe responder 201 con { data: SportDTO } cuando el alta es exitosa', async () => {
        const sportDTO = buildSportDTO();
        mockNewSportUseCase.execute.mockResolvedValueOnce(sportDTO);

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest() };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockNewSportUseCase.execute).toHaveBeenCalledWith(mockRequest.body);
        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: sportDTO });
    });

    // TEST [2] - Error de validación de dominio
    it('debe responder 400 cuando el caso de uso informa un error de validación', async () => {
        mockNewSportUseCase.execute.mockRejectedValueOnce(
            new Error('El nombre del deporte es obligatorio'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest({ name: '' }) };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El nombre del deporte es obligatorio',
        });
    });

    // TEST [3] - Nombre duplicado
    it('debe responder 409 cuando el nombre ya existe', async () => {
        mockNewSportUseCase.execute.mockRejectedValueOnce(
            new Error('Ya existe un deporte con ese nombre'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest() };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(409);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Ya existe un deporte con ese nombre',
        });
    });

    // TEST [4] - Error inesperado de infraestructura
    it('debe responder 500 ante un error inesperado', async () => {
        mockNewSportUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest() };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// ---------------------------------------------------------------------------
// Suite getAll() - Tests unitarios
// ---------------------------------------------------------------------------

describe('SportController — getAll()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Listado con deportes activos
    it('debe responder 200 con la lista de deportes', async () => {
        const sports = [buildSportDTO(), buildSportDTO({ id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Natación' })];
        mockGetSportsUseCase.execute.mockResolvedValueOnce(sports);

        const mockReply = buildMockReply();

        await controller.getAll({} as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: sports });
    });

    // TEST [2]: Sin deportes activos → array vacío
    it('debe responder 200 con un array vacío cuando no existen deportes activos', async () => {
        mockGetSportsUseCase.execute.mockResolvedValueOnce([]);

        const mockReply = buildMockReply();

        await controller.getAll({} as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: [] });
    });

    // TEST [3]: Error inesperado de infraestructura
    it('debe responder 500 ante un error inesperado al listar', async () => {
        mockGetSportsUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply = buildMockReply();

        await controller.getAll({} as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error interno, reintente más tarde' });
    });
});

// ---------------------------------------------------------------------------
// Suite getById() - Tests unitarios
// ---------------------------------------------------------------------------

describe('SportController — getById()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Deporte encontrado y activo
    it('debe responder 200 con el deporte cuando existe', async () => {
        const sportDTO = buildSportDTO();
        mockGetSportByIdUseCase.execute.mockResolvedValueOnce(sportDTO);

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: SPORT_ID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: sportDTO });
    });

    // TEST [2]: Identificador con formato inválido
    it('debe responder 400 cuando el identificador es inválido', async () => {
        mockGetSportByIdUseCase.execute.mockRejectedValueOnce(
            new Error('Identificador de deporte inválido'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: 'no-es-uuid' } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Identificador de deporte inválido' });
    });

    // TEST [3]: Deporte no encontrado o dado de baja lógica
    it('debe responder 404 cuando el deporte no existe o no está disponible', async () => {
        mockGetSportByIdUseCase.execute.mockRejectedValueOnce(
            new Error('Deporte no encontrado'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: SPORT_ID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Deporte no encontrado' });
    });

    // TEST [4]: Error inesperado de infraestructura
    it('debe responder 500 ante un error inesperado al consultar', async () => {
        mockGetSportByIdUseCase.execute.mockRejectedValueOnce(new Error('fallo db'));

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: SPORT_ID } };

        await controller.getById(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error interno, reintente más tarde' });
    });
});
