import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentLoanValidator } from './EquipmentLoanValidator.js';
import { MemberRepository } from '../MemberRepository.js';
import type { MemberDTO, CreateEquipmentLoanRequest } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/** Builds a future date string (today + `daysAhead` days) in ISO format. */
function futureDateISO(daysAhead: number = 10): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString();
}

/** Builds a past date string (today - `daysBack` days) in ISO format. */
function pastDateISO(daysBack: number = 5): string {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toISOString();
}

function buildMember(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: VALID_UUID,
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
// Mock del MemberRepository (única dependencia del validador)
// ---------------------------------------------------------------------------

const mockMemberRepo = {
    findById: vi.fn(),
    create: vi.fn(),
    findByDni: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as unknown as MemberRepository;

const validator = new EquipmentLoanValidator(mockMemberRepo);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EquipmentLoanValidator — tests unitarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // validateMemberId()
    // =========================================================================
    describe('validateMemberId()', () => {
        it('debe pasar sin error cuando el memberId tiene formato UUID válido', () => {
            expect(() => validator.validateMemberId(VALID_UUID)).not.toThrow();
        });

        it('debe lanzar error cuando el memberId no tiene formato UUID válido', () => {
            expect(() => validator.validateMemberId('no-es-uuid')).toThrow(
                'Formato de identificador de socio inválido',
            );
            expect(() => validator.validateMemberId('')).toThrow(
                'Formato de identificador de socio inválido',
            );
        });
    });

    // =========================================================================
    // validateId()
    // =========================================================================
    describe('validateId()', () => {
        it('debe pasar sin error cuando el id de préstamo tiene formato UUID válido', () => {
            expect(() => validator.validateId(VALID_UUID)).not.toThrow();
        });

        it('debe lanzar error cuando el id de préstamo no tiene formato UUID válido', () => {
            expect(() => validator.validateId('12345')).toThrow(
                'Formato de identificador de préstamo inválido',
            );
        });
    });

    // =========================================================================
    // validate() — regla (a): socio debe existir
    // =========================================================================
    describe('validate() — socio no encontrado', () => {
        it('debe lanzar "Socio no encontrado" cuando el repositorio retorna null para ese member_id', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Pelota',
                member_id: VALID_UUID,
            };

            await expect(validator.validate(request)).rejects.toThrow('Socio no encontrado');
            expect(mockMemberRepo.findById).toHaveBeenCalledWith(VALID_UUID);
        });
    });

    // =========================================================================
    // validate() — regla (b): socio debe estar Activo
    // =========================================================================
    describe('validate() — socio no activo', () => {
        it('debe lanzar error cuando el socio tiene status Moroso (no está activo)', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
                buildMember({ status: 'Moroso' }),
            );

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Guantes',
                member_id: VALID_UUID,
            };

            await expect(validator.validate(request)).rejects.toThrow(
                'El socio no está activo y no puede solicitar un préstamo',
            );
        });

        it('debe lanzar error cuando el socio tiene status Suspendido', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
                buildMember({ status: 'Suspendido' }),
            );

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Raqueta',
                member_id: VALID_UUID,
            };

            await expect(validator.validate(request)).rejects.toThrow(
                'El socio no está activo y no puede solicitar un préstamo',
            );
        });
    });

    // =========================================================================
    // validate() — regla (c): socio NO puede ser Cadete
    // =========================================================================
    describe('validate() — categoría Cadete no habilitada', () => {
        it('debe lanzar el mensaje específico de Cadete cuando la categoría es Cadete', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
                buildMember({ category: 'Cadete', status: 'Activo' }),
            );

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Bicicleta',
                member_id: VALID_UUID,
            };

            await expect(validator.validate(request)).rejects.toThrow(
                'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.',
            );
        });
    });

    // =========================================================================
    // validate() — regla (d): due_date debe ser futura
    // =========================================================================
    describe('validate() — fecha de devolución', () => {
        it('debe pasar sin error cuando due_date es una fecha futura válida', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Raqueta',
                member_id: VALID_UUID,
                due_date: futureDateISO(15),
            };

            await expect(validator.validate(request)).resolves.toBeUndefined();
        });

        it('debe lanzar error cuando due_date es una fecha en el pasado', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Pelota de Básquet',
                member_id: VALID_UUID,
                due_date: pastDateISO(3),
            };

            await expect(validator.validate(request)).rejects.toThrow(
                'La fecha de devolución debe ser una fecha futura',
            );
        });

        it('debe lanzar error cuando due_date no es una fecha parseable', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Cuerda de Saltar',
                member_id: VALID_UUID,
                due_date: 'fecha-invalida',
            };

            await expect(validator.validate(request)).rejects.toThrow(
                'La fecha de devolución no es válida',
            );
        });

        it('debe pasar sin error cuando due_date no es provista (campo opcional)', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(buildMember());

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Cuerda',
                member_id: VALID_UUID,
                // due_date ausente
            };

            await expect(validator.validate(request)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // validate() — ruta feliz: socio Pleno/Honorario activo, sin due_date
    // =========================================================================
    describe('validate() — camino exitoso', () => {
        it('debe resolver sin error para un socio Pleno activo sin fecha de devolución', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
                buildMember({ category: 'Pleno', status: 'Activo' }),
            );

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Pelota',
                member_id: VALID_UUID,
            };

            await expect(validator.validate(request)).resolves.toBeUndefined();
        });

        it('debe resolver sin error para un socio Honorario activo con fecha de devolución futura', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(
                buildMember({ category: 'Honorario', status: 'Activo' }),
            );

            const request: CreateEquipmentLoanRequest = {
                item_name: 'Raqueta de Squash',
                member_id: VALID_UUID,
                due_date: futureDateISO(30),
            };

            await expect(validator.validate(request)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // validateStatusTransition()
    // =========================================================================
    describe('validateStatusTransition()', () => {
        it('debe lanzar error cuando el estado actual es Devuelto', () => {
            expect(() => validator.validateStatusTransition('Devuelto', 'Prestado')).toThrow(
                'El préstamo ya se encuentra en un estado terminal y no puede ser modificado',
            );
        });

        it('debe lanzar error cuando el estado actual es Dañado', () => {
            expect(() => validator.validateStatusTransition('Dañado', 'Prestado')).toThrow(
                'El préstamo ya se encuentra en un estado terminal y no puede ser modificado',
            );
        });

        it('debe pasar sin lanzar error cuando el estado actual es Prestado', () => {
            expect(() => validator.validateStatusTransition('Prestado', 'Devuelto')).not.toThrow();
            expect(() => validator.validateStatusTransition('Prestado', 'Dañado')).not.toThrow();
        });
    });
});
