import { LockerDTO } from '@alentapp/shared';
import { LockerRepository } from '../../domain/LockerRepository.js';

export class GetLockerByIdUseCase {
    constructor(private readonly lockerRepository: LockerRepository) {}

    async execute(id: string): Promise<LockerDTO> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw new Error('formato de id inválido');
        }

        const locker = await this.lockerRepository.findById(id);
        if (!locker || !locker.is_active) {
            throw new Error('casillero no encontrado');
        }

        return locker;
    }
}
