// Database types for Wood Ceylon Business Management System

export interface Account {
  id: string;
  account_name: string;
  account_type: 'personal' | 'business' | 'loan';
  owner_name: string;
  balance_minor: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  total_spent_minor: number;
  is_repeat_customer: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  name: string;
  hourly_rate_minor: number;
  total_earned_minor: number;
  total_advances_minor: number;
  current_balance_minor: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  hire_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  product_code: string | null;
  category_id: string;
  description: string | null;
  is_custom: boolean;
  standard_price_minor: number;
  labor_cost_minor: number;
  material_cost_minor: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  warehouse_id: string;
  stock_quantity: number;
  reserved_quantity?: number;
  labor_cost_minor: number;
  material_cost_minor: number;
  other_cost_minor?: number;
  average_cost_minor: number;
  minimum_stock_level: number;
  maximum_stock_level?: number;
  location_in_warehouse?: string;
  notes?: string;
  last_updated_by?: string;
  created_at: string;
  updated_at: string;
  product_name?: string;
  warehouse_name?: string;
}

export type OrderStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type OrderPlatform = 'website' | 'etsy' | 'local';
export type PaymentStatus = 'advance' | 'full' | 'partial' | 'pending';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  status: OrderStatus;
  platform: OrderPlatform;
  total_amount_minor: number;
  total_labor_cost_minor: number;
  total_material_cost_minor: number;
  shipping_cost_minor: number;
  other_cost_minor: number;
  discount_minor: number;
  paid_amount_minor: number;
  payment_status: PaymentStatus;
  payment_notes: string | null;
  notes: string | null;
  priority: OrderPriority;
  assigned_worker_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  worker_name?: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price_minor: number;
  labor_cost_minor: number;
  material_cost_minor: number;
  assigned_worker_id: string | null;
  is_completed: boolean;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  worker_name?: string;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  issue_date: string;
  valid_until: string | null;
  status: QuotationStatus;
  subtotal_minor: number;
  tax_minor: number;
  total_amount_minor: number;
  notes: string | null;
  converted_to_order_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  items?: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price_minor: number;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'pending' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  order_id: string | null;
  quotation_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal_minor: number;
  tax_minor: number;
  total_amount_minor: number;
  paid_amount_minor: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  order_item_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price_minor: number;
  tax_rate: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';

export interface Transaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  transaction_type: TransactionType;
  from_account_id: string | null;
  to_account_id: string | null;
  amount_minor: number;
  description: string | null;
  category: string | null;
  reference_type: string | null;
  reference_id: string | null;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
  from_account_name?: string;
  to_account_name?: string;
}

export interface WorkerAdvance {
  id: string;
  worker_id: string;
  amount_minor: number;
  advance_date: string;
  payment_method: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  worker_name?: string;
}

export interface WorkerWorkLog {
  id: string;
  worker_id: string;
  order_id: string | null;
  order_item_id: string | null;
  work_date: string;
  hours_worked: number;
  items_completed: number;
  earnings_minor: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  worker_name?: string;
  order_number?: string;
}

export type WorkerPaymentStatus = 'pending' | 'partial' | 'completed';
export type WorkerAssignmentStatus = 'assigned' | 'in_progress' | 'completed';

export interface WorkerPaymentRecord {
  id: string;
  worker_id: string;
  order_id: string;
  order_item_id: string;
  product_name: string;
  quantity: number;
  labor_cost_per_item_minor: number;
  total_labor_cost_minor: number;
  advance_payment_minor: number;
  remaining_balance_minor: number;
  payment_status: WorkerPaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  worker_name?: string;
  order_number?: string;
}

export interface WorkerProductAssignment {
  id: string;
  worker_id: string;
  order_id: string;
  order_item_id: string;
  product_name: string;
  quantity: number;
  assigned_date: string;
  completion_date: string | null;
  status: WorkerAssignmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  worker_name?: string;
  order_number?: string;
}

export interface StandalonePayment {
  id: string;
  worker_id: string;
  amount_minor: number;
  payment_type: 'advance' | 'full';
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  worker_name?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: 'receipt' | 'issue' | 'adjustment' | 'transfer';
  quantity: number;
  unit_cost_minor: number;
  reference_type: string | null;
  reference_id: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string;
  product_name?: string;
  warehouse_name?: string;
}

export interface ProfitDistribution {
  id: string;
  order_id: string | null;
  total_profit_minor: number;
  ashan_share_minor: number;
  praveen_share_minor: number;
  business_share_minor: number;
  distribution_date: string;
  is_distributed: boolean;
  notes: string | null;
  created_at: string;
  order_number?: string;
}

export interface SystemSettings {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  setting_type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  registration: string;
  currency: string;
}

export interface ProfitSharing {
  ashan: number;
  praveen: number;
  business: number;
}

// Dashboard KPIs
export interface DashboardKPIs {
  totalRevenue: number;
  totalExpenses: number;
  totalLaborCost: number;
  netProfit: number;
  ordersCompleted: number;
  ordersPending: number;
  accountBalances: {
    ashan: number;
    praveen: number;
    business: number;
    loan: number;
  };
}

export type AttendanceType = 'full_day' | 'half_day' | 'absent';

export interface WorkerDailyWork {
  id: string;
  worker_id: string;
  work_date: string;
  attendance_type: AttendanceType;
  hours_worked: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  worker_name?: string;
}
