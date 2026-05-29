import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockerController } from './LockerController.js';

describe('LockerController (Responsabilidad: Manejo HTTP, Status Codes y Respuesta)', () => {
    // 1. Mocks de los Casos de Uso del controlador
    const mockNewLockerUseCase = { execute: vi.fn() };
    const mockUpdateLockerUseCase = { execute: vi.fn() };
    const mockDeleteLockerUseCase = { execute: vi.fn() };
    const mockGetLockersUseCase = { execute: vi.fn() };
    const mockGetLockerByIdUseCase = { execute: vi.fn() };

    const controller = new LockerController(
        mockNewLockerUseCase as any,
        mockUpdateLockerUseCase as any,
        mockDeleteLockerUseCase as any,
        mockGetLockersUseCase as any,
        mockGetLockerByIdUseCase as any
    );

    // 2. Mocks de Fastify Request y Reply
    const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn()
    };

    const mockRequest = {
        body: { number: 10, location: 'Pasillo A' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create (Alta de Casillero)', () => {
        it('debe responder con HTTP 201 y los datos si el caso de uso es exitoso', async () => {
            const mockCreatedLocker = {
                id: 'uuid-123',
                number: 10,
                location: 'Pasillo A',
                status: 'Available',
                member_id: null,
                is_active: true
            };

            mockNewLockerUseCase.execute.mockResolvedValueOnce(mockCreatedLocker);

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockNewLockerUseCase.execute).toHaveBeenCalledWith(mockRequest.body);
            expect(mockReply.code).toHaveBeenCalledWith(201);
            expect(mockReply.send).toHaveBeenCalledWith({ data: mockCreatedLocker });
        });

        it('debe responder con HTTP 409 Conflict si el número de casillero ya está registrado', async () => {
            mockNewLockerUseCase.execute.mockRejectedValueOnce(new Error('número de casillero ya registrado'));

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(409);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'número de casillero ya registrado' });
        });

        it('debe responder con HTTP 400 Bad Request si el caso de uso lanza un error de validación (debe ser mayor a cero)', async () => {
            mockNewLockerUseCase.execute.mockRejectedValueOnce(new Error('debe ser mayor a cero'));

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'debe ser mayor a cero' });
        });

        it('debe responder con HTTP 400 Bad Request si el caso de uso lanza un error de validación (campo requerido)', async () => {
            mockNewLockerUseCase.execute.mockRejectedValueOnce(new Error('campo requerido'));

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'campo requerido' });
        });

        it('debe responder con HTTP 500 para cualquier otro error desconocido o de infraestructura', async () => {
            mockNewLockerUseCase.execute.mockRejectedValueOnce(new Error('Error inesperado de base de datos...'));

            await controller.create(mockRequest as any, mockReply as any);

            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error interno' });
        });
    });
});
