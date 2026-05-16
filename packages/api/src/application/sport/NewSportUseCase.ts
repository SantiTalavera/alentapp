import { CreateSportRequest, SportDTO } from '@alentapp/shared';
import { SportRepository } from '../../domain/SportRepository.js';
import { SportValidator } from '../../domain/services/SportValidator.js';

export class NewSportUseCase {
    constructor(
        private readonly sportRepository: SportRepository,
        private readonly sportValidator: SportValidator
    ) {}

    async execute(data: CreateSportRequest): Promise<SportDTO> {
        this.sportValidator.validateCreateRequest(data);

        const name = data.name.trim();
        const description = data.description.trim();

        const existing = await this.sportRepository.findByName(name);
        if (existing) {
            throw new Error('Ya existe un deporte con ese nombre');
        }

        return this.sportRepository.create({
            name,
            description,
            max_capacity: data.max_capacity,
            additional_price: data.additional_price,
            requires_medical_certificate: data.requires_medical_certificate,
            deleted_at: null,
        });
    }
}
