import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateMedicalCertificateUseCase } from './CreateMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../../domain/MedicalCertificateRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';
import { MedicalCertificateValidator } from '../../domain/services/MedicalCertificateValidator.js';
import { CreateMedicalCertificateRequest, MedicalCertificateDTO, MemberDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCertificateDTO(overrides: Partial<MedicalCertificateDTO> = {}): MedicalCertificateDTO {
    return {
        id: 'cert-uuid-0001',
        member_id: 'member-uuid-0001',
        issue_date: '2025-01-01T00:00:00.000Z',
        expiry_date: '2026-01-01T00:00:00.000Z',
        doctor_license: 'MN-12345',
        is_validated: true,
        ...overrides,
    };
}

function buildMemberDTO(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: 'member-uuid-0001',
        dni: '12345678',
        name: 'Socio de Prueba',
        email: 'socio@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2024-01-01T00:00:00.000Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks de infraestructura (puertos)
// ---------------------------------------------------------------------------

const mockCertRepo = {
    findActiveByMemberId: vi.fn(),
    invalidateAllByMemberId: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByMemberId: vi.fn(),
} as unknown as MedicalCertificateRepository;

const mockMemberRepo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByDni: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as unknown as MemberRepository;

const mockValidator = {
    validateCreateRequest: vi.fn(),
    validateMemberId: vi.fn(),
    validateDoctorLicense: vi.fn(),
    validateDate: vi.fn(),
    validateDatesLogical: vi.fn(),
    validateUpdateRequest: vi.fn(),
    validateResultingDateRange: vi.fn(),
} as unknown as MedicalCertificateValidator;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('CreateMedicalCertificateUseCase — tests unitarios', () => {
    const useCase = new CreateMedicalCertificateUseCase(mockCertRepo, mockMemberRepo, mockValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Test [1] — Create sin certificado previo: happy path completo
    // -------------------------------------------------------------------------
    it('debe crear un certificado médico exitosamente cuando los datos son válidos y no existe certificado previo', async () => {
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2025-01-01',
            expiry_date: '2026-01-01',
            doctor_license: '  MN-12345  ', // con espacios para verificar el trim
        };

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockCertRepo.create).mockResolvedValueOnce(buildCertificateDTO());

        const result = await useCase.execute(request);

        expect(mockValidator.validateCreateRequest).toHaveBeenCalledWith(request);
        expect(mockMemberRepo.findById).toHaveBeenCalledWith('member-uuid-0001');
        expect(mockCertRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ doctor_license: 'MN-12345' }) // trimmeado
        );
        expect(result.is_validated).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Test [2] — Create con certificado previo activo → invalida anterior y crea nuevo
    // -------------------------------------------------------------------------
    it('debe llamar a create exactamente una vez aunque existía un certificado previo activo (la invalidación ocurre en $transaction de la infra)', async () => {
        // La atomicidad de invalidar + crear la garantiza Prisma $transaction en la
        // infraestructura. A nivel UseCase solo se verifica que create fue invocado.
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2025-01-01',
            expiry_date: '2026-01-01',
            doctor_license: 'MN-12345',
        };

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockCertRepo.create).mockResolvedValueOnce(buildCertificateDTO());

        const result = await useCase.execute(request);

        expect(mockCertRepo.create).toHaveBeenCalledTimes(1);
        expect(result.is_validated).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Test [3] — Create: fallo en transacción → rollback completo
    // -------------------------------------------------------------------------
    it('debe propagar el error cuando create lanza una excepción (el rollback lo garantiza Prisma $transaction en infra)', async () => {
        // La garantía de rollback pertenece a la capa de infraestructura ($transaction).
        // El UseCase simplemente propaga el error recibido.
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2025-01-01',
            expiry_date: '2026-01-01',
            doctor_license: 'MN-12345',
        };

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockCertRepo.create).mockRejectedValueOnce(new Error('Transaction failed'));

        await expect(useCase.execute(request)).rejects.toThrow('Transaction failed');
        expect(mockCertRepo.create).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------------
    // Test [4] — Create: member_id inexistente → lanza 'El socio no existe'
    // -------------------------------------------------------------------------
    it('debe lanzar "El socio no existe" cuando memberRepo.findById retorna null y no debe llamar a create', async () => {
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-INEXISTENTE',
            issue_date: '2025-01-01',
            expiry_date: '2026-01-01',
            doctor_license: 'MN-12345',
        };

        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(request)).rejects.toThrow('El socio no existe');
        expect(mockCertRepo.create).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [5] — Create: expiry_date igual a issue_date → lanza error de validación
    // -------------------------------------------------------------------------
    it('debe lanzar el error de validación de fechas cuando expiry_date es igual a issue_date y no debe consultar el memberRepo', async () => {
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2025-06-01',
            expiry_date: '2025-06-01',
            doctor_license: 'MN-12345',
        };

        vi.mocked(mockValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión');
        });

        await expect(useCase.execute(request)).rejects.toThrow(
            'La fecha de vencimiento debe ser posterior a la fecha de emisión'
        );
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [6] — Create: expiry_date anterior a issue_date → lanza error de validación
    // -------------------------------------------------------------------------
    it('debe lanzar el error de validación de fechas cuando expiry_date es anterior a issue_date y no debe llamar a create', async () => {
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2026-01-01',
            expiry_date: '2025-01-01',
            doctor_license: 'MN-12345',
        };

        vi.mocked(mockValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión');
        });

        await expect(useCase.execute(request)).rejects.toThrow(
            'La fecha de vencimiento debe ser posterior a la fecha de emisión'
        );
        expect(mockCertRepo.create).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [7] — Create: doctor_license vacío → lanza error de validación
    // -------------------------------------------------------------------------
    it('debe lanzar el error de validación de matrícula cuando doctor_license está vacío y no debe consultar el memberRepo', async () => {
        const request: CreateMedicalCertificateRequest = {
            member_id: 'member-uuid-0001',
            issue_date: '2025-01-01',
            expiry_date: '2026-01-01',
            doctor_license: '',
        };

        vi.mocked(mockValidator.validateCreateRequest).mockImplementationOnce(() => {
            throw new Error('La matrícula del médico es requerida');
        });

        await expect(useCase.execute(request)).rejects.toThrow('La matrícula del médico es requerida');
        expect(mockMemberRepo.findById).not.toHaveBeenCalled();
    });
});
