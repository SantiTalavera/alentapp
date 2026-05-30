import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SportDTO, UpdateSportRequest } from '@alentapp/shared';
import { UpdateSportUseCase } from './UpdateSportUseCase.js';
import type { SportRepository } from '../../domain/SportRepository.js';
import type { SportValidator } from '../../domain/services/SportValidator.js';

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
// Mocks
// ---------------------------------------------------------------------------

// Mock completo del puerto SportRepository: incluye todos los métodos del contrato
// para que el tipo sea compatible y las ramas futuras no requieran reescritura.
const mockSportRepo = {
    create: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as SportRepository;

// El validator se mockea para aislar la orquestación del caso de uso
// de las reglas de dominio, que se prueban por separado en SportValidator.test.ts.
const mockSportValidator = {
    validateCreateRequest: vi.fn(),
    validateUpdateRequest: vi.fn(),
} as unknown as SportValidator;

// ---------------------------------------------------------------------------
// Suite UpdateSportUseCase — tests unitarios
// ---------------------------------------------------------------------------

describe('UpdateSportUseCase — tests unitarios', () => {
    const useCase = new UpdateSportUseCase(mockSportRepo, mockSportValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Flujo exitoso completo.
    it('debe validar y actualizar los campos editables de un deporte activo', async () => {
        const activeSport = buildSportDTO();
        const request: UpdateSportRequest = { description: 'Nueva descripción', max_capacity: 30 };
        const updatedDTO = buildSportDTO({ description: 'Nueva descripción', max_capacity: 30 });

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(activeSport);
        vi.mocked(mockSportRepo.update).mockResolvedValueOnce(updatedDTO);

        const result = await useCase.execute(VALID_UUID, request);

        expect(mockSportRepo.findById).toHaveBeenCalledWith(VALID_UUID);
        expect(mockSportValidator.validateUpdateRequest).toHaveBeenCalledWith(request);
        expect(mockSportRepo.update).toHaveBeenCalledWith(VALID_UUID, request);
        expect(result).toEqual(updatedDTO);
    });

    // TEST [2]: ID inválido → cortocircuito antes de consultar el repositorio.
    it('debe rechazar un identificador inválido sin consultar el repositorio', async () => {
        await expect(
            useCase.execute(INVALID_ID, { description: 'x' }),
        ).rejects.toThrow('Identificador de deporte inválido');

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    // TEST [3]: El repositorio retorna null → el deporte no existe.
    it('debe rechazar cuando el deporte no existe', async () => {
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(
            useCase.execute(VALID_UUID, { description: 'x' }),
        ).rejects.toThrow('Deporte no encontrado');

        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    // Un deporte eliminado no forma parte del circuito operativo de edición;
    // el caso de uso lo detecta vía deleted_at y rechaza antes de validar el body.
    it('debe rechazar cuando el deporte está eliminado lógicamente', async () => {
        const deletedSport = buildSportDTO({ deleted_at: '2024-01-01T00:00:00.000Z' });
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(deletedSport);

        await expect(
            useCase.execute(VALID_UUID, { description: 'x' }),
        ).rejects.toThrow('No se puede modificar un deporte eliminado');

        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    // TEST [5]: Error del validator → no se persiste.
    it('debe propagar el error del validator sin persistir', async () => {
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockSportValidator.validateUpdateRequest).mockImplementationOnce(() => {
            throw new Error('Se requiere al menos un campo para actualizar');
        });

        await expect(
            useCase.execute(VALID_UUID, {} as UpdateSportRequest),
        ).rejects.toThrow('Se requiere al menos un campo para actualizar');

        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    // TEST [6]: 0 y false son valores válidos y no deben perderse por ser falsy.
    it('debe conservar additional_price igual a cero y requires_medical_certificate igual a false', async () => {
        const request: UpdateSportRequest = {
            additional_price: 0,
            requires_medical_certificate: false,
        };
        const updatedDTO = buildSportDTO({ additional_price: 0, requires_medical_certificate: false });

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockSportRepo.update).mockResolvedValueOnce(updatedDTO);

        await useCase.execute(VALID_UUID, request);

        expect(mockSportRepo.update).toHaveBeenCalledWith(
            VALID_UUID,
            expect.objectContaining({ additional_price: 0, requires_medical_certificate: false }),
        );
    });

    // TEST [7]: El retorno es el DTO exacto generado por el repositorio.
    it('debe retornar el DTO actualizado generado por el repositorio', async () => {
        const updatedDTO = buildSportDTO({ description: 'Actualizado', max_capacity: 50 });

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockSportRepo.update).mockResolvedValueOnce(updatedDTO);

        const result = await useCase.execute(VALID_UUID, { description: 'Actualizado', max_capacity: 50 });

        expect(result).toEqual(updatedDTO);
    });
});
