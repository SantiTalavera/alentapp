import { SportDTO, UpdateSportRequest } from '@alentapp/shared';
import { SportRepository } from '../../domain/SportRepository.js';
import { SportValidator } from '../../domain/services/SportValidator.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidSportId(id: string): boolean {
    return UUID_REGEX.test(id.trim());
}

export class UpdateSportUseCase {
    constructor(
        private readonly sportRepository: SportRepository,
        private readonly sportValidator: SportValidator
    ) {}

    async execute(id: string, data: UpdateSportRequest): Promise<SportDTO> {
        if (!isValidSportId(id)) {
            throw new Error('Identificador de deporte inválido');
        }

        const trimmedId = id.trim();
        const sport = await this.sportRepository.findById(trimmedId);
        if (!sport) {
            throw new Error('Deporte no encontrado');
        }
        if (sport.deleted_at !== null) {
            throw new Error('No se puede modificar un deporte eliminado');
        }

        this.sportValidator.validateUpdateRequest(data);

        const record = data as Record<string, unknown>;
        const updateData: UpdateSportRequest = {};
        if ('description' in record) {
            updateData.description = (record.description as string).trim();
        }
        if ('max_capacity' in record) {
            updateData.max_capacity = record.max_capacity as number;
        }
        if ('additional_price' in record) {
            updateData.additional_price = record.additional_price as number;
        }
        if ('requires_medical_certificate' in record) {
            updateData.requires_medical_certificate = record.requires_medical_certificate as boolean;
        }

        return this.sportRepository.update(trimmedId, updateData);
    }
}
