import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateDisciplineRequest, DisciplineDTO, MemberDTO } from '@alentapp/shared';
import { NewDisciplineUseCase } from './NewDisciplineUseCase.js';
import type { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import type { MemberRepository } from '../../domain/MemberRepository.js';
import type { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const DISCIPLINE_ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';

function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
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

function buildCreateRequest(
    overrides: Partial<CreateDisciplineRequest> = {},
): CreateDisciplineRequest {
    return {
        member_id: MEMBER_ID,
        reason: 'Incumplimiento del reglamento interno',
        start_date: daysFromNow(-1),
        end_date: daysFromNow(7),
        is_total_suspension: false,
        ...overrides,
    };
}

function buildDisciplineDTO(
    overrides: Partial<DisciplineDTO> = {},
): DisciplineDTO {
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

describe('NewDisciplineUseCase — tests unitarios', () => {
    const useCase = new NewDisciplineUseCase(
        mockDisciplineRepo,
        mockMemberRepo,
        mockDisciplineValidator,
    );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mockDisciplineValidator.isActive).mockReturnValue(true);
        vi.mocked(mockDisciplineValidator.validateCreateRequest).mockReturnValue(undefined);
        vi.mocked(mockDisciplineValidator.validatePreviousMemberStatus).mockReturnValue(undefined);
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValue([]);
        vi.mocked(mockMemberRepo.update).mockResolvedValue(buildMember({ status: 'Suspendido' }));
    });

    it('debe delegar la validación inicial al validator con el request recibido', async () => {
        const request = buildCreateRequest({ is_total_suspension: false });
        const expectedDiscipline = buildDisciplineDTO({
            is_total_suspension: false,
            previous_member_status: null,
        });

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());
        vi.mocked(mockDisciplineRepo.create).mockResolvedValueOnce(expectedDiscipline);

        await useCase.execute(request);

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).toHaveBeenCalledWith(MEMBER_ID);
        expect(mockDisciplineRepo.create).toHaveBeenCalled();

        const validatorCallOrder = vi.mocked(mockDisciplineValidator.validateCreateRequest).mock
            .invocationCallOrder[0];
        const memberLookupCallOrder = vi.mocked(mockMemberRepo.findById).mock.invocationCallOrder[0];
        expect(validatorCallOrder).toBeLessThan(memberLookupCallOrder);
    });

    it('debe llamar al validator y lanzar "El socio no existe" cuando el member_id no corresponde a un socio existente', async () => {
        const request = buildCreateRequest();
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(request)).rejects.toThrow('El socio no existe');

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).toHaveBeenCalledWith(MEMBER_ID);
        expect(mockDisciplineRepo.create).not.toHaveBeenCalled();
        expect(mockMemberRepo.update).not.toHaveBeenCalled();
    });

    it('debe propagar el error del validator cuando reason está vacío', async () => {
        const request = buildCreateRequest({ reason: '   ' });
        vi.mocked(mockDisciplineValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('El motivo de la disciplina es requerido');
        });

        await expect(useCase.execute(request)).rejects.toThrow(
            'El motivo de la disciplina es requerido',
        );

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.create).not.toHaveBeenCalled();
    });

    it('debe propagar el error del validator cuando end_date es igual a start_date', async () => {
        const sameDate = daysFromNow(1);
        const request = buildCreateRequest({
            start_date: sameDate,
            end_date: sameDate,
        });
        vi.mocked(mockDisciplineValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        });

        await expect(useCase.execute(request)).rejects.toThrow(
            'La fecha de fin debe ser posterior a la fecha de inicio',
        );

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.create).not.toHaveBeenCalled();
    });

    it('debe propagar el error del validator cuando end_date es anterior a start_date', async () => {
        const request = buildCreateRequest({
            start_date: daysFromNow(5),
            end_date: daysFromNow(1),
        });
        vi.mocked(mockDisciplineValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        });

        await expect(useCase.execute(request)).rejects.toThrow(
            'La fecha de fin debe ser posterior a la fecha de inicio',
        );

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.create).not.toHaveBeenCalled();
    });

    it('debe crear una disciplina sin suspensión total sin modificar Member.status', async () => {
        const request = buildCreateRequest({ is_total_suspension: false });
        const expectedDiscipline = buildDisciplineDTO({
            is_total_suspension: false,
            previous_member_status: null,
        });

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());
        vi.mocked(mockDisciplineRepo.create).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(request);

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineValidator.isActive).not.toHaveBeenCalled();
        expect(mockMemberRepo.update).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                member_id: MEMBER_ID,
                is_total_suspension: false,
                previous_member_status: null,
            }),
        );
        expect(result).toEqual(expectedDiscipline);
    });

    it('debe guardar previous_member_status y cambiar Member.status a Suspendido cuando la suspensión total está activa', async () => {
        const request = buildCreateRequest({ is_total_suspension: true });
        const expectedDiscipline = buildDisciplineDTO({
            is_total_suspension: true,
            previous_member_status: 'Activo',
        });

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember({ status: 'Activo' }));
        vi.mocked(mockDisciplineRepo.create).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(request);

        expect(mockDisciplineValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockDisciplineValidator.isActive).toHaveBeenCalledWith(
            request.start_date,
            request.end_date,
        );
        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).toHaveBeenCalledWith(MEMBER_ID);
        expect(mockDisciplineValidator.validatePreviousMemberStatus).toHaveBeenCalledWith('Activo');
        expect(mockMemberRepo.update).toHaveBeenCalledWith(MEMBER_ID, { status: 'Suspendido' });
        expect(mockDisciplineRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                is_total_suspension: true,
                previous_member_status: 'Activo',
            }),
        );
        expect(result.previous_member_status).toBe('Activo');
    });

    it('debe reutilizar previous_member_status existente si el socio ya está Suspendido por otra disciplina total activa', async () => {
        const existingSuspension = buildDisciplineDTO({
            id: 'c1d2e3f4-a5b6-7890-abcd-ef1234567890',
            is_total_suspension: true,
            previous_member_status: 'Moroso',
        });
        const expectedDiscipline = buildDisciplineDTO({
            is_total_suspension: true,
            previous_member_status: 'Moroso',
        });

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
            buildMember({ status: 'Suspendido' }),
        );
        vi.mocked(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).mockResolvedValueOnce([
            existingSuspension,
        ]);
        vi.mocked(mockDisciplineRepo.create).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(buildCreateRequest({ is_total_suspension: true }));

        expect(mockDisciplineValidator.validatePreviousMemberStatus).toHaveBeenCalledWith('Moroso');
        expect(mockMemberRepo.update).toHaveBeenCalledWith(MEMBER_ID, { status: 'Suspendido' });
        expect(mockDisciplineRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                is_total_suspension: true,
                previous_member_status: 'Moroso',
            }),
        );
        expect(result.previous_member_status).toBe('Moroso');
    });

    it('debe crear una disciplina futura sin modificar Member.status aunque sea suspensión total', async () => {
        const request = buildCreateRequest({
            start_date: daysFromNow(3),
            end_date: daysFromNow(10),
            is_total_suspension: true,
        });
        const expectedDiscipline = buildDisciplineDTO({
            start_date: request.start_date,
            end_date: request.end_date,
            is_total_suspension: true,
            previous_member_status: null,
        });

        vi.mocked(mockDisciplineValidator.isActive).mockReturnValueOnce(false);
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember({ status: 'Activo' }));
        vi.mocked(mockDisciplineRepo.create).mockResolvedValueOnce(expectedDiscipline);

        const result = await useCase.execute(request);

        expect(mockDisciplineValidator.isActive).toHaveBeenCalledWith(
            request.start_date,
            request.end_date,
        );
        expect(mockDisciplineRepo.findActiveTotalSuspensionsByMemberId).not.toHaveBeenCalled();
        expect(mockMemberRepo.update).not.toHaveBeenCalled();
        expect(mockDisciplineRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                is_total_suspension: true,
                previous_member_status: null,
            }),
        );
        expect(result).toEqual(expectedDiscipline);
    });
});
