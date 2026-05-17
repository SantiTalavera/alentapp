import { CreateEquipmentLoanRequest } from '@alentapp/shared';
import { MemberRepository } from '../MemberRepository.js';

/**
 * EquipmentLoanValidator — Servicio de dominio.
 *
 * Reglas de negocio:
 *  a) El socio debe existir.
 *  b) El socio debe tener status === 'Activo'.
 *  c) El socio NO debe tener categoría 'Cadete' (solo Pleno u Honorario permitidos).
 *  d) Si se provee due_date, debe ser una fecha futura.
 */
export class EquipmentLoanValidator {
    constructor(private readonly memberRepository: MemberRepository) {}

    async validate(data: CreateEquipmentLoanRequest): Promise<void> {
        // a) El socio debe existir
        const member = await this.memberRepository.findById(data.member_id);
        if (!member) {
            throw new Error('Socio no encontrado');
        }

        // b) El socio debe estar Activo
        if (member.status !== 'Activo') {
            throw new Error('El socio no está activo y no puede solicitar un préstamo');
        }

        // c) El socio no puede ser Cadete
        if (member.category === 'Cadete') {
            throw new Error(
                'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.',
            );
        }

        // d) Si se provee due_date, debe ser una fecha futura
        if (data.due_date !== undefined && data.due_date !== null) {
            const due = new Date(data.due_date);
            if (isNaN(due.getTime())) {
                throw new Error('La fecha de devolución no es válida');
            }
            if (due <= new Date()) {
                throw new Error('La fecha de devolución debe ser una fecha futura');
            }
        }
    }
}
