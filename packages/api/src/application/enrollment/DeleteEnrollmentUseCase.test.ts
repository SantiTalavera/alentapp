import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO } from '@alentapp/shared';
import { DeleteEnrollmentUseCase } from './DeleteEnrollmentUseCase.js';
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
// La baja lógica solo utiliza findById y softDelete, pero se declara el puerto
// completo para mantener consistencia con los demás use cases de Enrollment.
// ---------------------------------------------------------------------------

const mockEnrollmentRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActiveByMemberAndSport: vi.fn(),
    countActiveBySportId: vi.fn(),
    update: vi.fn(),
    // softDelete marca deleted_at y pone is_active=false; no elimina el registro.
    // Esto preserva el historial de inscripción para auditoría.
    softDelete: vi.fn(),
} as unknown as EnrollmentRepository;

// ---------------------------------------------------------------------------
// Suite
// Diferencia clave entre baja lógica y eliminación física:
//   - Baja lógica: el registro permanece en la base de datos con deleted_at poblado.
//   - Eliminación física: el registro desaparece del almacenamiento.
// DeleteEnrollmentUseCase solo realiza baja lógica a través de softDelete.
// ---------------------------------------------------------------------------

describe('DeleteEnrollmentUseCase — tests unitarios', () => {
    const useCase = new DeleteEnrollmentUseCase(mockEnrollmentRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Baja lógica exitosa sobre inscripción vigente.
    it('debe dar de baja lógicamente una inscripción no eliminada', async () => {
        const existingDTO = buildEnrollmentDTO({ is_active: true, deleted_at: null });
        const deletedDTO  = buildEnrollmentDTO({
            is_active: false,
            deleted_at: '2026-05-31T00:00:00.000Z',
        });

        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(existingDTO);
        vi.mocked(mockEnrollmentRepo.softDelete).mockResolvedValueOnce(deletedDTO);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID);

        expect(mockEnrollmentRepo.findById).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID);
        expect(mockEnrollmentRepo.softDelete).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID);
        expect(result).toEqual(deletedDTO);
    });

    // TEST [2]: Identificador con formato no UUID → rechazo inmediato sin consultar el repo.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute('no-es-un-uuid')
        ).rejects.toThrow('Identificador de inscripción inválido');

        expect(mockEnrollmentRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [3]: UUID válido que no corresponde a ningún registro.
    it('debe rechazar cuando la inscripción no existe', async () => {
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID)
        ).rejects.toThrow('Inscripción no encontrada');

        expect(mockEnrollmentRepo.findById).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID);
        expect(mockEnrollmentRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [4]: Inscripción ya eliminada → no se puede eliminar dos veces.
    // La conservación del historial implica que el registro sigue existiendo,
    // pero con deleted_at poblado; reintentar la baja debe ser rechazado.
    it('debe rechazar cuando la inscripción ya fue eliminada', async () => {
        const alreadyDeletedDTO = buildEnrollmentDTO({
            is_active: false,
            deleted_at: '2026-01-15T00:00:00.000Z',
        });

        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(alreadyDeletedDTO);

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID)
        ).rejects.toThrow('La inscripción ya fue eliminada');

        expect(mockEnrollmentRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [5]: El retorno es exactamente el DTO que entrega el repositorio.
    it('debe retornar el DTO actualizado generado por el repositorio', async () => {
        const existingDTO = buildEnrollmentDTO({ is_active: true, deleted_at: null });
        const deletedDTO  = buildEnrollmentDTO({
            is_active: false,
            deleted_at: '2026-05-31T12:00:00.000Z',
        });

        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(existingDTO);
        vi.mocked(mockEnrollmentRepo.softDelete).mockResolvedValueOnce(deletedDTO);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID);

        expect(result).toStrictEqual(deletedDTO);
    });

    // TEST [6]: La baja lógica no altera member_id, sport_id ni enrollment_date.
    // Solo cambian deleted_at (de null a fecha ISO) e is_active (de true/false a false).
    it('debe conservar member_id, sport_id y enrollment_date al realizar la baja lógica', async () => {
        const originalDTO = buildEnrollmentDTO({
            member_id:       VALID_MEMBER_UUID,
            sport_id:        VALID_SPORT_UUID,
            enrollment_date: '2026-03-15T08:00:00.000Z',
            is_active:       true,
            deleted_at:      null,
        });
        const deletedDTO = buildEnrollmentDTO({
            member_id:       VALID_MEMBER_UUID,
            sport_id:        VALID_SPORT_UUID,
            enrollment_date: '2026-03-15T08:00:00.000Z',
            is_active:       false,
            deleted_at:      '2026-05-31T10:00:00.000Z',
        });

        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(originalDTO);
        vi.mocked(mockEnrollmentRepo.softDelete).mockResolvedValueOnce(deletedDTO);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID);

        expect(result.member_id).toBe(originalDTO.member_id);
        expect(result.sport_id).toBe(originalDTO.sport_id);
        expect(result.enrollment_date).toBe(originalDTO.enrollment_date);
        expect(result.deleted_at).not.toBeNull();
        expect(result.is_active).toBe(false);
    });
});
