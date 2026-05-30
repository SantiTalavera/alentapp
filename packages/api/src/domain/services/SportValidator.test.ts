import { describe, it, expect } from 'vitest';
import type { CreateSportRequest } from '@alentapp/shared';
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
});
