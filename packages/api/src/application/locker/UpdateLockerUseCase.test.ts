import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateLockerUseCase } from './UpdateLockerUseCase.js';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerValidator } from '../../domain/services/LockerValidator.js';
import { UpdateLockerRequest, LockerDTO } from '@alentapp/shared';

describe('UpdateLockerUseCase (Responsabilidad: Actualización de Casillero)', () => {
    const mockLockerRepo = {
        findById: vi.fn(),
        findByNumber: vi.fn(),
        update: vi.fn(),
    } as unknown as LockerRepository;

    const validator = new LockerValidator();
    const useCase = new UpdateLockerUseCase(mockLockerRepo, validator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('[5] UpdateLockerUseCase: locker inexistente → 404', async () => {
        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(null);

        const request: UpdateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
        };

        await expect(useCase.execute('uuid-non-existent', request)).rejects.toThrow('casillero no encontrado');
        expect(mockLockerRepo.update).not.toHaveBeenCalled();
    });

    it('[6] Update: locker inactivo (is_active false) → 404', async () => {
        const inactiveLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: false,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(inactiveLocker);

        const request: UpdateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
        };

        await expect(useCase.execute('uuid-1', request)).rejects.toThrow('casillero no encontrado');
        expect(mockLockerRepo.update).not.toHaveBeenCalled();
    });

    it('[7] Update: number duplicado excluyendo el propio → 409', async () => {
        const currentLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(currentLocker);

        // Simulamos que el número 20 ya lo tiene otro casillero 'uuid-2'
        vi.mocked(mockLockerRepo.findByNumber).mockResolvedValueOnce({
            id: 'uuid-2',
            number: 20,
            location: 'Pasillo B',
            status: 'Available',
            member_id: null,
            is_active: true,
        });

        const request: UpdateLockerRequest = {
            number: 20,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
        };

        await expect(useCase.execute('uuid-1', request)).rejects.toThrow('número ya está en uso');
        expect(mockLockerRepo.update).not.toHaveBeenCalled();
    });

    it('[8] Update: member_id con status Maintenance → 422', async () => {
        const currentLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(currentLocker);
        vi.mocked(mockLockerRepo.findByNumber).mockResolvedValueOnce(currentLocker);

        const request: UpdateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
            status: 'Maintenance',
            member_id: 'member-123',
        };

        await expect(useCase.execute('uuid-1', request)).rejects.toThrow('casillero en mantenimiento no puede tener socio');
        expect(mockLockerRepo.update).not.toHaveBeenCalled();
    });

    it('[9] Update: asignar member_id con status Available → éxito', async () => {
        const currentLocker: LockerDTO = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        };

        vi.mocked(mockLockerRepo.findById).mockResolvedValueOnce(currentLocker);
        vi.mocked(mockLockerRepo.findByNumber).mockResolvedValueOnce(currentLocker);

        const request: UpdateLockerRequest = {
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: 'member-123',
        };

        vi.mocked(mockLockerRepo.update).mockResolvedValueOnce({
            ...currentLocker,
            member_id: 'member-123',
        });

        const result = await useCase.execute('uuid-1', request);

        expect(result.member_id).toBe('member-123');
        expect(mockLockerRepo.update).toHaveBeenCalledWith('uuid-1', {
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: 'member-123',
        });
    });
});
