import { CreateMedicalCertificateRequest, MedicalCertificateDTO } from '@alentapp/shared';
import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';
import { MedicalCertificateValidator } from '../../domain/services/MedicalCertificateValidator.js';

export class CreateMedicalCertificateUseCase {
    constructor(
        private readonly medicalCertificateRepository: MedicalCertificateRepository,
        private readonly memberRepository: MemberRepository,
        private readonly validator: MedicalCertificateValidator
    ) {}

    async execute(data: CreateMedicalCertificateRequest): Promise<MedicalCertificateDTO> {
        this.validator.validateCreateRequest(data);

        const member = await this.memberRepository.findById(data.member_id);
        if (!member) {
            throw new Error('El socio no existe');
        }

        const issueDate = new Date(data.issue_date);
        const expiryDate = new Date(data.expiry_date);

        // La atomicidad de invalidar anteriores y crear el nuevo 
        // se maneja en el repositorio (Infraestructura) según los requerimientos.
        return this.medicalCertificateRepository.create({
            member_id: data.member_id,
            issue_date: issueDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            doctor_license: data.doctor_license.trim(),
            is_validated: true,
        });
    }
}
