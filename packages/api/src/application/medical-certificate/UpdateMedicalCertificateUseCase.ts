import { UpdateMedicalCertificateRequest, MedicalCertificateDTO } from '@alentapp/shared';
import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MedicalCertificateValidator } from '../../domain/services/MedicalCertificateValidator.js';

type UpdateMedicalCertificateInput = UpdateMedicalCertificateRequest & Record<string, unknown>;

export class UpdateMedicalCertificateUseCase {
    constructor(
        private readonly medicalCertificateRepository: MedicalCertificateRepository,
        private readonly validator: MedicalCertificateValidator
    ) {}

    async execute(id: string, data: UpdateMedicalCertificateInput): Promise<MedicalCertificateDTO> {
        this.validator.validateUpdateRequest(data);

        const existing = await this.medicalCertificateRepository.findById(id);
        if (!existing) {
            throw new Error('El certificado médico no existe');
        }

        const resultingCertificate = {
            ...existing,
            ...data,
        };

        this.validator.validateResultingDateRange(
            resultingCertificate.issue_date,
            resultingCertificate.expiry_date
        );

        return this.medicalCertificateRepository.update(id, {
            issue_date: data.issue_date,
            expiry_date: data.expiry_date,
            doctor_license: data.doctor_license,
        });
    }
}
