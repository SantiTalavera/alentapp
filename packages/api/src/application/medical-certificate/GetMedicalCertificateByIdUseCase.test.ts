import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMedicalCertificateByIdUseCase } from './GetMedicalCertificateByIdUseCase.js';
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
} as unknown as MedicalCertificateRepository;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('GetMedicalCertificateByIdUseCase — tests unitarios', () => {
    const useCase = new GetMedicalCertificateByIdUseCase(mockCertRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1] — certificado existe → retorna MedicalCertificateDTO
    it('debe llamar a findById con el id correcto y retornar el MedicalCertificateDTO cuando el certificado existe', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(buildCertificateDTO());

        const result = await useCase.execute('cert-uuid-0001');

        expect(mockCertRepo.findById).toHaveBeenCalledWith('cert-uuid-0001');
        expect(result.id).toBe('cert-uuid-0001');
        expect(result.is_validated).toBe(true);
    });

    // TEST [2] — certificado inexistente → lanza 'Certificado no encontrado'
    it('debe lanzar "Certificado no encontrado" cuando el repositorio retorna null para ese id', async () => {
        vi.mocked(mockCertRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-0001')).rejects.toThrow('Certificado no encontrado');
    });
});
