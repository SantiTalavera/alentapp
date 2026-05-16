import { CreateSportRequest } from '@alentapp/shared';

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
}
