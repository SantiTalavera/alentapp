import { describe, it, expect } from 'vitest';
import type { CreateSportRequest, UpdateSportRequest } from '@alentapp/shared';
import { SportValidator } from './SportValidator.js';

const validator = new SportValidator();

// Request base válida: cada test modifica únicamente el campo que desea validar.
function buildCreateRequest(overrides: Partial<CreateSportRequest> = {}): CreateSportRequest {
    return {
        name: 'Tenis',
        description: 'Deporte de raqueta',
        max_capacity: 20,
        additional_price: 500,
        requires_medical_certificate: true,
        ...overrides,
    };
}

// Request base válida para update: solo campos editables, todos opcionales.
function buildUpdateRequest(overrides: Partial<UpdateSportRequest> = {}): UpdateSportRequest {
    return { description: 'Nueva descripción', ...overrides };
}

describe('SportValidator — tests unitarios', () => {
    describe('validateCreateRequest()', () => {
        it('debe pasar sin error cuando la request de creación es válida', () => {
            expect(() => validator.validateCreateRequest(buildCreateRequest())).not.toThrow();
        });

        it.each(['', '   '])(
            'debe lanzar error cuando name está vacío o contiene solo espacios ("%s")',
            (name) => {
                expect(() =>
                    validator.validateCreateRequest(buildCreateRequest({ name })),
                ).toThrow('El nombre del deporte es obligatorio');
            },
        );

        it('debe lanzar error cuando name no es string', () => {
            expect(() =>
                validator.validateCreateRequest(
                    buildCreateRequest({ name: 123 as unknown as string }),
                ),
            ).toThrow('El nombre del deporte es obligatorio');
        });

        it.each(['', '   '])(
            'debe lanzar error cuando description está vacía o contiene solo espacios ("%s")',
            (description) => {
                expect(() =>
                    validator.validateCreateRequest(buildCreateRequest({ description })),
                ).toThrow('La descripción del deporte es obligatoria');
            },
        );

        it.each([1.5, NaN])(
            'debe lanzar error cuando max_capacity no es entero (%s)',
            (max_capacity) => {
                expect(() =>
                    validator.validateCreateRequest(buildCreateRequest({ max_capacity })),
                ).toThrow('La capacidad máxima debe ser un número entero');
            },
        );

        it.each([0, -1])(
            'debe lanzar error cuando max_capacity es menor o igual a cero (%s)',
            (max_capacity) => {
                expect(() =>
                    validator.validateCreateRequest(buildCreateRequest({ max_capacity })),
                ).toThrow('La capacidad máxima debe ser mayor a cero');
            },
        );

        it('debe lanzar error cuando additional_price está ausente', () => {
            const data = buildCreateRequest() as unknown as Record<string, unknown>;
            delete data['additional_price'];

            expect(() =>
                validator.validateCreateRequest(data as unknown as CreateSportRequest),
            ).toThrow('El precio adicional es obligatorio');
        });

        it('debe lanzar error cuando additional_price es menor que cero', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ additional_price: -1 })),
            ).toThrow('El precio adicional debe ser mayor o igual a cero');
        });

        it('debe aceptar additional_price igual a cero', () => {
            expect(() =>
                validator.validateCreateRequest(buildCreateRequest({ additional_price: 0 })),
            ).not.toThrow();
        });

        it('debe lanzar error cuando requires_medical_certificate no es booleano', () => {
            expect(() =>
                validator.validateCreateRequest(
                    buildCreateRequest({
                        requires_medical_certificate: 'true' as unknown as boolean,
                    }),
                ),
            ).toThrow('El campo requiere certificado médico debe ser verdadero o falso');
        });
    });

    describe('validateUpdateRequest()', () => {
        // TEST [1]: Modificación parcial mínima válida.
        it('debe pasar sin error cuando la modificación parcial es válida', () => {
            expect(() =>
                validator.validateUpdateRequest(buildUpdateRequest()),
            ).not.toThrow();
        });

        // TEST [2]: Body vacío → no hay campos para actualizar.
        it('debe lanzar error cuando el body está vacío', () => {
            expect(() => validator.validateUpdateRequest({})).toThrow(
                'Se requiere al menos un campo para actualizar',
            );
        });

        // TEST [3]: name es inmutable luego de la creación.
        it('debe rechazar la modificación del nombre', () => {
            expect(() =>
                validator.validateUpdateRequest({ name: 'Nuevo nombre' } as unknown as UpdateSportRequest),
            ).toThrow('El nombre del deporte no puede modificarse');
        });

        // TEST [4]: Campos no permitidos.
        // NOTA: deleted_at recibe un mensaje propio ('No se puede modificar el campo deleted_at'),
        // mientras que otros campos inválidos como id reciben el mensaje genérico.
        it.each([
            [{ id: 'some-id' }, 'Se enviaron campos no permitidos'],
            [{ deleted_at: '2026-01-01T00:00:00.000Z' }, 'No se puede modificar el campo deleted_at'],
        ] as Array<[Record<string, unknown>, string]>)(
            'debe rechazar campos no permitidos (%o)',
            (payload, expectedMessage) => {
                expect(() =>
                    validator.validateUpdateRequest(payload as unknown as UpdateSportRequest),
                ).toThrow(expectedMessage);
            },
        );

        // TEST [5]: description vacía es inválida en update igual que en create.
        it('debe lanzar error cuando description está vacía', () => {
            expect(() =>
                validator.validateUpdateRequest(buildUpdateRequest({ description: '' })),
            ).toThrow('La descripción del deporte es obligatoria');
        });

        // TEST [6]: max_capacity decimal.
        it('debe lanzar error cuando max_capacity no es entero', () => {
            expect(() =>
                validator.validateUpdateRequest(buildUpdateRequest({ max_capacity: 1.5 })),
            ).toThrow('La capacidad máxima debe ser un número entero');
        });

        // TEST [7]: max_capacity <= 0.
        it.each([0, -1])(
            'debe lanzar error cuando max_capacity es menor o igual a cero (%s)',
            (max_capacity) => {
                expect(() =>
                    validator.validateUpdateRequest(buildUpdateRequest({ max_capacity })),
                ).toThrow('La capacidad máxima debe ser mayor a cero');
            },
        );

        // TEST [8]: additional_price negativo.
        // El validator de update usa un método específico que lanza 'El precio adicional no puede ser negativo'.
        it('debe lanzar error cuando additional_price es negativo', () => {
            expect(() =>
                validator.validateUpdateRequest(buildUpdateRequest({ additional_price: -1 })),
            ).toThrow('El precio adicional no puede ser negativo');
        });

        // TEST [9]: requires_medical_certificate debe ser booleano.
        it('debe lanzar error cuando requires_medical_certificate no es booleano', () => {
            expect(() =>
                validator.validateUpdateRequest(
                    buildUpdateRequest({
                        requires_medical_certificate: 'false' as unknown as boolean,
                    }),
                ),
            ).toThrow('El campo requiere certificado médico debe ser verdadero o falso');
        });

        // TEST [10]: 0 es un precio válido; no debe interpretarse como ausencia de valor.
        it('debe aceptar additional_price igual a cero', () => {
            expect(() =>
                validator.validateUpdateRequest(buildUpdateRequest({ additional_price: 0 })),
            ).not.toThrow();
        });

        // TEST [11]: false es un valor booleano válido; no debe interpretarse como ausencia de valor.
        it('debe aceptar requires_medical_certificate igual a false', () => {
            expect(() =>
                validator.validateUpdateRequest(
                    buildUpdateRequest({ requires_medical_certificate: false }),
                ),
            ).not.toThrow();
        });
    });
});
