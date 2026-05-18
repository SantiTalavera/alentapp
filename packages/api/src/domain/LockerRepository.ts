import { LockerDTO } from '@alentapp/shared';

export interface LockerRepository {
    create(locker: Omit<LockerDTO, 'id'>): Promise<LockerDTO>;
    findByNumber(number: number): Promise<LockerDTO | null>;
}
