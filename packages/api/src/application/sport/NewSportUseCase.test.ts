import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateSportRequest, SportDTO } from '@alentapp/shared';
import { NewSportUseCase } from './NewSportUseCase.js';
import type { SportRepository } from '../../domain/SportRepository.js';
import type { SportValidator } from '../../domain/services/SportValidator.js';

const SPORT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Builders reutilizables para evitar duplicación y mantener explícitos los datos base.
function buildCreateRequest(overrides: Partial<CreateSportRequest> = {}): CreateSportRequest {
    return {
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        ...overrides,
    };
}

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: SPORT_ID,
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        deleted_at: null,
        ...overrides,
    };
}

// Mock completo del puerto: incluye métodos que utilizarán las próximas ramas CRUD.
const mockSportRepo = {
    create: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as SportRepository;

// Las validaciones se mockean para aislar la orquestación del caso de uso.
const mockSportValidator = {
    validateCreateRequest: vi.fn(),
    validateUpdateRequest: vi.fn(),
} as unknown as SportValidator;

describe('NewSportUseCase — tests unitarios', () => {
    const useCase = new NewSportUseCase(mockSportRepo, mockSportValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe validar, verificar unicidad y crear un deporte con deleted_at null', async () => {
        const request = buildCreateRequest();
        const expectedDTO = buildSportDTO();

        vi.mocked(mockSportRepo.findByName).mockResolvedValueOnce(null);
        vi.mocked(mockSportRepo.create).mockResolvedValueOnce(expectedDTO);

        const result = await useCase.execute(request);

        expect(mockSportValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockSportRepo.findByName).toHaveBeenCalledWith('Tenis');
        expect(mockSportRepo.create).toHaveBeenCalledTimes(1);
        expect(mockSportRepo.create).toHaveBeenCalledWith({
            name: 'Tenis',
            description: 'Deporte de raqueta',
            max_capacity: 20,
            additional_price: 500,
            requires_medical_certificate: true,
            deleted_at: null,
        });
        expect(result).toEqual(expectedDTO);
    });

    // Ante un error de dominio, el flujo debe detenerse antes de consultar o persistir.
    it('debe propagar el error del validator sin consultar ni persistir', async () => {
        vi.mocked(mockSportValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('El nombre del deporte es obligatorio');
        });

        await expect(useCase.execute(buildCreateRequest({ name: '' }))).rejects.toThrow(
            'El nombre del deporte es obligatorio',
        );

        expect(mockSportRepo.findByName).not.toHaveBeenCalled();
        expect(mockSportRepo.create).not.toHaveBeenCalled();
    });

    it('debe rechazar un nombre duplicado sin persistir', async () => {
        vi.mocked(mockSportRepo.findByName).mockResolvedValueOnce(buildSportDTO());

        await expect(useCase.execute(buildCreateRequest())).rejects.toThrow(
            'Ya existe un deporte con ese nombre',
        );

        expect(mockSportRepo.create).not.toHaveBeenCalled();
    });

    it('debe retornar el DTO generado por el repositorio', async () => {
        const expectedDTO = buildSportDTO({ id: 'otro-uuid', name: 'Natacion' });

        vi.mocked(mockSportRepo.findByName).mockResolvedValueOnce(null);
        vi.mocked(mockSportRepo.create).mockResolvedValueOnce(expectedDTO);

        const result = await useCase.execute(buildCreateRequest({ name: 'Natacion' }));

        expect(result).toEqual(expectedDTO);
    });
});
