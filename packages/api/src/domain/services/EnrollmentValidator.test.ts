import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnrollmentDTO, MemberDTO, SportDTO } from '@alentapp/shared';
import { EnrollmentValidator } from './EnrollmentValidator.js';
import type { EnrollmentRepository } from '../EnrollmentRepository.js';
import type { MemberRepository } from '../MemberRepository.js';
import type { SportRepository } from '../SportRepository.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID     = '11111111-1111-4111-8111-111111111111';
const VALID_SPORT_UUID      = '33333333-3333-4333-8333-333333333333';
const VALID_ENROLLMENT_UUID = '44444444-4444-4444-8444-444444444444';
const OTHER_ENROLLMENT_UUID = '55555555-5555-4555-8555-555555555555';

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

// ---------------------------------------------------------------------------
// Suite validateUpdateEnrollmentBody()
// Valida el cuerpo del request de modificación de inscripción.
// Solo is_active es editable; el resto de los campos son inmutables.
// ---------------------------------------------------------------------------

describe('validateUpdateEnrollmentBody()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe pasar sin error cuando se informa is_active false', () => {
        const result = validator.validateUpdateEnrollmentBody({ is_active: false });
        expect(result).toEqual({ is_active: false });
    });

    it('debe pasar sin error cuando se informa is_active true', () => {
        const result = validator.validateUpdateEnrollmentBody({ is_active: true });
        expect(result).toEqual({ is_active: true });
    });

    it('debe lanzar error cuando el body está vacío', () => {
        expect(() => validator.validateUpdateEnrollmentBody({})).toThrow(
            'Se requiere al menos un campo para actualizar'
        );
    });

    // Todos los campos inmutables producen el mismo mensaje: 'Campo no permitido para modificación'.
    it.each([
        [{ member_id: VALID_MEMBER_UUID }],
        [{ sport_id: VALID_SPORT_UUID }],
        [{ enrollment_date: '2026-01-01T00:00:00.000Z' }],
        [{ deleted_at: null }],
        [{ id: VALID_ENROLLMENT_UUID }],
    ])('debe rechazar campos no permitidos (%o)', (payload) => {
        expect(() =>
            validator.validateUpdateEnrollmentBody(payload as unknown)
        ).toThrow('Campo no permitido para modificación');
    });

    it('debe lanzar error cuando is_active no es booleano', () => {
        expect(() =>
            validator.validateUpdateEnrollmentBody({ is_active: 'false' } as unknown)
        ).toThrow('El campo is_active debe ser booleano');
    });
});

// ---------------------------------------------------------------------------
// Suite validateEnrollmentReactivation()
// La reactivación vuelve a validar dependencias porque reincorpora la inscripción
// al circuito operativo: el socio debe estar habilitado, el deporte disponible,
// no existir duplicado activo y quedar cupo.
//
// NOTA: A diferencia de validateNewEnrollment(), esta función combina en un
// único error tanto "socio no encontrado" como "socio no activo" bajo el mensaje
// 'El socio no está habilitado'. Ídem para deporte ('El deporte no está disponible').
// El flujo de CREATE usa mensajes separados (Socio no encontrado / Deporte no encontrado)
// mientras que UPDATE los unifica, siguiendo el TDD-0025.
// ---------------------------------------------------------------------------

describe('validateEnrollmentReactivation()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // TEST [1]: Happy path — todas las condiciones se cumplen.
    it('debe pasar sin error cuando el socio y el deporte están disponibles, no hay duplicado y existe cupo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO({ max_capacity: 10 }));
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(null);
        vi.mocked(mockEnrollmentRepo.countActiveBySportId).mockResolvedValueOnce(0);

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).resolves.toBeUndefined();

        expect(mockMemberRepo.findById).toHaveBeenCalledWith(VALID_MEMBER_UUID);
        expect(mockSportRepo.findById).toHaveBeenCalledWith(VALID_SPORT_UUID);
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).toHaveBeenCalledWith(
            VALID_MEMBER_UUID,
            VALID_SPORT_UUID
        );
        expect(mockEnrollmentRepo.countActiveBySportId).toHaveBeenCalledWith(VALID_SPORT_UUID);
    });

    // TEST [2]: Socio no encontrado → mismo mensaje que socio no activo.
    // El flujo se detiene: no deben consultarse deporte, duplicados ni cupo.
    it('debe lanzar error cuando el socio no existe', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('El socio no está habilitado');

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    // TEST [3]: Socio no activo (status Moroso).
    // La implementación evalúa !member || member.status !== 'Activo' en una sola guarda,
    // por lo que el mensaje es idéntico al caso de socio inexistente.
    it('debe lanzar error cuando el socio no está activo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
            buildMemberDTO({ status: 'Moroso' })
        );

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('El socio no está habilitado');

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    // TEST [4]: Deporte no encontrado.
    // El flujo se detiene: no deben consultarse duplicados ni cupo.
    it('debe lanzar error cuando el deporte no existe', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('El deporte no está disponible');

        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    // TEST [5]: Deporte con baja lógica.
    // La implementación evalúa !sport || sport.deleted_at !== null en una sola guarda.
    it('debe lanzar error cuando el deporte está eliminado lógicamente', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(
            buildSportDTO({ deleted_at: '2025-01-01T00:00:00.000Z' })
        );

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('El deporte no está disponible');

        expect(mockEnrollmentRepo.findActiveByMemberAndSport).not.toHaveBeenCalled();
        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    // TEST [6]: Duplicado activo con ID distinto al enrollment actual.
    // El cupo no debe consultarse cuando ya existe duplicado.
    it('debe lanzar error cuando existe otra inscripción activa para el mismo socio y deporte', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(buildSportDTO());
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(
            buildEnrollmentDTO({ id: OTHER_ENROLLMENT_UUID })
        );

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('Ya existe una inscripción activa para este deporte');

        expect(mockEnrollmentRepo.countActiveBySportId).not.toHaveBeenCalled();
    });

    // TEST [7]: Cupo máximo completo.
    it('debe lanzar error cuando el cupo máximo está completo', async () => {
        vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMemberDTO());
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(
            buildSportDTO({ max_capacity: 1 })
        );
        vi.mocked(mockEnrollmentRepo.findActiveByMemberAndSport).mockResolvedValueOnce(null);
        vi.mocked(mockEnrollmentRepo.countActiveBySportId).mockResolvedValueOnce(1);

        await expect(
            validator.validateEnrollmentReactivation(
                VALID_MEMBER_UUID,
                VALID_SPORT_UUID,
                VALID_ENROLLMENT_UUID
            )
        ).rejects.toThrow('No hay cupo disponible para este deporte');
    });
});
