import { CreateEquipmentLoanRequest, EquipmentLoanDTO } from '@alentapp/shared';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

export class CreateEquipmentLoanUseCase {
    constructor(
        private readonly equipmentLoanRepository: EquipmentLoanRepository,
        private readonly equipmentLoanValidator: EquipmentLoanValidator,
    ) {}

    async execute(data?: CreateEquipmentLoanRequest | null): Promise<EquipmentLoanDTO> {
        const payload = data ?? ({} as Partial<CreateEquipmentLoanRequest>);

        // --- Validaciones de formato / campos obligatorios ---
        const itemNameRaw = payload.item_name;
        if (
            itemNameRaw === undefined ||
            itemNameRaw === null ||
            (typeof itemNameRaw === 'string' && itemNameRaw.trim() === '')
        ) {
            throw new Error('El nombre del ítem es obligatorio');
        }

        const memberIdRaw = payload.member_id;
        if (
            memberIdRaw === undefined ||
            memberIdRaw === null ||
            (typeof memberIdRaw === 'string' && memberIdRaw.trim() === '')
        ) {
            throw new Error('El socio es obligatorio');
        }

        if (typeof itemNameRaw !== 'string' || typeof memberIdRaw !== 'string') {
            throw new Error('Formato de campos inválido');
        }

        const item_name = itemNameRaw.trim();
        const member_id = memberIdRaw.trim();

        if (!isUuid(member_id)) {
            throw new Error('Identificador de socio inválido');
        }

        const request: CreateEquipmentLoanRequest = {
            item_name,
            member_id,
            ...(payload.due_date !== undefined && { due_date: payload.due_date }),
        };

        // --- Validaciones de dominio ---
        await this.equipmentLoanValidator.validate(request);

        // --- Persistencia ---
        return this.equipmentLoanRepository.create({
            item_name,
            member_id,
            due_date: payload.due_date ?? null,
        });
    }
}
