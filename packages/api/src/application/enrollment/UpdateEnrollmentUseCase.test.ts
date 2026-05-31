import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO } from '@alentapp/shared';
import { UpdateEnrollmentUseCase } from './UpdateEnrollmentUseCase.js';
import type { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';
import type { EnrollmentValidator } from '../../domain/services/EnrollmentValidator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID     = '11111111-1111-4111-8111-111111111111';
const VALID_SPORT_UUID      = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';

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
// Mock del servicio de validación de dominio.
// validateUpdateEnrollmentBody valida el body (sync).
// validateEnrollmentReactivation valida condiciones de reactivación (async).
// ---------------------------------------------------------------------------

const mockValidator = {
    validateNewEnrollment: vi.fn(),
    validateUpdateEnrollmentBody: vi.fn(),
    validateEnrollmentReactivation: vi.fn(),
} as unknown as EnrollmentValidator;

// ---------------------------------------------------------------------------
// Suite UpdateEnrollmentUseCase — tests unitarios
// Diferencia clave entre desactivar y reactivar:
//   - Desactivar (true→false): no ejecuta validaciones de dependencias adicionales.
//   - Reactivar (false→true): valida socio, deporte, duplicados y cupo antes de persistir.
// En ambos casos, enrollment_date no se incluye en el payload de update().
// ---------------------------------------------------------------------------

describe('UpdateEnrollmentUseCase — tests unitarios', () => {
    const useCase = new UpdateEnrollmentUseCase(mockEnrollmentRepo, mockValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: ID inválido rechazado antes de cualquier consulta al repositorio.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute('no-uuid', { is_active: false })
        ).rejects.toThrow('Identificador de inscripción inválido');

        expect(mockEnrollmentRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
    });

    // TEST [2]: Inscripción inexistente.
    it('debe rechazar cuando la inscripción no existe', async () => {
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID, { is_active: false })
        ).rejects.toThrow('Inscripción no encontrada');

        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
    });

    // TEST [3]: Inscripción con baja lógica.
    it('debe rechazar cuando la inscripción está eliminada lógicamente', async () => {
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(
            buildEnrollmentDTO({ deleted_at: '2025-01-01T00:00:00.000Z' })
        );

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID, { is_active: false })
        ).rejects.toThrow('No se puede modificar una inscripción eliminada');

        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
    });

    // TEST [4]: Error del validator de body propagado sin persistir.
    it('debe propagar el error del validator de body sin persistir', async () => {
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(buildEnrollmentDTO());
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockImplementationOnce(() => {
            throw new Error('Se requiere al menos un campo para actualizar');
        });

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID, {})
        ).rejects.toThrow('Se requiere al menos un campo para actualizar');

        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
    });

    // TEST [5]: Mismo valor de is_active → retorna sin modificar.
    // update() no se llama y validateEnrollmentReactivation tampoco.
    it('debe retornar la inscripción sin modificaciones cuando is_active ya tiene el mismo valor', async () => {
        const enrollment = buildEnrollmentDTO({ is_active: true });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(enrollment);
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockReturnValueOnce({ is_active: true });

        const result = await useCase.execute(VALID_ENROLLMENT_UUID, { is_active: true });

        expect(result).toEqual(enrollment);
        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
        expect(mockValidator.validateEnrollmentReactivation).not.toHaveBeenCalled();
    });

    // TEST [6]: Desactivación (true→false) sin validaciones adicionales.
    it('debe desactivar una inscripción sin ejecutar validaciones adicionales', async () => {
        const enrollment = buildEnrollmentDTO({ is_active: true });
        const updated    = buildEnrollmentDTO({ is_active: false });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(enrollment);
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockReturnValueOnce({ is_active: false });
        vi.mocked(mockEnrollmentRepo.update).mockResolvedValueOnce(updated);

        const result = await useCase.execute(VALID_ENROLLMENT_UUID, { is_active: false });

        expect(mockEnrollmentRepo.update).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID, { is_active: false });
        expect(mockValidator.validateEnrollmentReactivation).not.toHaveBeenCalled();
        expect(result).toEqual(updated);
    });

    // TEST [7]: Reactivación (false→true) con validación de condiciones operativas.
    it('debe reactivar una inscripción después de validar las condiciones operativas', async () => {
        const enrollment = buildEnrollmentDTO({ is_active: false });
        const updated    = buildEnrollmentDTO({ is_active: true });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(enrollment);
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockReturnValueOnce({ is_active: true });
        vi.mocked(mockValidator.validateEnrollmentReactivation).mockResolvedValueOnce(undefined);
        vi.mocked(mockEnrollmentRepo.update).mockResolvedValueOnce(updated);

        await useCase.execute(VALID_ENROLLMENT_UUID, { is_active: true });

        expect(mockValidator.validateEnrollmentReactivation).toHaveBeenCalledWith(
            VALID_MEMBER_UUID,
            VALID_SPORT_UUID,
            VALID_ENROLLMENT_UUID
        );
        expect(mockEnrollmentRepo.update).toHaveBeenCalledWith(VALID_ENROLLMENT_UUID, { is_active: true });
    });

    // TEST [8]: Error de reactivación propagado sin persistir.
    it('debe propagar un error de reactivación sin persistir', async () => {
        const enrollment = buildEnrollmentDTO({ is_active: false });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(enrollment);
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockReturnValueOnce({ is_active: true });
        vi.mocked(mockValidator.validateEnrollmentReactivation).mockRejectedValueOnce(
            new Error('No hay cupo disponible para este deporte')
        );

        await expect(
            useCase.execute(VALID_ENROLLMENT_UUID, { is_active: true })
        ).rejects.toThrow('No hay cupo disponible para este deporte');

        expect(mockEnrollmentRepo.update).not.toHaveBeenCalled();
    });

    // TEST [9]: El payload de update() contiene únicamente is_active.
    // enrollment_date representa el historial de la inscripción y no debe incluirse en la mutación.
    it('debe modificar únicamente is_active sin alterar enrollment_date', async () => {
        const enrollment = buildEnrollmentDTO({ is_active: true });
        vi.mocked(mockEnrollmentRepo.findById).mockResolvedValueOnce(enrollment);
        vi.mocked(mockValidator.validateUpdateEnrollmentBody).mockReturnValueOnce({ is_active: false });
        vi.mocked(mockEnrollmentRepo.update).mockResolvedValueOnce(
            buildEnrollmentDTO({ is_active: false })
        );

        await useCase.execute(VALID_ENROLLMENT_UUID, { is_active: false });

        const [, payload] = vi.mocked(mockEnrollmentRepo.update).mock.calls[0];
        expect(payload).toEqual({ is_active: false });
        expect(payload).not.toHaveProperty('member_id');
        expect(payload).not.toHaveProperty('sport_id');
        expect(payload).not.toHaveProperty('enrollment_date');
        expect(payload).not.toHaveProperty('deleted_at');
    });
});
