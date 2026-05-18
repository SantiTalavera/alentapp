import { LockerDTO } from '@alentapp/shared';

export interface LockerRepository {
    create(locker: Omit<LockerDTO, 'id'>): Promise<LockerDTO>;
    findByNumber(number: number): Promise<LockerDTO | null>;
    findById(id: string): Promise<LockerDTO | null>;
    update(id: string, locker: Partial<LockerDTO>): Promise<LockerDTO>;
}
