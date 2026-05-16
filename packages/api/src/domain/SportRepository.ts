import { SportDTO } from '@alentapp/shared';

export interface SportRepository {
    create(sport: Omit<SportDTO, 'id'>): Promise<SportDTO>;
    findByName(name: string): Promise<SportDTO | null>;
}
