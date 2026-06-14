export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  currency?: string;
  widget_order?: string;
  subscription_plan?: "Trial" | "Starter" | "Business" | "Enterprise";
  subscription_status?: "Active" | "Expired" | "Pending" | "Suspended";
  subscription_expiry?: string;
  subscription_price_paid?: number;
  subscription_billing_cycle?: "monthly" | "yearly";
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  company: string;
  phone: string;
}

export interface Operation {
  id: string;
  company_id: string;
  client_id: string;
  service: string;
  cost: number;
  revenue: number;
  profit: number;
  date: string;
  status?: "Pending" | "In Progress" | "Completed";
}

export interface Invoice {
  id: string;
  company_id: string;
  op_id: string;
  client_id: string;
  amount: number;
  status: "Paid" | "Unpaid";
  due_date: string;
  payment_date?: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}

export interface Expense {
  id: string;
  company_id: string;
  category: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly" | "once";
  date: string;
  description?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  clientsCount: number;
  operationsCount: number;
  invoicesCount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueCount: number;
  profitMargin: string;
}
