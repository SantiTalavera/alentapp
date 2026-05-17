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

export async function getAll(memberId?: string): Promise<EquipmentLoanDTO[]> {
  const params = new URLSearchParams();
  if (memberId) params.append('memberId', memberId);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_URL}/loans${queryString}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error || 'Error al obtener los préstamos',
    );
  }

  const result = await response.json();
  return result.data as EquipmentLoanDTO[];
}

export async function getById(id: string): Promise<EquipmentLoanDTO> {
  const response = await fetch(`${API_URL}/loans/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error || 'Error al obtener el préstamo',
    );
  }

  const result = await response.json();
  return result.data as EquipmentLoanDTO;
}

export const loansService = {
  create,
  getAll,
  getById,
};
