import { EventSummary } from '../products/product.types';

export type PaymentStatus = 'paid' | 'pending' | 'failed';

// The ticket bought, with its event, nested by SQL (json_build_object)
export interface PaymentProduct {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  event: EventSummary;
}

// A purchase of the current user. Amounts are COP without decimals
export interface Payment {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  product: PaymentProduct;
}
