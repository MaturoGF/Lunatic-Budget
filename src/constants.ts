import { Category, UserData } from './types';
import { startOfToday } from 'date-fns';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Cibo', color: '#ef4444', icon: 'Utensils', type: 'expense' },
  { id: 'cat-2', name: 'Trasporti', color: '#3b82f6', icon: 'Car', type: 'expense' },
  { id: 'cat-3', name: 'Shopping', color: '#a855f7', icon: 'ShoppingBag', type: 'expense' },
  { id: 'cat-4', name: 'Svago', color: '#f59e0b', icon: 'Gamepad2', type: 'expense' },
  { id: 'cat-5', name: 'Salute', color: '#10b981', icon: 'HeartPulse', type: 'expense' },
  { id: 'cat-6', name: 'Altro', color: '#6b7280', icon: 'MoreHorizontal', type: 'both' },
  { id: 'cat-7', name: 'Stipendio', color: '#10b981', icon: 'Banknote', type: 'income' },
  { id: 'cat-8', name: 'Regalo', color: '#f59e0b', icon: 'Gift', type: 'income' },
  { id: 'cat-9', name: 'Extra', color: '#3b82f6', icon: 'PlusCircle', type: 'income' },
];

export const INITIAL_DATA: UserData = {
  salary: 0,
  savingsGoal: 0,
  fixedExpenses: [],
  expenses: [],
  categories: DEFAULT_CATEGORIES,
  currentBalance: 0,
  salaryDay: 1,
  rolloverBalance: false,
  lastUpdateDate: startOfToday().toISOString(),
  isConfigured: false,
};
