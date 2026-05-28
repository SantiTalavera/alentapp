import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisciplineDTO } from '@alentapp/shared';
import { DeleteDisciplineUseCase } from './DeleteDisciplineUseCase.js';
import type { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import type { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

const DISCIPLINE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_DISCIPLINE_ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';
const MEMBER_ID = 'c1d2e3f4-a5b6-7890-abcd-ef1234567890';

function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

function buildDiscipline(overrides: Partial<DisciplineDTO> = {}): DisciplineDTO {
    return {
        id: DISCIPLINE_ID,
        member_id: MEMBER_ID,
        reason: 'Incumplimiento del reglamento interno',
        start_date: daysFromNow(-1),
        end_date: daysFromNow(7),
        is_total_suspension: true,
        previous_member_status: 'Activo',
        ...overrides,
    };
}

const mockDisciplineRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findByMemberId: vi.fn(),
    findActiveTotalSuspensionsByMemberId: vi.fn(),
    update: vi.fn(),
    updateWithMemberStatus: vi.fn(),
    delete: vi.fn(),
    deleteWithMemberStatus: vi.fn(),
} as unknown as DisciplineRepository;

const mockDisciplineValidator = {
    validateCreateRequest: vi.fn(),
    validateMemberId: vi.fn(),
    validateReason: vi.fn(),
    validateDateRequired: vi.fn(),
    validateDateRange: vi.fn(),
    validateIsTotalSuspension: vi.fn(),
    validatePreviousMemberStatus: vi.fn(),
    isActive: vi.fn(),
    validateUpdateRequest: vi.fn(),
    validateResultingDateRange: vi.fn(),
} as unknown as DisciplineValidator;

describe('DeleteDisciplineUseCase — tests unitarios', () => {
    const useCase = new DeleteDisciplineUseCase(
        mockDisciplineRepo,
        mockDisciplineValidator,
    );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mockDisciplineValidator.isActive).mockReturnValue(true);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValue([]);
        vi.mocked(mockDisciplineRepo.delete).mockResolvedValue(undefined);
        vi.mocked(mockDisciplineRepo.deleteWithMemberStatus).mockResolvedValue(undefined);
    });

    it('debe lanzar "Identificador de disciplina inválido" cuando el id no tiene formato UUID', async () => {
        await expect(useCase.execute('id-invalido')).rejects.toThrow(
            'Identificador de disciplina inválido',
        );

        expect(mockDisciplineRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.delete).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.deleteWithMemberStatus).not.toHaveBeenCalled();
    });

    it('debe lanzar "La disciplina no existe" cuando el id no corresponde a una disciplina existente', async () => {
        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(DISCIPLINE_ID)).rejects.toThrow(
            'La disciplina no existe',
        );

        expect(mockDisciplineRepo.findById).toHaveBeenCalledWith(DISCIPLINE_ID);
        expect(mockDisciplineRepo.delete).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.deleteWithMemberStatus).not.toHaveBeenCalled();
    });

    it('debe restaurar Member.status cuando la disciplina era suspensión total activa y no quedan otras', async () => {
        const currentDiscipline = buildDiscipline({
            previous_member_status: 'Moroso',
        });

        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(currentDiscipline);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([
            currentDiscipline,
        ]);

        await useCase.execute(DISCIPLINE_ID);

        expect(mockDisciplineValidator.isActive).toHaveBeenCalledWith(
            currentDiscipline.start_date,
            currentDiscipline.end_date,
        );
        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).toHaveBeenCalledWith(
            MEMBER_ID,
        );
        expect(mockDisciplineRepo.deleteWithMemberStatus).toHaveBeenCalledWith(
            DISCIPLINE_ID,
            MEMBER_ID,
            'Moroso',
        );
        expect(mockDisciplineRepo.delete).not.toHaveBeenCalled();
    });

    it('no debe restaurar Member.status cuando la disciplina era suspensión total activa pero quedan otras', async () => {
        const currentDiscipline = buildDiscipline({
            previous_member_status: 'Activo',
        });
        const otherActiveSuspension = buildDiscipline({
            id: OTHER_DISCIPLINE_ID,
            previous_member_status: 'Activo',
        });

        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(currentDiscipline);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([
            currentDiscipline,
            otherActiveSuspension,
        ]);

        await useCase.execute(DISCIPLINE_ID);

        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).toHaveBeenCalledWith(
            MEMBER_ID,
        );
        expect(mockDisciplineRepo.delete).toHaveBeenCalledWith(DISCIPLINE_ID);
        expect(mockDisciplineRepo.deleteWithMemberStatus).not.toHaveBeenCalled();
    });
});
