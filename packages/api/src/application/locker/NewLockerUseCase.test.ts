import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewLockerUseCase } from './NewLockerUseCase.js';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerValidator } from '../../domain/services/LockerValidator.js';
import { CreateLockerRequest } from '@alentapp/shared';

describe('NewLockerUseCase (Responsabilidad: Coordinación de Reglas de Negocio y Persistencia)', () => {
    // 1. Mocks de las dependencias
    const mockLockerRepo = {
        create: vi.fn(),
        findByNumber: vi.fn(),
    } as unknown as LockerRepository;

    const mockLockerValidator = {
        validateCreateRequest: vi.fn(),
    } as unknown as LockerValidator;

    // 2. Instancia del Caso de Uso inyectando los mocks
    const useCase = new NewLockerUseCase(mockLockerRepo, mockLockerValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe orquestar exitosamente la validación, chequeo de duplicados y creación del casillero', async () => {
        const request: CreateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
        };

        // Simula que no hay ningún casillero registrado con ese número
        vi.mocked(mockLockerRepo.findByNumber).mockResolvedValueOnce(null);

        // Simula la respuesta exitosa al persistir en DB
        vi.mocked(mockLockerRepo.create).mockResolvedValueOnce({
            id: 'uuid-123',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        });

        const result = await useCase.execute(request);

        // Verifica que se ejecute la validación de entrada
        expect(mockLockerValidator.validateCreateRequest).toHaveBeenCalledWith(request);

        // Verifica que se compruebe la unicidad del número
        expect(mockLockerRepo.findByNumber).toHaveBeenCalledWith(10);

        // Verifica que se persistan los datos con estado inicial 'Available' e 'is_active' true
        expect(mockLockerRepo.create).toHaveBeenCalledWith({
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        });

        expect(result.id).toBe('uuid-123');
    });

    it('debe interrumpir la ejecución si el validador lanza un error de formato/campos', async () => {
        const invalidRequest: CreateLockerRequest = {
            number: -5,
            location: '',
        };

        // Simula que el validador rechaza la petición
        vi.mocked(mockLockerValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('debe ser mayor a cero');
        });

        await expect(useCase.execute(invalidRequest)).rejects.toThrow('debe ser mayor a cero');

        // No debe chequear duplicados ni crear nada en base de datos
        expect(mockLockerRepo.findByNumber).not.toHaveBeenCalled();
        expect(mockLockerRepo.create).not.toHaveBeenCalled();
    });

    it('debe lanzar error de conflicto si el número de casillero ya está registrado', async () => {
        const request: CreateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
        };

        // Simula que la validación pasa
        vi.mocked(mockLockerValidator.validateCreateRequest).mockReturnValue(undefined);

        // Simula que ya existe un casillero con ese número
        vi.mocked(mockLockerRepo.findByNumber).mockResolvedValueOnce({
            id: 'uuid-existente',
            number: 10,
            location: 'Pasillo B',
            status: 'Available',
            member_id: null,
            is_active: true,
        });

        await expect(useCase.execute(request)).rejects.toThrow('número de casillero ya registrado');

        // Verifica que no se intente persistir en base de datos
        expect(mockLockerRepo.create).not.toHaveBeenCalled();
    });
});
