import { SportDTO } from '@alentapp/shared';
import { SportRepository } from '../../domain/SportRepository.js';

export class GetSportsUseCase {
    constructor(private readonly sportRepository: SportRepository) {}

    async execute(): Promise<SportDTO[]> {
        return this.sportRepository.findAll();
    }
}
