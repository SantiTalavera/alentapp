import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SportDTO } from '@alentapp/shared';
import { GetSportByIdUseCase } from './GetSportByIdUseCase.js';
import type { SportRepository } from '../../domain/SportRepository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INVALID_ID = 'no-es-un-uuid';

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: VALID_UUID,
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
// Suite GetSportByIdUseCase — tests unitarios
// ---------------------------------------------------------------------------

describe('GetSportByIdUseCase — tests unitarios', () => {
    const useCase = new GetSportByIdUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Consulta exitosa de un deporte activo.
    it('debe retornar el deporte cuando existe y está activo', async () => {
        const sportDTO = buildSportDTO();
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(sportDTO);

        const result = await useCase.execute(VALID_UUID);

        expect(result).toEqual(sportDTO);
        expect(mockSportRepo.findById).toHaveBeenCalledWith(VALID_UUID);
    });

    // TEST [2]: ID con formato inválido se rechaza antes de consultar el repositorio.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(useCase.execute(INVALID_ID)).rejects.toThrow(
            'Identificador de deporte inválido',
        );

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
    });

    // TEST [3]: UUID válido pero inexistente → el repositorio retorna null.
    it('debe rechazar cuando el deporte no existe', async () => {
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(VALID_UUID)).rejects.toThrow('Deporte no encontrado');
    });

    // Una baja lógica (deleted_at poblado) vuelve al deporte no disponible para consultas operativas.
    it('debe considerar no disponible un deporte eliminado lógicamente', async () => {
        const deletedDTO = buildSportDTO({ deleted_at: '2024-01-01T00:00:00.000Z' });
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(deletedDTO);

        await expect(useCase.execute(VALID_UUID)).rejects.toThrow('Deporte no encontrado');
    });
});
