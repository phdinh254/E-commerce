export type ProductStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  available: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: number;
  originalPrice?: number;
  image: string;
  gallery: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  stockStatus: ProductStockStatus;
  featured?: boolean;
  isNew?: boolean;
  description: string;
  variants: ProductVariant[];
  specifications: Array<{ label: string; value: string }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
}

export type OrderStatus =
  | "NEW"
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED";

export interface OrderItem {
  id: string;
  productName: string;
  productSlug: string;
  image: string;
  variant: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "PAYOS" | "COD";
  shippingMethod: string;
  trackingCode?: string;
  recipientName: string;
  phoneNumber: string;
  shippingAddress: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE";
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  path: string;
  requestId: string;
  timestamp: string;
}

export interface AdminTableRow {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  meta: string;
}
