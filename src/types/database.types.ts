export type UserRole = "super_admin" | "manager" | "cashier" | "stock_keeper";

// ---------------------------------------------------------------------
// Phase 5 — Multi-tenant SaaS
// ---------------------------------------------------------------------

export type TenantPlan = "trial" | "starter" | "pro" | "enterprise";
export type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  max_stores: number;
  max_users: number;
  trial_ends_at: string;
  created_at: string;
  updated_at: string;
};

export type Store = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  tenant_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  tenant_id: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  description: string | null;
  unit: string;
  unit_id: string | null;
  purchase_price: number;
  sale_price: number;
  wholesale_price: number | null;
  image_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductStock = {
  id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  alert_threshold: number;
  updated_at: string;
};

export type ProductOverview = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  category_name: string | null;
  sale_price: number;
  purchase_price: number;
  wholesale_price: number | null;
  is_active: boolean;
  total_stock: number;
  stores_low_stock: number;
};

// ---------------------------------------------------------------------
// Phase 2 — Stocks et mouvements
// ---------------------------------------------------------------------

export type MovementType =
  | "in"
  | "out"
  | "transfer_out"
  | "transfer_in"
  | "adjustment_in"
  | "adjustment_out"
  | "inventory_correction_in"
  | "inventory_correction_out";

export type MovementReferenceType = "purchase_order" | "transfer" | "inventory" | "manual" | "sale";
export type CountStatus = "draft" | "submitted" | "validated" | "cancelled";
export type PoStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

export type Unit = {
  id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
};

export type StockMovement = {
  id: string;
  type: MovementType;
  product_id: string;
  store_id: string;
  quantity: number;
  unit_cost: number | null;
  reference_type: MovementReferenceType;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  reversal_of: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockMovementDetail = {
  id: string;
  type: MovementType;
  product_id: string;
  product_name: string;
  sku: string;
  store_id: string;
  store_name: string;
  quantity: number;
  unit_cost: number | null;
  reference_type: MovementReferenceType;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  reversal_of: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type StockAlert = {
  product_id: string;
  product_name: string;
  sku: string;
  store_id: string;
  store_name: string;
  quantity: number;
  alert_threshold: number;
};

export type StockCount = {
  id: string;
  reference: string;
  store_id: string;
  status: CountStatus;
  created_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StockCountItem = {
  id: string;
  stock_count_id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
};

// ---------------------------------------------------------------------
// Phase 3 — Ventes, caisse, finances
// ---------------------------------------------------------------------

export type SaleStatus = "completed" | "cancelled";
export type PaymentType = "sale_payment";
export type CashSessionStatus = "open" | "closed";
export type CashAdjustmentType = "in" | "out";
export type PaymentStatus = "paid" | "partial" | "unpaid" | "cancelled";

export type PaymentMethod = {
  id: string;
  name: string;
  is_cash: boolean;
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  store_id: string;
  category_id: string | null;
  payment_method_id: string;
  amount: number;
  description: string;
  expense_date: string;
  created_by: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  reference: string;
  store_id: string;
  customer_id: string | null;
  sold_by: string | null;
  sale_date: string;
  subtotal: number;
  discount_percent: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_percent: number;
  line_total: number;
};

export type Payment = {
  id: string;
  type: PaymentType;
  reference_id: string;
  amount: number;
  payment_method_id: string;
  store_id: string;
  paid_by: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

export type CashSession = {
  id: string;
  store_id: string;
  status: CashSessionStatus;
  opened_by: string | null;
  opened_at: string;
  opening_amount: number;
  closed_by: string | null;
  closed_at: string | null;
  closing_amount: number | null;
  expected_amount: number | null;
  notes: string | null;
  difference: number | null;
};

export type CashAdjustment = {
  id: string;
  cash_session_id: string;
  store_id: string;
  type: CashAdjustmentType;
  amount: number;
  reason: string;
  created_by: string | null;
  created_at: string;
};

export type SaleDetail = {
  id: string;
  reference: string;
  store_id: string;
  store_name: string;
  customer_id: string | null;
  customer_name: string | null;
  sold_by: string | null;
  sold_by_name: string | null;
  sale_date: string;
  subtotal: number;
  discount_percent: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  payment_status: PaymentStatus;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
  customer_phone: string | null;
};

export type CustomerReceivable = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  credit_limit: number;
  unpaid_sales_count: number;
  total_due: number;
};

// ---------------------------------------------------------------------
// Phase 4 — Reporting, analyse, statistiques et BI
// ---------------------------------------------------------------------

export type ProductPerformance = {
  product_id: string;
  product_name: string;
  sku: string;
  category_id: string | null;
  category_name: string | null;
  is_active: boolean;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  margin: number;
  last_sold_at: string | null;
};

export type CustomerAnalytics = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  is_active: boolean;
  orders_count: number;
  total_spent: number;
  avg_basket: number;
  last_purchase_date: string | null;
};

// ---------------------------------------------------------------------
// Phase 5 — PWA, notifications push, audit
// ---------------------------------------------------------------------

export type PushSubscriptionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  created_at: string;
};

export type AuditAction = "insert" | "update" | "delete";

export type AuditLogEntry = {
  id: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  changed_by: string | null;
  changed_by_name: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Partial<Tenant>;
        Update: Partial<Tenant>;
        Relationships: [];
      };
      stores: {
        Row: Store;
        Insert: Partial<Store>;
        Update: Partial<Store>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category>;
        Update: Partial<Category>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Partial<Product>;
        Update: Partial<Product>;
        Relationships: [];
      };
      product_stock: {
        Row: ProductStock;
        Insert: Partial<ProductStock>;
        Update: Partial<ProductStock>;
        Relationships: [];
      };
      units: {
        Row: Unit;
        Insert: Partial<Unit>;
        Update: Partial<Unit>;
        Relationships: [];
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Partial<StockMovement>;
        Update: Partial<StockMovement>;
        Relationships: [];
      };
      stock_counts: {
        Row: StockCount;
        Insert: Partial<StockCount>;
        Update: Partial<StockCount>;
        Relationships: [];
      };
      stock_count_items: {
        Row: StockCountItem;
        Insert: Partial<StockCountItem>;
        Update: Partial<StockCountItem>;
        Relationships: [];
      };
      payment_methods: {
        Row: PaymentMethod;
        Insert: Partial<PaymentMethod>;
        Update: Partial<PaymentMethod>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Partial<Customer>;
        Update: Partial<Customer>;
        Relationships: [];
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Partial<ExpenseCategory>;
        Update: Partial<ExpenseCategory>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: Partial<Expense>;
        Update: Partial<Expense>;
        Relationships: [];
      };
      sales: {
        Row: Sale;
        Insert: Partial<Sale>;
        Update: Partial<Sale>;
        Relationships: [];
      };
      sale_items: {
        Row: SaleItem;
        Insert: Partial<SaleItem>;
        Update: Partial<SaleItem>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment>;
        Update: Partial<Payment>;
        Relationships: [];
      };
      cash_sessions: {
        Row: CashSession;
        Insert: Partial<CashSession>;
        Update: Partial<CashSession>;
        Relationships: [];
      };
      cash_adjustments: {
        Row: CashAdjustment;
        Insert: Partial<CashAdjustment>;
        Update: Partial<CashAdjustment>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow>;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
    };
    Views: {
      v_products_overview: { Row: ProductOverview; Relationships: [] };
      v_stock_alerts: { Row: StockAlert; Relationships: [] };
      v_stock_movements_detail: { Row: StockMovementDetail; Relationships: [] };
      v_sales_detail: { Row: SaleDetail; Relationships: [] };
      v_customer_receivables: { Row: CustomerReceivable; Relationships: [] };
      v_product_performance: { Row: ProductPerformance; Relationships: [] };
      v_customer_analytics: { Row: CustomerAnalytics; Relationships: [] };
      v_audit_log: { Row: AuditLogEntry; Relationships: [] };
    };
    Functions: {
      fn_submit_stock_count: { Args: { p_count_id: string }; Returns: StockCount };
      fn_validate_stock_count: { Args: { p_count_id: string }; Returns: StockCount };
      fn_create_sale: {
        Args: {
          p_store_id: string;
          p_customer_id: string | null;
          p_discount_percent: number;
          p_payment_method_id: string | null;
          p_amount_paid: number;
          p_notes: string | null;
          p_items: { product_id: string; quantity: number; unit_price: number; discount_percent?: number }[];
        };
        Returns: Sale;
      };
      fn_cancel_sale: { Args: { p_sale_id: string; p_reason: string | null }; Returns: Sale };
      fn_record_payment: {
        Args: {
          p_type: PaymentType;
          p_reference_id: string;
          p_amount: number;
          p_payment_method_id: string;
          p_notes: string | null;
        };
        Returns: Payment;
      };
      fn_open_cash_session: { Args: { p_store_id: string; p_opening_amount: number }; Returns: CashSession };
      fn_close_cash_session: {
        Args: { p_session_id: string; p_closing_amount: number; p_notes: string | null };
        Returns: CashSession;
      };
    };
    Enums: {
      user_role: UserRole;
      movement_type: MovementType;
      movement_reference_type: MovementReferenceType;
      count_status: CountStatus;
      po_status: PoStatus;
      sale_status: SaleStatus;
      payment_type: PaymentType;
      cash_session_status: CashSessionStatus;
      cash_adjustment_type: CashAdjustmentType;
      tenant_plan: TenantPlan;
      tenant_status: TenantStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
