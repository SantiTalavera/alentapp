import {
    CreateEnrollmentRequest,
    EnrollmentDTO,
} from '@alentapp/shared';

export type EnrollmentFilters = {
    member_id?: string;
    sport_id?: string;
    is_active?: boolean;
};

export interface EnrollmentRepository {
    create(data: CreateEnrollmentRequest): Promise<EnrollmentDTO>;
    findById(id: string): Promise<EnrollmentDTO | null>;
    findAll(filters?: EnrollmentFilters): Promise<EnrollmentDTO[]>;
    findActiveByMemberAndSport(
        member_id: string,
        sport_id: string
    ): Promise<EnrollmentDTO | null>;
    countActiveBySportId(sport_id: string): Promise<number>;
    update(
        id: string,
        data: Partial<Pick<EnrollmentDTO, 'is_active'>>
    ): Promise<EnrollmentDTO>;
    softDelete(id: string): Promise<EnrollmentDTO>;
}
