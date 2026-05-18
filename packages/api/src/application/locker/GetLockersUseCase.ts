import { LockerDTO } from '@alentapp/shared';
import { LockerRepository } from '../../domain/LockerRepository.js';

export class GetLockersUseCase {
    constructor(private readonly lockerRepository: LockerRepository) {}

    async execute(filters?: { status?: string }): Promise<LockerDTO[]> {
        if (filters?.status && !['Available', 'Occupied', 'Maintenance'].includes(filters.status)) {
            throw new Error('Estado de casillero no válido');
        }
        return this.lockerRepository.findAll(filters);
    }
}
