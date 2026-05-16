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
};
