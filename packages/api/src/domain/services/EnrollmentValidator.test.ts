import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO, MemberDTO, SportDTO } from '@alentapp/shared';
import { EnrollmentValidator } from './EnrollmentValidator.js';
import type { EnrollmentRepository } from '../EnrollmentRepository.js';
import type { MemberRepository } from '../MemberRepository.js';
import type { SportRepository } from '../SportRepository.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_SPORT_UUID  = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';

// ---------------------------------------------------------------------------
// Builders: objetos base con valores válidos; cada test sobreescribe solo lo necesario.
// ---------------------------------------------------------------------------

function buildMemberDTO(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: VALID_MEMBER_UUID,
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

function buildSportDTO(overrides: Partial<SportDTO> = {}): SportDTO {
    return {
        id: VALID_SPORT_UUID,
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 10,
        additional_price: 500,
        requires_medical_certificate: false,
        deleted_at: null,
        ...overrides,
    };
}

function buildEnrollmentDTO(overrides: Partial<EnrollmentDTO> = {}): EnrollmentDTO {
    return {
        id: VALID_ENROLLMENT_UUID,
        member_id: VALID_MEMBER_UUID,
        sport_id: VALID_SPORT_UUID,
        enrollment_date: '2026-01-01T00:00:00.000Z',
        is_active: true,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks completos de los tres puertos requeridos por EnrollmentValidator.
// Se incluyen todos los métodos del puerto para cumplir el contrato de tipos.
// ---------------------------------------------------------------------------

const mockEnrollmentRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActiveByMemberAndSport: vi.fn(),
    countActiveBySportId: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as EnrollmentRepository;

const mockMemberRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findByDni: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as unknown as MemberRepository;

const mockSportRepo = {
    create: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as SportRepository;

const validator = new EnrollmentValidator(mockEnrollmentRepo, mockMemberRepo, mockSportRepo);

// ---------------------------------------------------------------------------
// Suite
// Orden de validaciones encadenadas:
//   socio existe → socio activo → deporte existe → deporte no eliminado
//   → sin duplicado activo → cupo disponible.
// Cada falla detiene el flujo: los pasos siguientes no deben ejecutarse.
// ---------------------------------------------------------------------------

describe('EnrollmentValidator — tests unitarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe pasar sin error cuando el socio y el deporte son válidos, no hay duplicado y existe cupo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO({ max_capacity: 10 }));
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(null);
        vi.mocked(mockEnrollmentRepo.countActiveBySportId).mockResolvedValueOnce(0);

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).resolves.toBeUndefined();

        expect(mockMemberRepo.findById).toHaveBeenCalledWith(VALID_MEMBER_UUID);
        expect(mockSportRepo.findById).toHaveBeenCalledWith(VALID_SPORT_UUID);
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).toHaveBeenCalledWith(
            VALID_MEMBER_UUID,
            VALID_SPORT_UUID
        );
        expect(mockEnrollmentRepo.countActiveBySportId).toHaveBeenCalledWith(VALID_SPORT_UUID);
    });

    it('debe lanzar error cuando el socio no existe', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('Socio no encontrado');

        // El flujo se detiene: no deben consultarse deporte ni inscripciones.
        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    it('debe lanzar error cuando el socio no está activo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
            buildMemberDTO({ status: 'Moroso' })
        );

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('El socio no está habilitado para inscribirse');

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    it('debe lanzar error cuando el deporte no existe', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('Deporte no encontrado');

        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    it('debe lanzar error cuando el deporte está eliminado lógicamente', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(
            buildSportDTO({ deleted_at: '2024-01-01T00:00:00.000Z' })
        );

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('No se puede inscribir en un deporte eliminado');

        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    it('debe lanzar error cuando ya existe una inscripción activa para el mismo socio y deporte', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(
            buildEnrollmentDTO()
        );

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('El socio ya está inscripto en este deporte');

        // El conteo de cupo no debe ejecutarse cuando ya hay duplicado activo.
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    it('debe lanzar error cuando el cupo máximo está completo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(
            buildSportDTO({ max_capacity: 1 })
        );
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(null);
        vi.mocked(mockEnrollmentRepo.countActiveBySportId).mockResolvedValueOnce(1);

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).rejects.toThrow('No hay cupo disponible para este deporte');
    });

    it('debe permitir la inscripción cuando queda exactamente un cupo disponible', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(
            buildSportDTO({ max_capacity: 2 })
        );
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(null);
        vi.mocked(mockEnrollmentRepo.countActiveBySportId).mockResolvedValueOnce(1);

        await expect(
            validator.validateNewEnrollment(VALID_MEMBER_UUID, VALID_SPORT_UUID)
        ).resolves.toBeUndefined();
    });
});
