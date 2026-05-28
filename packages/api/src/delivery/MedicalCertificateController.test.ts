import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicalCertificateController } from './MedicalCertificateController.js';
import type { MedicalCertificateDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CERT_UUID = 'cert-uuid-0001';
const MEMBER_UUID = 'member-uuid-0001';

function buildCertificateDTO(overrides: Partial<MedicalCertificateDTO> = {}): MedicalCertificateDTO {
    return {
        id: CERT_UUID,
        member_id: MEMBER_UUID,
        issue_date: '2025-01-01T00:00:00.000Z',
        expiry_date: '2026-01-01T00:00:00.000Z',
        doctor_license: 'MN-12345',
        is_validated: true,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks de casos de uso
// ---------------------------------------------------------------------------

const mockCreateUseCase = { execute: vi.fn() };
const mockUpdateUseCase = { execute: vi.fn() };
const mockDeleteUseCase = { execute: vi.fn() };

// El controlador requiere los 5 casos de uso; los restantes se pasan como stubs
// vacíos ya que sus tests se implementarán en otras iteraciones.
const controller = new MedicalCertificateController(
    mockCreateUseCase as any,
    mockUpdateUseCase as any,
    mockDeleteUseCase as any,
    { execute: vi.fn() } as any, // GetMedicalCertificatesByMemberUseCase — pendiente
    { execute: vi.fn() } as any, // GetMedicalCertificateByIdUseCase — pendiente
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
// Suite create() - Tests unitarios
// ---------------------------------------------------------------------------

describe('MedicalCertificateController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] - Crea un certificado de manera exitosa

    it('debe responder con código 201 y el MedicalCertificateDTO cuando el certificado es creado exitosamente', async () => {
        const certificate = buildCertificateDTO();
        mockCreateUseCase.execute.mockResolvedValueOnce(certificate);

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: MEMBER_UUID,
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: certificate });
    });

    // TEST [2] - El socio no existe

    it('debe responder con código 404 cuando el UseCase informa que el socio no existe', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('El socio no existe'));

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: 'member-inexistente',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El socio no existe' });
    });

    // TEST [3] - La fecha de vencimiento es anterior a la fecha de emisión

    it('debe responder con código 400 cuando la fecha de vencimiento es anterior a la de emisión', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(
            new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: MEMBER_UUID,
                issue_date: '2026-01-01',
                expiry_date: '2025-01-01',
                doctor_license: 'MN-12345',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'La fecha de vencimiento debe ser posterior a la fecha de emisión',
        });
    });

    // TEST [4] - La matrícula del médico está vacía

    it('debe responder con código 400 cuando la matrícula del médico está vacía', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(
            new Error('La matrícula del médico es requerida'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: MEMBER_UUID,
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: '',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'La matrícula del médico es requerida' });
    });

    // TEST [5] - El identificador del socio está vacío

    it('debe responder con código 400 cuando el identificador del socio está vacío', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('El socio es requerido'));

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: '',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El socio es requerido' });
    });

    // TEST [6] - Error inesperado del sistema

    it('debe responder con código 500 ante un error inesperado del sistema', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('Prisma connection timeout'));

        const mockReply = buildMockReply();
        const mockRequest = {
            body: {
                member_id: MEMBER_UUID,
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
                doctor_license: 'MN-12345',
            },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error interno, reintente más tarde' });
    });
});

// ---------------------------------------------------------------------------
// Suite — update() - Tests unitarios
// ---------------------------------------------------------------------------

describe('MedicalCertificateController — update()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] — Actualiza un certificado de manera exitosa

    it('debe llamar al caso de uso con id y body, y responder 200 con el MedicalCertificateDTO actualizado', async () => {
        const certificate = buildCertificateDTO({ expiry_date: '2027-01-01T00:00:00.000Z' });
        mockUpdateUseCase.execute.mockResolvedValueOnce(certificate);

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
            body: { expiry_date: '2027-01-01' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(CERT_UUID, { expiry_date: '2027-01-01' });
        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ data: certificate });
    });

    // TEST [2] - El certificado médico no existe

    it('debe responder con código 404 cuando el certificado médico no existe', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(new Error('El certificado médico no existe'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
            body: { expiry_date: '2027-01-01' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El certificado médico no existe' });
    });

    // TEST [3] - El body está vacío

    it('debe responder con código 400 cuando el body está vacío', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(
            new Error('Se debe enviar al menos un campo para actualizar'),
        );

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
            body: {},
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Se debe enviar al menos un campo para actualizar',
        });
    });

    // TEST [4] - Error inesperado del sistema

    it('debe responder con código 500 ante un error inesperado del sistema', async () => {
        mockUpdateUseCase.execute.mockRejectedValueOnce(new Error('Prisma connection timeout'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
            body: { doctor_license: 'MN-99999' },
        };

        await controller.update(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error interno, reintente más tarde' });
    });
});

// ---------------------------------------------------------------------------
// Suite — delete() - Tests unitarios
// ---------------------------------------------------------------------------

describe('MedicalCertificateController — delete()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] — Delete exitoso → 204 sin body

    it('debe llamar al caso de uso con el id correcto y responder 204 sin body cuando el certificado existe', async () => {
        mockDeleteUseCase.execute.mockResolvedValueOnce(undefined);

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
        };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(CERT_UUID);
        expect(mockReply.code).toHaveBeenCalledWith(204);
        expect(mockReply.send).toHaveBeenCalledWith();
    });

    // TEST [2] — Certificado inexistente → 404

    it('debe responder con código 404 cuando el certificado médico no existe', async () => {
        mockDeleteUseCase.execute.mockRejectedValueOnce(new Error('El certificado médico no existe'));

        const mockReply = buildMockReply();
        const mockRequest = {
            params: { id: CERT_UUID },
        };

        await controller.delete(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'El certificado médico no existe' });
    });
});
