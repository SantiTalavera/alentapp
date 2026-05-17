import {
    CreateEnrollmentRequest,
    EnrollmentDTO,
    UpdateEnrollmentRequest,
} from '@alentapp/shared';

export type EnrollmentFilters = {
    memberId?: string;
    sportId?: string;
    isActive?: boolean;
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
        data: UpdateEnrollmentRequest
    ): Promise<EnrollmentDTO>;
    softDelete(id: string): Promise<EnrollmentDTO>;
}
