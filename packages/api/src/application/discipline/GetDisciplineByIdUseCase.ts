import { DisciplineDTO } from '@alentapp/shared';
import { DisciplineRepository } from '../../domain/DisciplineRepository.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
    return UUID_REGEX.test(value.trim());
}

export class GetDisciplineByIdUseCase {
    constructor(private readonly disciplineRepository: DisciplineRepository) {}

    async execute(id: string): Promise<DisciplineDTO> {
        if (!isValidUuid(id)) {
            throw new Error('Identificador de disciplina inválido');
        }

        const discipline = await this.disciplineRepository.findById(id.trim());
        if (!discipline) {
            throw new Error('Disciplina no encontrada');
        }

        return discipline;
    }
}
