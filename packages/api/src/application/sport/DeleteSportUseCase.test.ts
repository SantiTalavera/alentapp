import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SportDTO } from '@alentapp/shared';
import { DeleteSportUseCase } from './DeleteSportUseCase.js';
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
// Mock completo del puerto SportRepository.
// Se incluyen todos los métodos del contrato para garantizar compatibilidad de
// tipo y permitir que las ramas futuras no requieran reescritura del mock.
// La baja es lógica: no elimina el registro físicamente, solo marca deleted_at.
// No se introduce dependencia hacia EnrollmentRepository: la baja de Sport no
// altera ni elimina inscripciones; estas se conservan como historial.
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
// Suite DeleteSportUseCase — tests unitarios
// ---------------------------------------------------------------------------

describe('DeleteSportUseCase — tests unitarios', () => {
    const useCase = new DeleteSportUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Flujo exitoso con deporte activo.
    it('debe dar de baja lógicamente un deporte activo', async () => {
        const activeSport = buildSportDTO();
        const deletedDTO = buildSportDTO({ deleted_at: '2026-05-30T12:00:00.000Z' });

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(activeSport);
        vi.mocked(mockSportRepo.softDelete).mockResolvedValueOnce(deletedDTO);

        const result = await useCase.execute(VALID_UUID);

        expect(mockSportRepo.findById).toHaveBeenCalledWith(VALID_UUID);
        expect(mockSportRepo.softDelete).toHaveBeenCalledWith(VALID_UUID);
        expect(result).toEqual(deletedDTO);
    });

    // TEST [2]: ID con formato inválido → cortocircuito antes de consultar el repositorio.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(useCase.execute(INVALID_ID)).rejects.toThrow(
            'Identificador de deporte inválido',
        );

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockSportRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [3]: Repositorio retorna null → el deporte no existe.
    it('debe rechazar cuando el deporte no existe', async () => {
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(VALID_UUID)).rejects.toThrow('Deporte no encontrado');

        expect(mockSportRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [4]: El deporte ya fue eliminado lógicamente (deleted_at poblado).
    it('debe rechazar cuando el deporte ya fue dado de baja', async () => {
        const deletedSport = buildSportDTO({ deleted_at: '2024-01-01T00:00:00.000Z' });
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(deletedSport);

        await expect(useCase.execute(VALID_UUID)).rejects.toThrow(
            'El deporte ya fue dado de baja',
        );

        expect(mockSportRepo.softDelete).not.toHaveBeenCalled();
    });

    // TEST [5]: El retorno es el DTO exacto generado por el repositorio.
    it('debe retornar el DTO actualizado generado por el repositorio', async () => {
        const deletedDTO = buildSportDTO({ deleted_at: '2026-05-30T12:00:00.000Z' });

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockSportRepo.softDelete).mockResolvedValueOnce(deletedDTO);

        const result = await useCase.execute(VALID_UUID);

        expect(result).toEqual(deletedDTO);
    });
});
