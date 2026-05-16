import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';

export class DeleteMedicalCertificateUseCase {
    constructor(private readonly medicalCertificateRepository: MedicalCertificateRepository) {}

    async execute(id: string): Promise<void> {
        // Validar existencia del certificado
        const existing = await this.medicalCertificateRepository.findById(id);
        if (!existing) {
            throw new Error('El certificado médico no existe');
        }

        // Ejecutar eliminación física
        await this.medicalCertificateRepository.delete(id);
    }
}
