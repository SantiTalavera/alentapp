import type { CreateEquipmentLoanRequest, EquipmentLoanDTO } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export async function create(data: CreateEquipmentLoanRequest): Promise<EquipmentLoanDTO> {
  const response = await fetch(`${API_URL}/loans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error || 'Error al registrar el préstamo',
    );
  }

  const result = await response.json();
  return result.data as EquipmentLoanDTO;
}

export const loansService = {
  create,
};
