import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO } from '@alentapp/shared';

export class GetMedicalCertificateByIdUseCase {
    constructor(private readonly medicalCertificateRepository: MedicalCertificateRepository) {}

    async execute(id: string): Promise<MedicalCertificateDTO> {
        const certificate = await this.medicalCertificateRepository.findById(id);
        if (!certificate) {
            throw new Error('Certificado no encontrado');
        }
        return certificate;
    }
}
