import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisciplineDTO, MemberDTO, UpdateDisciplineRequest } from '@alentapp/shared';
import { UpdateDisciplineUseCase } from './UpdateDisciplineUseCase.js';
import type { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import type { MemberRepository } from '../../domain/MemberRepository.js';
import type { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

type UpdateDisciplineInput = UpdateDisciplineRequest & Record<string, unknown>;

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
        is_total_suspension: false,
        previous_member_status: null,
        ...overrides,
    };
}

function buildMember(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: MEMBER_ID,
        dni: '12345678',
        name: 'Socio de Prueba',
        email: 'socio@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2026-05-01T00:00:00.000Z',
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

const mockMemberRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findByDni: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as unknown as MemberRepository;

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

describe('UpdateDisciplineUseCase — tests unitarios', () => {
    const useCase = new UpdateDisciplineUseCase(
        mockDisciplineRepo,
        mockMemberRepo,
        mockDisciplineValidator,
    );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mockDisciplineValidator.validateUpdateRequest).mockReturnValue(undefined);
        vi.mocked(mockDisciplineValidator.validateResultingDateRange).mockReturnValue(undefined);
        vi.mocked(mockDisciplineValidator.validatePreviousMemberStatus).mockReturnValue(undefined);
        vi.mocked(mockDisciplineValidator.isActive).mockReturnValue(true);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValue([]);
    });

    it('debe lanzar "La disciplina no existe" cuando el id no corresponde a una disciplina existente', async () => {
        const request: UpdateDisciplineInput = { reason: 'Nuevo motivo' };
        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(DISCIPLINE_ID, request)).rejects.toThrow(
            'La disciplina no existe',
        );

        expect(mockDisciplineValidator.validateUpdateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineRepo.findById).toHaveBeenCalledWith(DISCIPLINE_ID);
        expect(mockDisciplineRepo.update).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.updateWithMemberStatus).not.toHaveBeenCalled();
    });

    it('debe propagar el error del validator cuando el body está vacío', async () => {
        const request: UpdateDisciplineInput = {};
        vi.mocked(mockDisciplineValidator.validateUpdateRequest).mockImplementationOnce(() => {
            throw new Error('Se debe enviar al menos un campo para actualizar');
        });

        await expect(useCase.execute(DISCIPLINE_ID, request)).rejects.toThrow(
            'Se debe enviar al menos un campo para actualizar',
        );

        expect(mockDisciplineValidator.validateUpdateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.update).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.updateWithMemberStatus).not.toHaveBeenCalled();
    });

    it('debe propagar el error del validator cuando el body contiene member_id', async () => {
        const request: UpdateDisciplineInput = { member_id: MEMBER_ID };
        vi.mocked(mockDisciplineValidator.validateUpdateRequest).mockImplementationOnce(() => {
            throw new Error('El socio de la disciplina no puede modificarse');
        });

        await expect(useCase.execute(DISCIPLINE_ID, request)).rejects.toThrow(
            'El socio de la disciplina no puede modificarse',
        );

        expect(mockDisciplineValidator.validateUpdateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.update).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.updateWithMemberStatus).not.toHaveBeenCalled();
    });

    it('debe suspender al socio cuando is_total_suspension cambia de false a true y queda vigente', async () => {
        const currentDiscipline = buildDiscipline({ is_total_suspension: false });
        const request: UpdateDisciplineInput = { is_total_suspension: true };
        const expectedDiscipline = buildDiscipline({
            is_total_suspension: true,
            previous_member_status: 'Activo',
        });

        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(currentDiscipline);
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember({ status: 'Activo' }));
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([]);
        vi.mocked(mockDisciplineRepo.updateWithMemberStatus).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(DISCIPLINE_ID, request);

        expect(mockDisciplineValidator.validateUpdateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineValidator.validateResultingDateRange).toHaveBeenCalledWith(
            currentDiscipline.start_date,
            currentDiscipline.end_date,
        );
        expect(mockMemberRepo.findById).toHaveBeenCalledWith(MEMBER_ID);
        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).toHaveBeenCalledWith(
            MEMBER_ID,
        );
        expect(mockDisciplineValidator.validatePreviousMemberStatus).toHaveBeenCalledWith('Activo');
        expect(mockDisciplineRepo.updateWithMemberStatus).toHaveBeenCalledWith(
            DISCIPLINE_ID,
            expect.objectContaining({
                is_total_suspension: true,
                previous_member_status: 'Activo',
            }),
            MEMBER_ID,
            'Suspendido',
        );
        expect(mockDisciplineRepo.update).not.toHaveBeenCalled();
        expect(result).toEqual(expectedDiscipline);
    });

    it('debe restaurar Member.status con previous_member_status cuando is_total_suspension cambia de true a false', async () => {
        const currentDiscipline = buildDiscipline({
            is_total_suspension: true,
            previous_member_status: 'Moroso',
        });
        const request: UpdateDisciplineInput = { is_total_suspension: false };
        const expectedDiscipline = buildDiscipline({
            is_total_suspension: false,
            previous_member_status: null,
        });

        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(currentDiscipline);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([
            currentDiscipline,
        ]);
        vi.mocked(mockDisciplineRepo.updateWithMemberStatus).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(DISCIPLINE_ID, request);

        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).toHaveBeenCalledWith(
            MEMBER_ID,
        );
        expect(mockDisciplineRepo.updateWithMemberStatus).toHaveBeenCalledWith(
            DISCIPLINE_ID,
            expect.objectContaining({
                is_total_suspension: false,
                previous_member_status: null,
            }),
            MEMBER_ID,
            'Moroso',
        );
        expect(mockDisciplineRepo.update).not.toHaveBeenCalled();
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
        expect(result).toEqual(expectedDiscipline);
    });

    it('no debe restaurar Member.status si queda otra disciplina total activa', async () => {
        const currentDiscipline = buildDiscipline({
            is_total_suspension: true,
            previous_member_status: 'Activo',
        });
        const otherActiveSuspension = buildDiscipline({
            id: OTHER_DISCIPLINE_ID,
            is_total_suspension: true,
            previous_member_status: 'Activo',
        });
        const request: UpdateDisciplineInput = { is_total_suspension: false };
        const expectedDiscipline = buildDiscipline({
            is_total_suspension: false,
            previous_member_status: null,
        });

        vi.mocked(mockDisciplineRepo.findById).mockResolvedValueOnce(currentDiscipline);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([
            currentDiscipline,
            otherActiveSuspension,
        ]);
        vi.mocked(mockDisciplineRepo.update).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(DISCIPLINE_ID, request);

        expect(mockDisciplineRepo.updateWithMemberStatus).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.update).toHaveBeenCalledWith(
            DISCIPLINE_ID,
            expect.objectContaining({
                is_total_suspension: false,
                previous_member_status: null,
            }),
        );
        expect(result).toEqual(expectedDiscipline);
    });
});
