import { describe, it, expect } from 'vitest';
import type { CreateDisciplineRequest } from '@alentapp/shared';
import { DisciplineValidator } from './DisciplineValidator.js';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function daysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

function buildCreateRequest(
    overrides: Partial<CreateDisciplineRequest> = {},
): CreateDisciplineRequest {
    return {
        member_id: MEMBER_ID,
        reason: 'Incumplimiento del reglamento interno',
        start_date: daysFromNow(-1),
        end_date: daysFromNow(7),
        is_total_suspension: false,
        ...overrides,
    };
}

describe('DisciplineValidator — tests unitarios', () => {
    const validator = new DisciplineValidator();

    describe('validateCreateRequest()', () => {
        it('debe pasar sin error cuando la request de creación es válida', () => {
            expect(() => validator.validateCreateRequest(buildCreateRequest())).not.toThrow();
        });

        it('debe lanzar error cuando member_id está vacío', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ member_id: '   ' })),
            ).toThrow('El socio es requerido');
        });

        it('debe lanzar error cuando reason está vacío', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ reason: '   ' })),
            ).toThrow('El motivo de la disciplina es requerido');
        });

        it('debe lanzar error cuando start_date está vacío', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ start_date: '   ' })),
            ).toThrow('La fecha de inicio es requerida');
        });

        it('debe lanzar error cuando end_date está vacío', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ end_date: '   ' })),
            ).toThrow('La fecha de fin es requerida');
        });

        it('debe lanzar error cuando end_date es igual a start_date', () => {
            const sameDate = daysFromNow(1);

            expect(() =>
                validator.validateCreateRequest(
                    buildCreateRequest({
                        start_date: sameDate,
                        end_date: sameDate,
                    }),
                ),
            ).toThrow('La fecha de fin debe ser posterior a la fecha de inicio');
        });

        it('debe lanzar error cuando end_date es anterior a start_date', () => {
            expect(() =>
                validator.validateCreateRequest(
                    buildCreateRequest({
                        start_date: daysFromNow(5),
                        end_date: daysFromNow(1),
                    }),
                ),
            ).toThrow('La fecha de fin debe ser posterior a la fecha de inicio');
        });

        it('debe lanzar error cuando is_total_suspension no es booleano', () => {
            const request = buildCreateRequest({
                is_total_suspension: 'true' as unknown as boolean,
            });

            expect(() => validator.validateCreateRequest(request)).toThrow(
                'El campo suspensión total debe ser verdadero o falso',
            );
        });
    });

    describe('validatePreviousMemberStatus()', () => {
        it('debe pasar sin error cuando el estado previo es Activo, Moroso o null', () => {
            expect(() => validator.validatePreviousMemberStatus('Activo')).not.toThrow();
            expect(() => validator.validatePreviousMemberStatus('Moroso')).not.toThrow();
            expect(() => validator.validatePreviousMemberStatus(null)).not.toThrow();
        });

        it('debe lanzar error cuando el estado previo es Suspendido', () => {
            expect(() => validator.validatePreviousMemberStatus('Suspendido')).toThrow(
                'El estado previo del socio debe ser Activo o Moroso',
            );
        });
    });

    describe('validateUpdateRequest()', () => {
        it('debe pasar sin error cuando se envía al menos un campo editable', () => {
            expect(() => validator.validateUpdateRequest({ reason: 'Nuevo motivo' })).not.toThrow();
            expect(() => validator.validateUpdateRequest({ is_total_suspension: true })).not.toThrow();
        });

        it('debe lanzar error cuando el body está vacío', () => {
            expect(() => validator.validateUpdateRequest({})).toThrow(
                'Se debe enviar al menos un campo para actualizar',
            );
        });

        it('debe lanzar error cuando el body contiene member_id', () => {
            expect(() => validator.validateUpdateRequest({ member_id: MEMBER_ID })).toThrow(
                'El socio de la disciplina no puede modificarse',
            );
        });

        it('debe lanzar error cuando el body no contiene campos editables', () => {
            expect(() => validator.validateUpdateRequest({ foo: 'bar' })).toThrow(
                'Se debe enviar al menos un campo para actualizar',
            );
        });

        it('debe lanzar error cuando reason actualizado está vacío', () => {
            expect(() => validator.validateUpdateRequest({ reason: '   ' })).toThrow(
                'El motivo de la disciplina es requerido',
            );
        });

        it('debe lanzar error cuando is_total_suspension actualizado no es booleano', () => {
            expect(() =>
                validator.validateUpdateRequest({
                    is_total_suspension: 'true' as unknown as boolean,
                }),
            ).toThrow('El campo suspensión total debe ser verdadero o falso');
        });
    });

    describe('isActive()', () => {
        it('debe devolver true cuando la fecha de referencia está dentro del rango', () => {
            const referenceDate = new Date('2026-05-20T12:00:00.000Z');

            expect(
                validator.isActive(
                    '2026-05-20T00:00:00.000Z',
                    '2026-05-21T00:00:00.000Z',
                    referenceDate,
                ),
            ).toBe(true);
        });

        it('debe devolver true cuando la fecha de referencia coincide con el inicio o el fin', () => {
            const startDate = '2026-05-20T00:00:00.000Z';
            const endDate = '2026-05-21T00:00:00.000Z';

            expect(validator.isActive(startDate, endDate, new Date(startDate))).toBe(true);
            expect(validator.isActive(startDate, endDate, new Date(endDate))).toBe(true);
        });

        it('debe devolver false cuando la disciplina todavía no empezó', () => {
            expect(
                validator.isActive(
                    '2026-05-21T00:00:00.000Z',
                    '2026-05-22T00:00:00.000Z',
                    new Date('2026-05-20T12:00:00.000Z'),
                ),
            ).toBe(false);
        });

        it('debe devolver false cuando la disciplina ya venció', () => {
            expect(
                validator.isActive(
                    '2026-05-18T00:00:00.000Z',
                    '2026-05-19T00:00:00.000Z',
                    new Date('2026-05-20T12:00:00.000Z'),
                ),
            ).toBe(false);
        });
    });
});
