import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO } from '@alentapp/shared';
import { GetEnrollmentByIdUseCase } from './GetEnrollmentByIdUseCase.js';
import type { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';

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
// Mock completo del puerto de persistencia.
// ---------------------------------------------------------------------------

const mockEnrollmentRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActiveByMemberAndSport: vi.fn(),
    countActiveBySportId: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as EnrollmentRepository;

// ---------------------------------------------------------------------------
// Suite GetEnrollmentByIdUseCase — tests unitarios
//
// Distinción conceptual:
//   is_active=false y deleted_at=null → inscripción histórica visible
//   deleted_at!=null                  → fuera del circuito operativo
// ---------------------------------------------------------------------------

describe('GetEnrollmentByIdUseCase — tests unitarios', () => {
    const useCase = new GetEnrollmentByIdUseCase(mockEnrollmentRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Inscripción vigente retornada normalmente.
    it('debe retornar la inscripción cuando existe y está vigente', async () => {
        const dto = buildEnrollmentDTO({ is_active: true, deleted_at: null });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(dto);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID);

        expect(result).toEqual(dto);
        expect(mockEnrollmentRepo.findById).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID);
    });

    // TEST [2]: Inscripción histórica (is_active=false, deleted_at=null) visible.
    it('debe retornar una inscripción histórica cuando no fue eliminada', async () => {
        const dto = buildEnrollmentDTO({ is_active: false, deleted_at: null });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(dto);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID);

        expect(result).toEqual(dto);
    });

    // TEST [3]: UUID inválido rechazado antes de consultar.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute('no-uuid')
        ).rejects.toThrow('Identificador de inscripción inválido');

        expect(mockEnrollmentRepo.findById).not.toHaveBeenCalled();
    });

    // TEST [4]: UUID válido pero inexistente.
    it('debe rechazar cuando la inscripción no existe', async () => {
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID)
        ).rejects.toThrow('Inscripción no encontrada');
    });

    // TEST [5]: Baja lógica (deleted_at poblado) → fuera del circuito operativo.
    it('debe considerar no disponible una inscripción eliminada lógicamente', async () => {
        const dto = buildEnrollmentDTO({ deleted_at: '2025-01-01T00:00:00.000Z' });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(dto);

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID)
        ).rejects.toThrow('Inscripción no encontrada');
    });
});
