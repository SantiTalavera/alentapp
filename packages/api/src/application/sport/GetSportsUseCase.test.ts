import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SportDTO } from '@alentapp/shared';
import { GetSportsUseCase } from './GetSportsUseCase.js';
import type { SportRepository } from '../../domain/SportRepository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ID_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SPORT_ID_B = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: SPORT_ID_A,
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mock completo del puerto: incluye todos los métodos del contrato SportRepository.
// ---------------------------------------------------------------------------
const mockSportRepo = {
    create: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as SportRepository;

// ---------------------------------------------------------------------------
// Suite GetSportsUseCase — tests unitarios
// ---------------------------------------------------------------------------

describe('GetSportsUseCase — tests unitarios', () => {
    const useCase = new GetSportsUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: El repositorio entrega el listado operativo; el use case lo retorna sin transformar.
    it('debe retornar la lista de deportes obtenida del repositorio', async () => {
        const sports = [
            buildSportDTO({ id: SPORT_ID_A, name: 'Tenis' }),
            buildSportDTO({ id: SPORT_ID_B, name: 'Natación' }),
        ];
        vi.mocked(mockSportRepo.findAll).mockResolvedValueOnce(sports);

        const result = await useCase.execute();

        expect(result).toEqual(sports);
        expect(mockSportRepo.findAll).toHaveBeenCalledTimes(1);
    });

    // TEST [2]: Cuando no hay deportes activos el repositorio devuelve [] y el use case lo propaga.
    it('debe retornar un array vacío cuando no existen deportes activos', async () => {
        vi.mocked(mockSportRepo.findAll).mockResolvedValueOnce([]);

        const result = await useCase.execute();

        expect(result).toEqual([]);
    });
});
