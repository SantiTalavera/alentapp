import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetLockerByIdUseCase } from './GetLockerByIdUseCase.js';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerDTO } from '@alentapp/shared';

describe('GetLockerByIdUseCase (Responsabilidad: Obtención de Casillero por ID)', () => {
    const mockLockerRepo = {
        findById: vi.fn(),
    } as unknown as LockerRepository;

    const useCase = new GetLockerByIdUseCase(mockLockerRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validUuid = '12345678-1234-1234-1234-1234567890ab';

    it('debe lanzar error de formato si el id no es un UUID válido', async () => {
        await expect(useCase.execute('invalid-uuid')).rejects.toThrow('formato de id inválido');
        expect(mockLockerRepo.findById).not.toHaveBeenCalled();
    });

    it('[14] GetLockerByIdUseCase: locker inexistente → 404', async () => {
        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(validUuid)).rejects.toThrow('casillero no encontrado');
    });

    it('[15] GetLockerByIdUseCase: locker con is_active false → 404', async () => {
        const inactiveLocker: LockerDTO = {
            id: validUuid,
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: false,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(inactiveLocker);

        await expect(useCase.execute(validUuid)).rejects.toThrow('casillero no encontrado');
    });

    it('debe retornar el casillero si existe y está activo', async () => {
        const activeLocker: LockerDTO = {
            id: validUuid,
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(activeLocker);

        const result = await useCase.execute(validUuid);

        expect(mockLockerRepo.findById).toHaveBeenCalledWith(validUuid);
        expect(result).toEqual(activeLocker);
    });
});
