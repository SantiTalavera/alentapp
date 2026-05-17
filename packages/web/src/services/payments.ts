import type { CreatePaymentRequest, PaymentDTO } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export const paymentsService = {
  async create(data: CreatePaymentRequest): Promise<PaymentDTO> {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al registrar el pago');
    }

    const result = await response.json();
    return result.data;
  },

  async getAll(filters?: { memberId?: string, status?: string, month?: number, year?: number }): Promise<PaymentDTO[]> {
    const params = new URLSearchParams();
    if (filters?.memberId) params.append('memberId', filters.memberId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.month !== undefined) params.append('month', filters.month.toString());
    if (filters?.year !== undefined) params.append('year', filters.year.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/payments${queryString}`);

    if (!response.ok) {
      throw new Error('Error al obtener los pagos');
    }

    const result = await response.json();
    return result.data;
  },

  async getById(id: string): Promise<PaymentDTO> {
    const response = await fetch(`${API_URL}/payments/${id}`);

    if (!response.ok) {
      throw new Error('Error al obtener el pago');
    }

    const result = await response.json();
    return result.data;
  },

  async update(id: string, data: Partial<PaymentDTO>): Promise<PaymentDTO> {
    const response = await fetch(`${API_URL}/payments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar el pago');
    }

    const result = await response.json();
    return result.data;
  },

  async cancel(id: string): Promise<PaymentDTO> {
    const response = await fetch(`${API_URL}/payments/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al cancelar el pago');
    }

    const result = await response.json();
    return result.data;
  }
};
