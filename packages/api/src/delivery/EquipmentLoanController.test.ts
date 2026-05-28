import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentLoanController } from './EquipmentLoanController.js';
import type { EquipmentLoanDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOAN_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MEMBER_UUID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function buildLoan(overrides: Partial<EquipmentLoanDTO> = {}): EquipmentLoanDTO {
    return {
        id: LOAN_UUID,
        item_name: 'Raqueta de Tenis',
        status: 'Prestado',
        loan_date: '2026-05-24T12:00:00.000Z',
        due_date: null,
        member_id: MEMBER_UUID,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mock del caso de uso de creación
// ---------------------------------------------------------------------------

const mockCreateUseCase = { execute: vi.fn() };

// El controlador requiere los 5 casos de uso; los restantes se pasan como stubs
// vacíos ya que sus tests se implementarán en otras ramas.
const controller = new EquipmentLoanController(
    mockCreateUseCase as any,
    { execute: vi.fn() } as any, // GetEquipmentLoansUseCase — pendiente
    { execute: vi.fn() } as any, // GetEquipmentLoanByIdUseCase — pendiente
    { execute: vi.fn() } as any, // UpdateEquipmentLoanUseCase — pendiente
    { execute: vi.fn() } as any, // DeleteEquipmentLoanUseCase — pendiente
);

// ---------------------------------------------------------------------------
// Mock de FastifyReply con encadenamiento .code().send()
// ---------------------------------------------------------------------------

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
// Suite
// ---------------------------------------------------------------------------

describe('EquipmentLoanController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe responder con código 201 y el EquipmentLoanDTO cuando el préstamo es creado exitosamente', async () => {
        const loan = buildLoan();
        mockCreateUseCase.execute.mockResolvedValueOnce(loan);

        const mockReply = buildMockReply();
        const mockRequest = {
            body: { item_name: 'Raqueta de Tenis', member_id: MEMBER_UUID },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: loan });
    });

    it('debe responder con código 404 cuando el socio no existe (Socio no encontrado)', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('Socio no encontrado'));

        const mockReply = buildMockReply();
        const mockRequest = { body: { item_name: 'Pelota', member_id: MEMBER_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Socio no encontrado' });
    });

    it('debe responder con código 422 cuando el socio no está activo (regla de negocio)', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(
            new Error('El socio no está activo y no puede solicitar un préstamo'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: { item_name: 'Guantes', member_id: MEMBER_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(422);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El socio no está activo y no puede solicitar un préstamo',
        });
    });

    it('debe responder con código 422 cuando el socio tiene categoría Cadete', async () => {
        const cadetMsg =
            'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.';
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error(cadetMsg));

        const mockReply = buildMockReply();
        const mockRequest = { body: { item_name: 'Bicicleta', member_id: MEMBER_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(422);
        expect(mockReply.send).toHaveBeenCalledWith({ error: cadetMsg });
    });

    it('debe responder con código 400 cuando el nombre del ítem está vacío', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(
            new Error('El nombre del ítem es obligatorio'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: { item_name: '', member_id: MEMBER_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El nombre del ítem es obligatorio' });
    });

    it('debe responder con código 500 ante un error inesperado del sistema', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(
            new Error('Prisma connection timeout'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: { item_name: 'Ítem', member_id: MEMBER_UUID } };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// =========================================================================
// update()
// =========================================================================
describe('update()', () => {
    const mockUpdateUseCase = { execute: vi.fn() };

    beforeEach(() => {
        (controller as any).updateEquipmentLoanUseCase = mockUpdateUseCase;
        mockUpdateUseCase.execute.mockReset();
    });

    it('debe responder con código 200 y el EquipmentLoanDTO cuando el préstamo es actualizado exitosamente', async () => {
        const loan = buildLoan({ status: 'Devuelto' });
        mockUpdateUseCase.execute.mockResolvedValueOnce(loan);

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: LOAN_UUID },
            body: { status: 'Devuelto' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: loan });
        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(LOAN_UUID, { status: 'Devuelto' });
    });

    it('debe responder con código 404 cuando el préstamo no existe', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(new Error('El préstamo no existe'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: LOAN_UUID },
            body: { status: 'Devuelto' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El préstamo no existe' });
    });

    it('debe responder con código 422 cuando la transición de estado no es válida', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(
            new Error('El préstamo ya se encuentra en un estado terminal y no puede ser modificado'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: LOAN_UUID },
            body: { status: 'Prestado' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(422);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El préstamo ya se encuentra en un estado terminal y no puede ser modificado',
        });
    });

    it('debe responder con código 500 ante un error inesperado del sistema', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(new Error('Prisma connection timeout'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: LOAN_UUID },
            body: { status: 'Devuelto' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

// =========================================================================
// delete()
// =========================================================================
describe('delete()', () => {
    const mockDeleteUseCase = { execute: vi.fn() };

    beforeEach(() => {
        (controller as any).deleteEquipmentLoanUseCase = mockDeleteUseCase;
        mockDeleteUseCase.execute.mockReset();
    });

    it('debe responder con código 200 y el EquipmentLoanDTO con "deleted_at" poblado cuando el préstamo en estado "Prestado" es eliminado exitosamente', async () => {
        const loan = buildLoan({ deleted_at: '2026-05-28T22:00:00.000Z' });
        mockDeleteUseCase.execute.mockResolvedValueOnce(loan);

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: LOAN_UUID } };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: loan });
        expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(LOAN_UUID);
    });

    it('debe responder con código 404 cuando el préstamo no existe', async () => {
        mockDeleteUseCase.execute.mockRejectedValueOnce(new Error('El préstamo no existe'));

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: LOAN_UUID } };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El préstamo no existe' });
    });

    it('debe responder con código 422 cuando se intenta eliminar un préstamo con estado "Devuelto" (Returned)', async () => {
        mockDeleteUseCase.execute.mockRejectedValueOnce(
            new Error('No se puede eliminar un préstamo con estado Returned/Damaged'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: LOAN_UUID } };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(422);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'No se puede eliminar un préstamo con estado Returned/Damaged',
        });
    });

    it('debe responder con código 500 ante un error inesperado del sistema', async () => {
        mockDeleteUseCase.execute.mockRejectedValueOnce(new Error('Prisma connection timeout'));

        const mockReply = buildMockReply();
        const mockRequest = { params: { id: LOAN_UUID } };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

