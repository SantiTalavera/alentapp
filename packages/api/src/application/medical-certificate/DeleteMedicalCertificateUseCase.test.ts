import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMedicalCertificateUseCase } from './DeleteMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
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
    findById: vi.fn(),
    delete: vi.fn(),
} as unknown as MedicalCertificateRepository;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('DeleteMedicalCertificateUseCase — tests unitarios', () => {
    const useCase = new DeleteMedicalCertificateUseCase(mockCertRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] — certificado inexistente → lanza 'El certificado médico no existe'
    it('debe lanzar "El certificado médico no existe" cuando el repositorio retorna null para ese id y no debe llamar a delete', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-0001')).rejects.toThrow('El certificado médico no existe');

        expect(mockCertRepo.delete).not.toHaveBeenCalled();
    });

    // TEST [2] — certificado activo (is_validated true) → borrado físico exitoso
    it('debe llamar a delete con el id correcto y resolver sin error cuando el certificado está activo (is_validated true)', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(buildCertificateDTO({ is_validated: true }));
        vi.mocked(mockCertRepo.delete).mockResolvedValueOnce(undefined);

        await expect(useCase.execute('cert-uuid-0001')).resolves.toBeUndefined();

        expect(mockCertRepo.delete).toHaveBeenCalledWith('cert-uuid-0001');
    });

    // TEST [3] — certificado inactivo (is_validated false) → borrado físico exitoso
    it('debe llamar a delete con el id correcto y resolver sin error cuando el certificado está inactivo (is_validated false)', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(buildCertificateDTO({ is_validated: false }));
        vi.mocked(mockCertRepo.delete).mockResolvedValueOnce(undefined);

        await expect(useCase.execute('cert-uuid-0001')).resolves.toBeUndefined();

        expect(mockCertRepo.delete).toHaveBeenCalledWith('cert-uuid-0001');
    });
});
