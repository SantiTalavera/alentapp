import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO } from '@alentapp/shared';
import { GetEnrollmentsUseCase } from './GetEnrollmentsUseCase.js';
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
// Suite GetEnrollmentsUseCase — tests unitarios
// El caso de uso valida y transforma query params antes de delegar al repositorio.
// ---------------------------------------------------------------------------

describe('GetEnrollmentsUseCase — tests unitarios', () => {
    const useCase = new GetEnrollmentsUseCase(mockEnrollmentRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Sin filtros → delega con objeto vacío.
    it('debe retornar la lista obtenida del repositorio cuando no se informan filtros', async () => {
        const enrollments = [buildEnrollmentDTO()];
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce(enrollments);

        const result = await useCase.execute({});

        expect(result).toEqual(enrollments);
        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({});
    });

    // TEST [2]: Repositorio vacío → array vacío propagado.
    it('debe retornar un array vacío cuando no existen inscripciones operativas', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        const result = await useCase.execute({});

        expect(result).toEqual([]);
    });

    // TEST [3]: Filtro por socio.
    it('debe delegar el filtro por socio cuando memberId es válido', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        await useCase.execute({ memberId: VALID_MEMBER_UUID });

        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({ memberId: VALID_MEMBER_UUID });
    });

    // TEST [4]: Filtro por deporte.
    it('debe delegar el filtro por deporte cuando sportId es válido', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        await useCase.execute({ sportId: VALID_SPORT_UUID });

        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({ sportId: VALID_SPORT_UUID });
    });

    // TEST [5]: isActive 'true' convertido a booleano.
    it('debe convertir isActive true a booleano', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        await useCase.execute({ isActive: 'true' });

        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({ isActive: true });
    });

    // TEST [6]: isActive 'false' convertido a booleano.
    it('debe convertir isActive false a booleano', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        await useCase.execute({ isActive: 'false' });

        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({ isActive: false });
    });

    // TEST [7]: Filtros acumulados con lógica AND.
    it('debe acumular los filtros informados', async () => {
        vi.mocked(mockEnrollmentRepo.findAll).mockResolvedValueOnce([]);

        await useCase.execute({
            memberId: VALID_MEMBER_UUID,
            sportId: VALID_SPORT_UUID,
            isActive: 'false',
        });

        expect(mockEnrollmentRepo.findAll).toHaveBeenCalledWith({
            memberId: VALID_MEMBER_UUID,
            sportId: VALID_SPORT_UUID,
            isActive: false,
        });
    });

    // TEST [8]: memberId inválido rechazado antes de consultar.
    it('debe rechazar memberId inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute({ memberId: 'no-uuid' })
        ).rejects.toThrow('Identificador de socio inválido');

        expect(mockEnrollmentRepo.findAll).not.toHaveBeenCalled();
    });

    // TEST [9]: sportId inválido rechazado antes de consultar.
    it('debe rechazar sportId inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute({ sportId: 'no-uuid' })
        ).rejects.toThrow('Identificador de deporte inválido');

        expect(mockEnrollmentRepo.findAll).not.toHaveBeenCalled();
    });

    // TEST [10]: isActive con valor no booleano rechazado antes de consultar.
    it('debe rechazar isActive inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute({ isActive: 'si' })
        ).rejects.toThrow('Filtro de vigencia inválido');

        expect(mockEnrollmentRepo.findAll).not.toHaveBeenCalled();
    });
});
