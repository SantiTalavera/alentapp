import { MedicalCertificateDTO } from '@alentapp/shared';

export interface MedicalCertificateRepository {
    findActiveByMemberId(memberId: string): Promise<MedicalCertificateDTO | null>;
    invalidateAllByMemberId(memberId: string): Promise<void>;
    create(certificate: Omit<MedicalCertificateDTO, 'id'>): Promise<MedicalCertificateDTO>;
    findById(id: string): Promise<MedicalCertificateDTO | null>;
    update(id: string, data: Partial<MedicalCertificateDTO>): Promise<MedicalCertificateDTO>;
    delete(id: string): Promise<void>;
    findByMemberId(memberId: string): Promise<MedicalCertificateDTO[]>;
}
