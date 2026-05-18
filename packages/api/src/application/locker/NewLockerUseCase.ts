import { CreateLockerRequest, LockerDTO } from '@alentapp/shared';
import { LockerRepository } from '../../domain/LockerRepository.js';
import { LockerValidator } from '../../domain/services/LockerValidator.js';

export class NewLockerUseCase {
    constructor(
        private readonly lockerRepository: LockerRepository,
        private readonly lockerValidator: LockerValidator
    ) {}

    async execute(data: CreateLockerRequest): Promise<LockerDTO> {
        this.lockerValidator.validateCreateRequest(data);

        const existing = await this.lockerRepository.findByNumber(data.number);
        if (existing) {
            throw new Error('número de casillero ya registrado');
        }

        return this.lockerRepository.create({
            number: data.number,
            location: data.location.trim(),
            status: 'Available',
            member_id: null,
            is_active: true,
        });
    }
}
