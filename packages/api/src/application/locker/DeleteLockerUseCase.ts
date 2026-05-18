import { LockerDTO } from '@alentapp/shared';
import { LockerRepository } from '../../domain/LockerRepository.js';

export class DeleteLockerUseCase {
    constructor(private readonly lockerRepository: LockerRepository) {}

    async execute(id: string): Promise<LockerDTO> {
        const locker = await this.lockerRepository.findById(id);
        if (!locker) {
            throw new Error('casillero no encontrado');
        }

        if (!locker.is_active) {
            throw new Error('el casillero ya fue dado de baja');
        }

        return this.lockerRepository.deactivate(id);
    }
}
