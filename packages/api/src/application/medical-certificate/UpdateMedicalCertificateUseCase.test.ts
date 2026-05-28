import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateMedicalCertificateUseCase } from './UpdateMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MedicalCertificateValidator } from '../../domain/services/MedicalCertificateValidator.js';
import { MedicalCertificateDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCertificateDTO(overrides: Partial<MedicalCertificateDTO> = {}): MedicalCertificateDTO {
    return {
        id: 'cert-uuid-0001',
        member_id: 'member-uuid-0001',
        issue_date: '2025-01-01T00:00:00.000Z',
        expiry_date: '2026-01-01T00:00:00.000Z',
        doctor_license: 'MN-12345',
        is_validated: true,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCertRepo = {
    findActiveByMemberId: vi.fn(),
    invalidateAllByMemberId: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByMemberId: vi.fn(),
} as unknown as MedicalCertificateRepository;

const mockValidator = {
    validateCreateRequest: vi.fn(),
    validateMemberId: vi.fn(),
    validateDoctorLicense: vi.fn(),
    validateDate: vi.fn(),
    validateDatesLogical: vi.fn(),
    validateUpdateRequest: vi.fn(),
    validateResultingDateRange: vi.fn(),
} as unknown as MedicalCertificateValidator;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('UpdateMedicalCertificateUseCase — tests unitarios', () => {
    const useCase = new UpdateMedicalCertificateUseCase(mockCertRepo, mockValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Test [1] — certificado inexistente → lanza 'El certificado médico no existe'
    // -------------------------------------------------------------------------
    it('debe lanzar "El certificado médico no existe" cuando el repositorio retorna null para ese id y no debe llamar a update', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute('cert-uuid-0001', { doctor_license: 'MN-99999' }),
        ).rejects.toThrow('El certificado médico no existe');

        expect(mockCertRepo.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [2] — body vacío → lanza 'Se debe enviar al menos un campo para actualizar'
    // -------------------------------------------------------------------------
    it('debe lanzar "Se debe enviar al menos un campo para actualizar" cuando el body está vacío y no debe consultar el repositorio', async () => {
        vi.mocked(mockValidator.validateUpdateRequest).mockImplementationOnce(() => {
            throw new Error('Se debe enviar al menos un campo para actualizar');
        });

        await expect(
            useCase.execute('cert-uuid-0001', {}),
        ).rejects.toThrow('Se debe enviar al menos un campo para actualizar');

        expect(mockCertRepo.findById).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [3] — body con member_id → lanza 'El socio titular del certificado no puede modificarse'
    // -------------------------------------------------------------------------
    it('debe lanzar "El socio titular del certificado no puede modificarse" cuando el body contiene member_id y no debe consultar el repositorio', async () => {
        vi.mocked(mockValidator.validateUpdateRequest).mockImplementationOnce(() => {
            throw new Error('El socio titular del certificado no puede modificarse');
        });

        await expect(
            useCase.execute('cert-uuid-0001', { member_id: 'member-uuid-0001' } as Record<string, unknown>),
        ).rejects.toThrow('El socio titular del certificado no puede modificarse');

        expect(mockCertRepo.findById).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [4] — expiry_date resultante anterior a issue_date existente → lanza error de rango
    // -------------------------------------------------------------------------
    it('debe lanzar el error de rango de fechas cuando la expiry_date resultante es anterior a la issue_date existente y no debe llamar a update', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(buildCertificateDTO());
        vi.mocked(mockValidator.validateResultingDateRange).mockImplementationOnce(() => {
            throw new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión');
        });

        await expect(
            useCase.execute('cert-uuid-0001', { expiry_date: '2024-01-01T00:00:00.000Z' }),
        ).rejects.toThrow('La fecha de vencimiento debe ser posterior a la fecha de emisión');

        expect(mockCertRepo.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [5] — solo expiry_date en body → combina con issue_date existente y actualiza
    // -------------------------------------------------------------------------
    it('debe combinar la issue_date existente con la expiry_date del body al validar el rango y debe actualizar correctamente el certificado', async () => {
        const updatedDTO = buildCertificateDTO({ expiry_date: '2027-01-01T00:00:00.000Z' });

        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(buildCertificateDTO());
        vi.mocked(mockCertRepo.update).mockResolvedValueOnce(updatedDTO);

        const result = await useCase.execute('cert-uuid-0001', { expiry_date: '2027-01-01T00:00:00.000Z' });

        expect(mockValidator.validateResultingDateRange).toHaveBeenCalledWith(
            '2025-01-01T00:00:00.000Z',
            '2027-01-01T00:00:00.000Z',
        );
        expect(mockCertRepo.update).toHaveBeenCalledWith(
            'cert-uuid-0001',
            expect.objectContaining({ expiry_date: '2027-01-01T00:00:00.000Z' }),
        );
        expect(result.expiry_date).toBe('2027-01-01T00:00:00.000Z');
    });
});
