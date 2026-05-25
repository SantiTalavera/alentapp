import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateEquipmentLoanUseCase } from './UpdateEquipmentLoanUseCase.js';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';
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
// Mocks
// ---------------------------------------------------------------------------

const mockEquipmentLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as EquipmentLoanRepository;

const mockEquipmentLoanValidator = {
    validate: vi.fn(),
    validateMemberId: vi.fn(),
    validateId: vi.fn(),
    validateStatusTransition: vi.fn(),
} as unknown as EquipmentLoanValidator;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('UpdateEquipmentLoanUseCase — tests unitarios', () => {
    const useCase = new UpdateEquipmentLoanUseCase(
        mockEquipmentLoanRepo,
        mockEquipmentLoanValidator,
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Test [1] – préstamo inexistente → 404 (lanza "El préstamo no existe")
    // -------------------------------------------------------------------------
    it('debe lanzar "El préstamo no existe" cuando el préstamo no es encontrado en el repositorio', async () => {
        vi.mocked(mockEquipmentLoanValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_LOAN_UUID, { status: 'Devuelto' }),
        ).rejects.toThrow('El préstamo no existe');

        expect(mockEquipmentLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_UUID);
        expect(mockEquipmentLoanRepo.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [2] – transición desde Returned (Devuelto) → 422
    // -------------------------------------------------------------------------
    it('debe lanzar un error cuando se intenta realizar una transición desde un préstamo con estado terminal "Devuelto"', async () => {
        const existingLoan = buildLoanDTO({ status: 'Devuelto' });
        vi.mocked(mockEquipmentLoanValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);
        vi.mocked(mockEquipmentLoanValidator.validateStatusTransition).mockImplementationOnce(() => {
            throw new Error('El préstamo ya se encuentra en un estado terminal y no puede ser modificado');
        });

        await expect(
            useCase.execute(VALID_LOAN_UUID, { status: 'Prestado' }),
        ).rejects.toThrow('El préstamo ya se encuentra en un estado terminal y no puede ser modificado');

        expect(mockEquipmentLoanValidator.validateStatusTransition).toHaveBeenCalledWith('Devuelto', 'Prestado');
        expect(mockEquipmentLoanRepo.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [3] – transición desde Damaged (Dañado) → 422
    // -------------------------------------------------------------------------
    it('debe lanzar un error cuando se intenta realizar una transición desde un préstamo con estado terminal "Dañado"', async () => {
        const existingLoan = buildLoanDTO({ status: 'Dañado' });
        vi.mocked(mockEquipmentLoanValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);
        vi.mocked(mockEquipmentLoanValidator.validateStatusTransition).mockImplementationOnce(() => {
            throw new Error('El préstamo ya se encuentra en un estado terminal y no puede ser modificado');
        });

        await expect(
            useCase.execute(VALID_LOAN_UUID, { status: 'Prestado' }),
        ).rejects.toThrow('El préstamo ya se encuentra en un estado terminal y no puede ser modificado');

        expect(mockEquipmentLoanValidator.validateStatusTransition).toHaveBeenCalledWith('Dañado', 'Prestado');
        expect(mockEquipmentLoanRepo.update).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [4] – Loaned (Prestado) → Returned (Devuelto) → éxito
    // -------------------------------------------------------------------------
    it('debe actualizar exitosamente el estado de "Prestado" a "Devuelto"', async () => {
        const existingLoan = buildLoanDTO({ status: 'Prestado' });
        const updatedLoan = buildLoanDTO({ status: 'Devuelto' });

        vi.mocked(mockEquipmentLoanValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);
        vi.mocked(mockEquipmentLoanValidator.validateStatusTransition).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.update).mockResolvedValueOnce(updatedLoan);

        const result = await useCase.execute(VALID_LOAN_UUID, { status: 'Devuelto' });

        expect(result.status).toBe('Devuelto');
        expect(mockEquipmentLoanValidator.validateStatusTransition).toHaveBeenCalledWith('Prestado', 'Devuelto');
        expect(mockEquipmentLoanRepo.update).toHaveBeenCalledWith(VALID_LOAN_UUID, { status: 'Devuelto' });
    });

    // -------------------------------------------------------------------------
    // Test [5] – Loaned (Prestado) → Damaged (Dañado) → éxito
    // -------------------------------------------------------------------------
    it('debe actualizar exitosamente el estado de "Prestado" a "Dañado"', async () => {
        const existingLoan = buildLoanDTO({ status: 'Prestado' });
        const updatedLoan = buildLoanDTO({ status: 'Dañado' });

        vi.mocked(mockEquipmentLoanValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.findById).mockResolvedValueOnce(existingLoan);
        vi.mocked(mockEquipmentLoanValidator.validateStatusTransition).mockReturnValue(undefined);
        vi.mocked(mockEquipmentLoanRepo.update).mockResolvedValueOnce(updatedLoan);

        const result = await useCase.execute(VALID_LOAN_UUID, { status: 'Dañado' });

        expect(result.status).toBe('Dañado');
        expect(mockEquipmentLoanValidator.validateStatusTransition).toHaveBeenCalledWith('Prestado', 'Dañado');
        expect(mockEquipmentLoanRepo.update).toHaveBeenCalledWith(VALID_LOAN_UUID, { status: 'Dañado' });
    });
});
