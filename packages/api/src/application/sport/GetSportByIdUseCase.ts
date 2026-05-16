import { SportDTO } from '@alentapp/shared';
import { SportRepository } from '../../domain/SportRepository.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidSportId(id: string): boolean {
    return UUID_REGEX.test(id.trim());
}

export class GetSportByIdUseCase {
    constructor(private readonly sportRepository: SportRepository) {}

    async execute(id: string): Promise<SportDTO> {
        if (!isValidSportId(id)) {
            throw new Error('Identificador de deporte inválido');
        }

        const sport = await this.sportRepository.findById(id.trim());
        if (!sport || sport.deleted_at !== null) {
            throw new Error('Deporte no encontrado');
        }

        return sport;
    }
}
