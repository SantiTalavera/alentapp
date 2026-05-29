import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteEquipmentLoanUseCase } from './DeleteEquipmentLoanUseCase.js';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_LOAN_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_MEMBER_UUID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function buildLoanDTO(overrides: Partial<EquipmentLoanDTO> = {}): EquipmentLoanDTO {
    return {
        id: VALID_LOAN_UUID,
        item_name: 'Pelota de Básquet',
        status: 'Prestado',
        loan_date: '2026-05-24T12:00:00.000Z',
        due_date: null,
        member_id: VALID_MEMBER_UUID,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mock del repositorio (único puerto del caso de uso)
// ---------------------------------------------------------------------------

const mockEquipmentLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as EquipmentLoanRepository;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('DeleteEquipmentLoanUseCase — tests unitarios', () => {
    const useCase = new DeleteEquipmentLoanUseCase(mockEquipmentLoanRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Test [1] – status Returned (Devuelto) → 422
    // -------------------------------------------------------------------------
    it('debe lanzar un error de regla de negocio cuando el préstamo tiene estado "Devuelto" (Returned)', async () => {
        const existingLoan = buildLoanDTO({ status: 'Devuelto' });
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);

        await expect(
            useCase.execute(VALID_LOAN_UUID),
        ).rejects.toThrow('No se puede eliminar un préstamo con estado Returned/Damaged');

        expect(mockEquipmentLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_UUID);
        expect(mockEquipmentLoanRepo.softDelete).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [2] – status Damaged (Dañado) → 422
    // -------------------------------------------------------------------------
    it('debe lanzar un error de regla de negocio cuando el préstamo tiene estado "Dañado" (Damaged)', async () => {
        const existingLoan = buildLoanDTO({ status: 'Dañado' });
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);

        await expect(
            useCase.execute(VALID_LOAN_UUID),
        ).rejects.toThrow('No se puede eliminar un préstamo con estado Returned/Damaged');

        expect(mockEquipmentLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_UUID);
        expect(mockEquipmentLoanRepo.softDelete).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [3] – status Loaned (Prestado) → 200 con EquipmentLoanDTO con deleted_at poblado
    // -------------------------------------------------------------------------
    it('debe retornar un EquipmentLoanDTO con "deleted_at" poblado cuando el préstamo tiene estado "Prestado" (Loaned)', async () => {
        const existingLoan = buildLoanDTO({ status: 'Prestado' });
        const deletedLoan = buildLoanDTO({
            status: 'Prestado',
            deleted_at: '2026-05-28T22:00:00.000Z',
        });

        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);
        vi.mocked(mockEquipmentLoanRepo.softDelete).mockResolvedValueOnce(deletedLoan);

        const result = await useCase.execute(VALID_LOAN_UUID);

        expect(result.id).toBe(VALID_LOAN_UUID);
        expect(result.deleted_at).not.toBeNull();
        expect(result.deleted_at).toBe('2026-05-28T22:00:00.000Z');
        expect(mockEquipmentLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_UUID);
        expect(mockEquipmentLoanRepo.softDelete).toHaveBeenCalledWith(VALID_LOAN_UUID);
    });

    // -------------------------------------------------------------------------
    // Test [4] – préstamo inexistente → 404
    // -------------------------------------------------------------------------
    it('debe lanzar "El préstamo no existe" cuando el repositorio retorna null para ese id', async () => {
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_LOAN_UUID),
        ).rejects.toThrow('El préstamo no existe');

        expect(mockEquipmentLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_UUID);
        expect(mockEquipmentLoanRepo.softDelete).not.toHaveBeenCalled();
    });
});
