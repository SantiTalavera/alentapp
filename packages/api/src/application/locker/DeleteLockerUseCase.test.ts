import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteLockerUseCase } from './DeleteLockerUseCase.js';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerDTO } from '@alentapp/shared';

describe('DeleteLockerUseCase (Responsabilidad: Baja de Casillero)', () => {
    const mockLockerRepo = {
        findById: vi.fn(),
        deactivate: vi.fn(),
    } as unknown as LockerRepository;

    const useCase = new DeleteLockerUseCase(mockLockerRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('[11] DeleteLockerUseCase: locker inexistente → 404', async () => {
        // Simular que el casillero no existe en base de datos
        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('uuid-non-existent')).rejects.toThrow('casillero no encontrado');
        expect(mockLockerRepo.deactivate).not.toHaveBeenCalled();
    });

    it('[12] Delete: locker ya inactivo (is_active false) → 409', async () => {
        // Simular un casillero que ya tiene is_active en false
        const inactiveLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: false,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(inactiveLocker);

        await expect(useCase.execute('uuid-1')).rejects.toThrow('el casillero ya fue dado de baja');
        expect(mockLockerRepo.deactivate).not.toHaveBeenCalled();
    });

    it('[13] Delete: locker activo → is_active false en resultado', async () => {
        const activeLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        };

        // Simular casillero activo encontrado
        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(activeLocker);

        // Simular la desactivación exitosa
        vi.mocked(mockLockerRepo.deactivate).mockResolvedValueOnce({
            ...activeLocker,
            is_active: false,
        });

        const result = await useCase.execute('uuid-1');

        expect(mockLockerRepo.findById).toHaveBeenCalledWith('uuid-1');
        expect(mockLockerRepo.deactivate).toHaveBeenCalledWith('uuid-1');
        expect(result.is_active).toBe(false);
    });
});
