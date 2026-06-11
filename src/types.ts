export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'bimonthly' | 'quarterly' | 'custom';
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'expense' | 'income' | 'both';
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO string
  categoryId: string;
  type?: 'expense' | 'income';
  isSplit?: boolean;
  splitDays?: number;
  isAutoSplitIncome?: boolean;
  isPrimarySplit?: boolean;
  totalSplitAmount?: number;
  parentTransactionId?: string;
}

export interface UserData {
  salary: number;
  savingsGoal: number;
  fixedExpenses: FixedExpense[];
  expenses: Expense[];
  categories: Category[];
  currentBalance: number;
  salaryDay: number;
  rolloverBalance: boolean;
  lastUpdateDate: string; // ISO string (date only)
  isConfigured: boolean;
}

export type ViewType = 'dashboard' | 'budget' | 'transactions' | 'categories' | 'recurring' | 'stats' | 'settings' | 'import-export';
