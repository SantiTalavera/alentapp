import { UpdateLockerRequest, LockerDTO } from '@alentapp/shared';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerValidator } from '../../domain/services/LockerValidator.js';
import { Locker } from '../../domain/Locker.js';

export class UpdateLockerUseCase {
    constructor(
        private readonly lockerRepository: LockerRepository,
        private readonly lockerValidator: LockerValidator
    ) {}

    async execute(id: string, data: UpdateLockerRequest): Promise<LockerDTO> {
        const current = await this.lockerRepository.findById(id);
        if (!current) {
            throw new Error('casillero no encontrado');
        }

        const existingWithNumber = await this.lockerRepository.findByNumber(data.number);
        if (existingWithNumber && existingWithNumber.id !== id) {
            throw new Error('número ya está en uso');
        }

        const currentEntity = Locker.fromDTO(current);
        this.lockerValidator.validateUpdateRequest(data, currentEntity);

        return this.lockerRepository.update(id, {
            number: data.number,
            location: data.location.trim(),
            status: data.status,
            member_id: data.member_id === undefined ? current.member_id : data.member_id,
        });
    }
}
