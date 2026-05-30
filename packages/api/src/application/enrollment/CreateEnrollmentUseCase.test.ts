import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateEnrollmentRequest, EnrollmentDTO } from '@alentapp/shared';
import { CreateEnrollmentUseCase } from './CreateEnrollmentUseCase.js';
import type { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';
import type { EnrollmentValidator } from '../../domain/services/EnrollmentValidator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID    = '11111111-1111-4111-8111-111111111111';
const VALID_SPORT_UUID     = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildCreateRequest(
    overrides: Partial<CreateEnrollmentRequest> = {}
): CreateEnrollmentRequest {
    return {
        member_id: VALID_MEMBER_UUID,
        sport_id: VALID_SPORT_UUID,
        ...overrides,
    };
}

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
// Incluye todos los métodos para facilitar las próximas ramas CRUD.
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

// Las reglas de negocio se delegan al validator; aquí solo se prueba la orquestación.
const mockEnrollmentValidator = {
    validateNewEnrollment: vi.fn(),
    validateUpdateEnrollmentBody: vi.fn(),
    validateEnrollmentReactivation: vi.fn(),
} as unknown as EnrollmentValidator;

// ---------------------------------------------------------------------------
// Suite
// Separación clara entre:
//   [1-4] validaciones de formato propias del use case (sin llamar al validator)
//   [5-6] orquestación: delegación al validator y persistencia.
// ---------------------------------------------------------------------------

describe('CreateEnrollmentUseCase — tests unitarios', () => {
    const useCase = new CreateEnrollmentUseCase(mockEnrollmentRepo, mockEnrollmentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe rechazar cuando member_id está ausente', async () => {
        await expect(
            useCase.execute(
                { sport_id: VALID_SPORT_UUID } as unknown as CreateEnrollmentRequest
            )
        ).rejects.toThrow('El socio es obligatorio');

        expect(mockEnrollmentValidator.validateNewEnrollment).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.create).not.toHaveBeenCalled();
    });

    it('debe rechazar cuando sport_id está ausente', async () => {
        await expect(
            useCase.execute(
                { member_id: VALID_MEMBER_UUID } as unknown as CreateEnrollmentRequest
            )
        ).rejects.toThrow('El deporte es obligatorio');

        expect(mockEnrollmentValidator.validateNewEnrollment).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.create).not.toHaveBeenCalled();
    });

    it.each([
        {
            label: 'member_id',
            payload: {
                member_id: 123 as unknown as string,
                sport_id: VALID_SPORT_UUID,
            },
        },
        {
            label: 'sport_id',
            payload: {
                member_id: VALID_MEMBER_UUID,
                sport_id: 123 as unknown as string,
            },
        },
    ])(
        'debe rechazar cuando $label no es string',
        async ({ payload }) => {
            await expect(useCase.execute(payload)).rejects.toThrow('Identificador inválido');

            expect(mockEnrollmentValidator.validateNewEnrollment).not.toHaveBeenCalled();
            expect(mockEnrollmentRepo.create).not.toHaveBeenCalled();
        }
    );

    it.each([
        { label: 'member_id', payload: buildCreateRequest({ member_id: 'no-uuid' }) },
        { label: 'sport_id', payload: buildCreateRequest({ sport_id: 'no-uuid' }) },
    ])(
        'debe rechazar cuando $label no tiene formato UUID válido',
        async ({ payload }) => {
            await expect(useCase.execute(payload)).rejects.toThrow('Identificador inválido');

            expect(mockEnrollmentValidator.validateNewEnrollment).not.toHaveBeenCalled();
            expect(mockEnrollmentRepo.create).not.toHaveBeenCalled();
        }
    );

    it('debe propagar el error del validator sin persistir', async () => {
        vi.mocked(mockEnrollmentValidator.validateNewEnrollment).mockRejectedValueOnce(
            new Error('Socio no encontrado')
        );

        await expect(
            useCase.execute(buildCreateRequest())
        ).rejects.toThrow('Socio no encontrado');

        expect(mockEnrollmentRepo.create).not.toHaveBeenCalled();
    });

    it('debe crear la inscripción y retornar el DTO cuando los datos son válidos', async () => {
        const expectedDTO = buildEnrollmentDTO();

        vi.mocked(mockEnrollmentValidator.validateNewEnrollment).mockResolvedValueOnce(undefined);
        vi.mocked(mockEnrollmentRepo.create).mockResolvedValueOnce(expectedDTO);

        const result = await useCase.execute(buildCreateRequest());

        expect(mockEnrollmentValidator.validateNewEnrollment).toHaveBeenCalledWith(
            VALID_MEMBER_UUID,
            VALID_SPORT_UUID
        );
        // Solo member_id y sport_id llegan al repositorio; los defaults los genera la infra.
        expect(mockEnrollmentRepo.create).toHaveBeenCalledWith({
            member_id: VALID_MEMBER_UUID,
            sport_id: VALID_SPORT_UUID,
        });
        expect(result).toEqual(expectedDTO);
    });
});
