import { describe, it, expect } from 'vitest';
import { MedicalCertificateValidator } from './MedicalCertificateValidator.js';
import { CreateMedicalCertificateRequest } from '@alentapp/shared';

const validator = new MedicalCertificateValidator();

describe('MedicalCertificateValidator — tests unitarios', () => {

    // ─────────────────────────────────────────────
    // validateCreateRequest()
    // ─────────────────────────────────────────────
    describe('validateCreateRequest()', () => {
        it('debe pasar sin error cuando todos los campos del request son válidos', () => {
            const data: CreateMedicalCertificateRequest = {
                member_id: 'member-uuid-0001',
                doctor_license: 'MN-12345',
                issue_date: '2025-01-01',
                expiry_date: '2026-01-01',
            };
            expect(() => validator.validateCreateRequest(data)).not.toThrow();
        });
    });

    // ─────────────────────────────────────────────
    // validateMemberId()
    // ─────────────────────────────────────────────
    describe('validateMemberId()', () => {
        it('debe lanzar "El socio es requerido" cuando el memberId es un string vacío', () => {
            expect(() => validator.validateMemberId('')).toThrow('El socio es requerido');
        });
    });

    // ─────────────────────────────────────────────
    // validateDoctorLicense()
    // ─────────────────────────────────────────────
    describe('validateDoctorLicense()', () => {
        it('debe lanzar "La matrícula del médico es requerida" cuando la licencia es un string vacío', () => {
            expect(() => validator.validateDoctorLicense('')).toThrow('La matrícula del médico es requerida');
        });
    });

    // ─────────────────────────────────────────────
    // validateDate()
    // ─────────────────────────────────────────────
    describe('validateDate()', () => {
        it('debe lanzar "La fecha de emisión es requerida" cuando el dateString es un string vacío', () => {
            expect(() => validator.validateDate('', 'emisión')).toThrow('La fecha de emisión es requerida');
        });

        it('debe lanzar "Las fechas proporcionadas no son válidas" cuando el dateString no es parseable como fecha', () => {
            expect(() => validator.validateDate('fecha-invalida', 'emisión')).toThrow('Las fechas proporcionadas no son válidas');
        });
    });

    // ─────────────────────────────────────────────
    // validateDatesLogical()
    // ─────────────────────────────────────────────
    describe('validateDatesLogical()', () => {
        it('debe lanzar el error de fechas cuando expiryDate es igual a issueDate', () => {
            const same = new Date('2025-06-01');
            expect(() => validator.validateDatesLogical(same, same)).toThrow(
                'La fecha de vencimiento debe ser posterior a la fecha de emisión',
            );
        });

        it('debe lanzar el error de fechas cuando expiryDate es anterior a issueDate', () => {
            const issueDate = new Date('2025-06-01');
            const expiryDate = new Date('2025-01-01');
            expect(() => validator.validateDatesLogical(issueDate, expiryDate)).toThrow(
                'La fecha de vencimiento debe ser posterior a la fecha de emisión',
            );
        });
    });
});

// =========================================================================
// validateUpdateRequest()
// =========================================================================
describe('validateUpdateRequest()', () => {
    it('debe lanzar "Se debe enviar al menos un campo para actualizar" cuando el body está vacío', () => {
        expect(() => validator.validateUpdateRequest({})).toThrow(
            'Se debe enviar al menos un campo para actualizar',
        );
    });

    it('debe lanzar "El socio titular del certificado no puede modificarse" cuando el body contiene member_id', () => {
        expect(() =>
            validator.validateUpdateRequest({ member_id: 'uuid' } as Record<string, unknown>),
        ).toThrow('El socio titular del certificado no puede modificarse');
    });

    it('debe lanzar "Se debe enviar al menos un campo para actualizar" cuando el body contiene solo campos no permitidos', () => {
        const data = { campo_invalido: 'valor' };
        expect(() => validator.validateUpdateRequest(data as any)).toThrow(
            'Se debe enviar al menos un campo para actualizar',
        );
    });

    it('debe pasar sin error cuando el body contiene solo expiry_date con valor válido', () => {
        const data = { expiry_date: '2027-01-01' };
        expect(() => validator.validateUpdateRequest(data)).not.toThrow();
    });
});

// =========================================================================
// validateResultingDateRange()
// =========================================================================
describe('validateResultingDateRange()', () => {
    it('debe lanzar el error de rango cuando la expiry_date resultante es anterior a la issue_date', () => {
        expect(() =>
            validator.validateResultingDateRange(
                '2025-06-01T00:00:00.000Z',
                '2024-01-01T00:00:00.000Z',
            ),
        ).toThrow('La fecha de vencimiento debe ser posterior a la fecha de emisión');
    });
});