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
// Mock del caso de uso de creación
// ---------------------------------------------------------------------------

const mockCreateUseCase = { execute: vi.fn() };

// El controlador requiere los 5 casos de uso; los restantes se pasan como stubs
// vacíos ya que sus tests se implementarán en otras ramas.
const controller = new MedicalCertificateController(
    mockCreateUseCase as any,
    { execute: vi.fn() } as any, // UpdateMedicalCertificateUseCase — pendiente
    { execute: vi.fn() } as any, // DeleteMedicalCertificateUseCase — pendiente
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
// Suite
// ---------------------------------------------------------------------------

describe('MedicalCertificateController — create()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
