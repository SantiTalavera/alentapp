import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateDisciplineRequest, DisciplineDTO, UpdateDisciplineRequest } from '@alentapp/shared';
import { DisciplineController } from './DisciplineController.js';

const DISCIPLINE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';

function buildCreateRequest(
    overrides: Partial<CreateDisciplineRequest> = {},
): CreateDisciplineRequest {
    return {
        member_id: MEMBER_ID,
        reason: 'Incumplimiento del reglamento interno',
        start_date: '2026-05-20T00:00:00.000Z',
        end_date: '2026-05-27T00:00:00.000Z',
        is_total_suspension: false,
        ...overrides,
    };
}

function buildDiscipline(overrides: Partial<DisciplineDTO> = {}): DisciplineDTO {
    return {
        id: DISCIPLINE_ID,
        member_id: MEMBER_ID,
        reason: 'Incumplimiento del reglamento interno',
        start_date: '2026-05-20T00:00:00.000Z',
        end_date: '2026-05-27T00:00:00.000Z',
        is_total_suspension: false,
        previous_member_status: null,
        ...overrides,
    };
}

const mockNewDisciplineUseCase = { execute: vi.fn() };
const mockUpdateDisciplineUseCase = { execute: vi.fn() };
const mockGetDisciplineByIdUseCase = { execute: vi.fn() };
const mockGetDisciplineByMemberIdUseCase = { execute: vi.fn() };
const mockDeleteDisciplineUseCase = { execute: vi.fn() };

const controller = new DisciplineController(
    mockNewDisciplineUseCase as any,
    mockUpdateDisciplineUseCase as any,
    mockGetDisciplineByIdUseCase as any,
    mockGetDisciplineByMemberIdUseCase as any,
    mockDeleteDisciplineUseCase as any,
);

function buildMockReply() {
    const reply = {
        code: vi.fn(),
        send: vi.fn(),
    };

    reply.code.mockReturnValue(reply);
    return reply;
}

describe('DisciplineController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe llamar al caso de uso con el body recibido y responder 201 con la disciplina creada', async () => {
        const requestBody = buildCreateRequest();
        const discipline = buildDiscipline();
        mockNewDisciplineUseCase.execute.mockResolvedValueOnce(discipline);

        const mockReply = buildMockReply();
        const mockRequest = { body: requestBody };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockNewDisciplineUseCase.execute).toHaveBeenCalledWith(requestBody);
        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: discipline });
    });

    it('debe responder 404 cuando el caso de uso informa que el socio no existe', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(new Error('El socio no existe'));

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest() };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El socio no existe' });
    });

    it('debe responder 400 cuando el motivo de la disciplina es inválido', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('El motivo de la disciplina es requerido'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest({ reason: '' }) };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El motivo de la disciplina es requerido',
        });
    });

    it('debe responder 400 cuando la fecha de fin no es posterior a la fecha de inicio', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('La fecha de fin debe ser posterior a la fecha de inicio'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            body: buildCreateRequest({
                start_date: '2026-05-20T00:00:00.000Z',
                end_date: '2026-05-20T00:00:00.000Z',
            }),
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'La fecha de fin debe ser posterior a la fecha de inicio',
        });
    });

    it('debe responder 400 cuando is_total_suspension no es booleano', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('El campo suspensión total debe ser verdadero o falso'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            body: buildCreateRequest({
                is_total_suspension: 'true' as unknown as boolean,
            }),
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El campo suspensión total debe ser verdadero o falso',
        });
    });

    it('debe responder 400 cuando el estado previo del socio no es válido', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('El estado previo del socio debe ser Activo o Moroso'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest({ is_total_suspension: true }) };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El estado previo del socio debe ser Activo o Moroso',
        });
    });

    it('debe responder 500 ante un error inesperado del sistema', async () => {
        mockNewDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('Prisma connection timeout'),
        );

        const mockReply = buildMockReply();
        const mockRequest = { body: buildCreateRequest() };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});

describe('DisciplineController — update()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe llamar al caso de uso con id y body, y responder 200 con la disciplina actualizada', async () => {
        const requestBody: UpdateDisciplineRequest = {
            reason: 'Nuevo motivo',
            is_total_suspension: true,
        };
        const discipline = buildDiscipline({
            reason: 'Nuevo motivo',
            is_total_suspension: true,
            previous_member_status: 'Activo',
        });
        mockUpdateDisciplineUseCase.execute.mockResolvedValueOnce(discipline);

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: requestBody,
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockUpdateDisciplineUseCase.execute).toHaveBeenCalledWith(
            DISCIPLINE_ID,
            requestBody,
        );
        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: discipline });
    });

    it('debe responder 404 cuando la disciplina no existe', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('La disciplina no existe'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: { reason: 'Nuevo motivo' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'La disciplina no existe' });
    });

    it('debe responder 404 cuando el socio asociado no existe', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(new Error('El socio no existe'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: { is_total_suspension: true },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El socio no existe' });
    });

    it('debe responder 400 cuando el body está vacío', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('Se debe enviar al menos un campo para actualizar'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: {},
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Se debe enviar al menos un campo para actualizar',
        });
    });

    it('debe responder 400 cuando el body contiene member_id', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('El socio de la disciplina no puede modificarse'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: { member_id: MEMBER_ID },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El socio de la disciplina no puede modificarse',
        });
    });

    it('debe responder 400 cuando la fecha de fin no es posterior a la fecha de inicio', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('La fecha de fin debe ser posterior a la fecha de inicio'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: {
                start_date: '2026-05-20T00:00:00.000Z',
                end_date: '2026-05-20T00:00:00.000Z',
            },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'La fecha de fin debe ser posterior a la fecha de inicio',
        });
    });

    it('debe responder 400 cuando el estado previo del socio no es válido', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('El estado previo del socio debe ser Activo o Moroso'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: { is_total_suspension: true },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'El estado previo del socio debe ser Activo o Moroso',
        });
    });

    it('debe responder 500 ante un error inesperado del sistema', async () => {
        mockUpdateDisciplineUseCase.execute.mockRejectedValueOnce(
            new Error('Prisma connection timeout'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: DISCIPLINE_ID },
            body: { reason: 'Nuevo motivo' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Error interno, reintente más tarde',
        });
    });
});
