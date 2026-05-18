import { LockerDTO, LockerStatus } from '@alentapp/shared';

export class Locker implements LockerDTO {
    constructor(
        public readonly id: string,
        public readonly number: number,
        public readonly location: string,
        public readonly status: LockerStatus,
        public readonly member_id: string | null,
        public readonly is_active: boolean
    ) {}

    isAssignable(): boolean {
        return this.status !== 'Maintenance';
    }

    static fromDTO(dto: LockerDTO): Locker {
        return new Locker(
            dto.id,
            dto.number,
            dto.location,
            dto.status,
            dto.member_id,
            dto.is_active
        );
    }
}
