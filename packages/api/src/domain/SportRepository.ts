import { SportDTO, UpdateSportRequest } from '@alentapp/shared';

export interface SportRepository {
    create(sport: Omit<SportDTO, 'id'>): Promise<SportDTO>;
    findByName(name: string): Promise<SportDTO | null>;
    findAll(): Promise<SportDTO[]>;
    findById(id: string): Promise<SportDTO | null>;
    update(id: string, data: UpdateSportRequest): Promise<SportDTO>;
}
