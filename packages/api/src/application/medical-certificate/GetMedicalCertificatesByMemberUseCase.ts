import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO } from '@alentapp/shared';

export class GetMedicalCertificatesByMemberUseCase {
    constructor(private readonly medicalCertificateRepository: MedicalCertificateRepository) {}

    async execute(memberId: string): Promise<MedicalCertificateDTO[]> {
        return this.medicalCertificateRepository.findByMemberId(memberId);
    }
}
