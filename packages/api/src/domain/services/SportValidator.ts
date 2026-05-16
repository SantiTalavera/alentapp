import { CreateSportRequest } from '@alentapp/shared';

const UPDATE_ALLOWED_KEYS = new Set([
    'description',
    'max_capacity',
    'additional_price',
    'requires_medical_certificate',
]);

export class SportValidator {
    validateCreateRequest(data: CreateSportRequest): void {
        this.validateName(data.name);
        this.validateDescription(data.description);
        this.validateMaxCapacity(data.max_capacity);
        this.validateAdditionalPrice(data.additional_price);
        this.validateRequiresMedicalCertificate(data.requires_medical_certificate);
    }

    validateName(name: unknown): void {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('El nombre del deporte es obligatorio');
        }
    }

    validateDescription(description: unknown): void {
        if (typeof description !== 'string' || description.trim() === '') {
            throw new Error('La descripción del deporte es obligatoria');
        }
    }

    validateMaxCapacity(value: unknown): void {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error('La capacidad máxima debe ser un número entero');
        }
        if (!Number.isInteger(value)) {
            throw new Error('La capacidad máxima debe ser un número entero');
        }
        if (value <= 0) {
            throw new Error('La capacidad máxima debe ser mayor a cero');
        }
    }

    validateAdditionalPrice(value: unknown): void {
        if (value === undefined || value === null) {
            throw new Error('El precio adicional es obligatorio');
        }
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error('El precio adicional debe ser mayor o igual a cero');
        }
        if (value < 0) {
            throw new Error('El precio adicional debe ser mayor o igual a cero');
        }
    }

    validateRequiresMedicalCertificate(value: unknown): void {
        if (typeof value !== 'boolean') {
            throw new Error('El campo requiere certificado médico debe ser verdadero o falso');
        }
    }

    validateUpdateRequest(data: unknown): void {
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Se requiere al menos un campo para actualizar');
        }

        const record = data as Record<string, unknown>;
        const keys = Object.keys(record);
        if (keys.length === 0) {
            throw new Error('Se requiere al menos un campo para actualizar');
        }

        for (const key of keys) {
            if (key === 'name') {
                throw new Error('El nombre del deporte no puede modificarse');
            }
            if (key === 'deleted_at') {
                throw new Error('No se puede modificar el campo deleted_at');
            }
            if (!UPDATE_ALLOWED_KEYS.has(key)) {
                throw new Error('Se enviaron campos no permitidos');
            }
        }

        if ('description' in record) {
            this.validateDescription(record.description);
        }

        if ('max_capacity' in record) {
            this.validateMaxCapacity(record.max_capacity);
        }

        if ('additional_price' in record) {
            this.validateOptionalAdditionalPriceForUpdate(record.additional_price);
        }

        if ('requires_medical_certificate' in record) {
            this.validateRequiresMedicalCertificate(record.requires_medical_certificate);
        }
    }

    private validateOptionalAdditionalPriceForUpdate(value: unknown): void {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error('El precio adicional debe ser mayor o igual a cero');
        }
        if (value < 0) {
            throw new Error('El precio adicional no puede ser negativo');
        }
    }
}
