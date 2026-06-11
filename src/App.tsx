/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import React, { Component, useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import { 
  Plus, 
  Minus,
  Settings as SettingsIcon, 
  CreditCard,
  History, 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  X,
  Trash2,
  Delete,
  Pencil,
  Save,
  Menu,
  PiggyBank,
  LayoutDashboard,
  Calculator,
  Calendar as CalendarIcon,
  Tags,
  Repeat,
  PieChart as PieChartIcon,
  Download,
  Upload,
  Utensils,
  Car,
  ShoppingBag,
  Gamepad2,
  HeartPulse,
  MoreHorizontal,
  LogOut,
  Home,
  Coffee,
  Zap,
  Smartphone,
  Plane,
  Gift,
  Briefcase
} from 'lucide-react';
import { 
  format, 
  getDaysInMonth, 
  differenceInCalendarDays, 
  parseISO, 
  startOfToday,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  addDays,
  isAfter,
  isBefore,
  parse,
  isWithinInterval,
  startOfYear,
  endOfYear,
  subMonths,
  addMonths,
  subYears,
  addYears,
  compareDesc,
  isValid
} from 'date-fns';
import { it } from 'date-fns/locale';
import { UserData, FixedExpense, Expense, Category, ViewType } from './types';
import { INITIAL_DATA } from './constants';
import { cn } from './lib/utils';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend, Sector, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Papa from 'papaparse';

const STORAGE_KEY = 'daily_budget_pro_data';

const haptic = {
  light: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },
  success: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 10]);
    }
  },
  warning: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 30]);
    }
  },
  error: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([50, 100, 50, 100]);
    }
  }
};

const getCycleInfo = (date: Date, salaryDay: number = 1) => {
  const actualSalaryDay = Math.max(1, Math.min(salaryDay || 1, 28));
  
  let startDate = new Date(date.getFullYear(), date.getMonth(), actualSalaryDay);
  const daysInMonthOfStart = getDaysInMonth(startDate);
  if (actualSalaryDay > daysInMonthOfStart) {
    startDate = new Date(date.getFullYear(), date.getMonth(), daysInMonthOfStart);
  }

  if (date < startDate) {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const daysInPrevMonth = getDaysInMonth(prevMonth);
    startDate = new Date(date.getFullYear(), date.getMonth() - 1, Math.min(actualSalaryDay, daysInPrevMonth));
  }
  
  const nextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, Math.min(actualSalaryDay, getDaysInMonth(nextMonth)) - 1);
  
  const daysInCycle = differenceInCalendarDays(endDate, startDate) + 1;
  const daysRemaining = differenceInCalendarDays(endDate, date) + 1;
  const dayOfCycle = differenceInCalendarDays(date, startDate) + 1;
  
  return { startDate, endDate, daysInCycle, daysRemaining, dayOfCycle };
};

const isSameCycle = (date1: Date, date2: Date, salaryDay: number = 1) => {
  try {
    const cycle1 = getCycleInfo(date1, salaryDay);
    const cycle2 = getCycleInfo(date2, salaryDay);
    return isWithinInterval(date1, { start: cycle2.startDate, end: cycle2.endDate }) ||
           isSameDay(cycle1.startDate, cycle2.startDate);
  } catch (err) {
    return false;
  }
};

const isRecurringInMonth = (f: FixedExpense, monthDate: Date) => {
  try {
    const checkMonth = startOfMonth(monthDate);
    const start = f.startDate ? startOfMonth(parseISO(f.startDate)) : null;
    const end = f.endDate ? endOfMonth(parseISO(f.endDate)) : null;
    
    if (start && isBefore(checkMonth, start)) return false;
    if (end && isAfter(checkMonth, end)) return false;
    
    return true;
  } catch (err) {
    return true;
  }
};

const calculateMonthlyFixedExpenses = (fixedExpenses: FixedExpense[]) => {
  return (fixedExpenses || []).reduce((acc, curr) => {
    const amount = typeof curr.amount === 'number' ? curr.amount : 0;
    switch (curr.frequency) {
      case 'monthly': return acc + amount;
      case 'bimonthly': return acc + (amount / 2);
      case 'quarterly': return acc + (amount / 3);
      case 'custom': {
        if (curr.startDate && curr.endDate) {
          const start = parseISO(curr.startDate);
          const end = parseISO(curr.endDate);
          const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
          return acc + (amount / months);
        }
        return acc + amount;
      }
      default: return acc + amount;
    }
  }, 0);
};

// Safe UUID fallback for environments without crypto.randomUUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const formatCurrency = (value: number | null | undefined) => {
  const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
  return safeValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const AnimatedNumber = React.memo(({ value }: { value: number }) => {
  const springValue = useSpring(value, {
    mass: 1,
    stiffness: 120, // Increased for snappier feel
    damping: 20,    // Optimized for modern high-refresh displays
    restDelta: 0.001
  });

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  const displayValue = useTransform(springValue, (latest) => {
    const safeValue = (typeof latest === 'number' && !isNaN(latest)) ? latest : 0;
    return safeValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  return <motion.span>{displayValue}</motion.span>;
});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
              <Zap className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-slate-900 uppercase tracking-tight mb-2">Ops! Si è verificato un errore</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Qualcosa è andato storto. Prova a riavviare l'applicazione o torna alla home.</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-slate-900 text-white rounded-[20px] font-display font-black text-lg uppercase tracking-tight active:scale-95 transition-all shadow-lg"
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default function App() {
  const [data, setData] = useState<UserData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  const [view, setView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'expense' | 'income' | null>(null);

  // Capacitor Back Button Handling
  useEffect(() => {
    const handleBackButton = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
      } else if (transactionMode !== null) {
        setTransactionMode(null);
      } else if (view !== 'dashboard') {
        setView('dashboard');
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      handleBackButton.then(h => h.remove());
    };
  }, [isSidebarOpen, transactionMode, view]);
  const [initialTransactionDate, setInitialTransactionDate] = useState<string | undefined>(undefined);
  const [transactionToEdit, setTransactionToEdit] = useState<Expense | undefined>(undefined);

  const updateBudgetConfig = React.useCallback((updates: Partial<UserData>) => {
    setData(prev => {
      const today = startOfToday();
      const salaryDay = updates.salaryDay !== undefined ? updates.salaryDay : prev.salaryDay;
      const { daysInCycle, dayOfCycle } = getCycleInfo(today, salaryDay);

      // Calculate old daily allowance
      const oldTotalFixed = calculateMonthlyFixedExpenses(prev.fixedExpenses);
      const { daysInCycle: oldDaysInCycle } = getCycleInfo(today, prev.salaryDay);
      const oldDailyAllowance = (prev.salary - prev.savingsGoal - oldTotalFixed) / oldDaysInCycle;

      // New values
      const newSalary = updates.salary !== undefined ? updates.salary : prev.salary;
      const newSavingsGoal = updates.savingsGoal !== undefined ? updates.savingsGoal : prev.savingsGoal;
      const newFixedExpenses = updates.fixedExpenses !== undefined ? updates.fixedExpenses : prev.fixedExpenses;
      
      const newTotalFixed = calculateMonthlyFixedExpenses(newFixedExpenses);
      const newDailyAllowance = (newSalary - newSavingsGoal - newTotalFixed) / daysInCycle;

      // Adjustment for the days already passed in the current cycle
      const adjustment = (newDailyAllowance - oldDailyAllowance) * dayOfCycle;

      return {
        ...prev,
        ...updates,
        currentBalance: prev.currentBalance + adjustment
      };
    });
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Daily Update Logic
  useEffect(() => {
    if (!data.isConfigured) return;

    const today = startOfToday();
    const lastUpdate = parseISO(data.lastUpdateDate);
    const daysPassed = differenceInCalendarDays(today, lastUpdate);

    if (daysPassed > 0) {
      setData(prev => {
        let currentBalance = prev.currentBalance;
        let currentDate = lastUpdate;

        for (let i = 0; i < daysPassed; i++) {
          currentDate = addDays(currentDate, 1);
          const { daysInCycle, startDate } = getCycleInfo(currentDate, prev.salaryDay);
          const totalFixed = calculateMonthlyFixedExpenses(prev.fixedExpenses);
          const dailyAllowance = (prev.salary - prev.savingsGoal - totalFixed) / daysInCycle;

          // Check if today is salary day
          if (isSameDay(currentDate, startDate)) {
            if (prev.rolloverBalance) {
              currentBalance += dailyAllowance;
            } else {
              currentBalance = dailyAllowance;
            }
          } else {
            currentBalance += dailyAllowance;
          }

          // Important: We ONLY subtract expenses if the app WAS CLOSED during those days.
          // Since handleAddTransaction handles immediate subtraction for today,
          // the loop correctly processes missed days from lastUpdate + 1.
          const transactionsOnThisDay = prev.expenses.filter(e => isSameDay(parseISO(e.date), currentDate));
          transactionsOnThisDay.forEach(t => {
            if (t.type === 'income') {
              currentBalance += t.amount;
            } else {
              currentBalance -= t.amount;
            }
          });
        }

        return {
          ...prev,
          currentBalance: Number(currentBalance.toFixed(2)),
          lastUpdateDate: today.toISOString()
        };
      });
    }
  }, [data.isConfigured, data.lastUpdateDate, data.salary, data.savingsGoal, data.fixedExpenses, data.salaryDay, data.rolloverBalance]);

  const today = startOfToday();
  const { daysRemaining, daysInCycle } = getCycleInfo(today, data.salaryDay);
  const totalFixed = calculateMonthlyFixedExpenses(data.fixedExpenses);
  
  // Calculate daily income bonuses for today (from split income)
  const incomesToday = data.expenses.filter(e => 
    e.type === 'income' && isSameDay(parseISO(e.date), today)
  );
  const incomeBonusToday = incomesToday.reduce((acc, curr) => acc + curr.amount, 0);

  const idealDailyBudgetRaw = data.isConfigured 
    ? ((data.salary - data.savingsGoal - totalFixed) / (daysInCycle || 30)) + incomeBonusToday
    : 0;
  const idealDailyBudget = isNaN(idealDailyBudgetRaw) ? 0 : idealDailyBudgetRaw;

  // The daily budget is the current accumulated balance available to spend today
  const dailyBudgetRaw = data.isConfigured
    ? data.currentBalance
    : 0;
  const dailyBudget = isNaN(dailyBudgetRaw) ? 0 : dailyBudgetRaw;

  const handleAddTransaction = React.useCallback((name: string, amount: number, categoryId: string, type: 'expense' | 'income', date: string, isSplit: boolean, splitDays: number, splitStartDateISO?: string) => {
    haptic.success();
    const actionToday = startOfToday();
    const transactionDate = parseISO(date);
    
    let effectiveIsSplit = isSplit;
    let effectiveSplitDays = splitDays;
    let splitStartDate = splitStartDateISO ? parseISO(splitStartDateISO) : transactionDate;

    if (effectiveIsSplit && effectiveSplitDays > 1) {
      const dailyAmount = amount / effectiveSplitDays;
      const newTransactions: Expense[] = [];
      let immediateAdjustment = 0;
      const parentTransactionId = generateId();
      
      for (let i = 0; i < effectiveSplitDays; i++) {
        const currentDay = addDays(splitStartDate, i);
        const isSelectedDay = isSameDay(currentDay, transactionDate);
        
        newTransactions.push({
          id: generateId(),
          name: effectiveSplitDays === getDaysInMonth(transactionDate) && type === 'income' 
            ? `${name} (Quota ${i + 1}/${effectiveSplitDays})`
            : `${name} (${i + 1}/${effectiveSplitDays})`,
          amount: dailyAmount,
          date: currentDay.toISOString(),
          categoryId,
          type,
          isSplit: true,
          splitDays: effectiveSplitDays,
          isAutoSplitIncome: type === 'income',
          parentTransactionId,
          isPrimarySplit: isSelectedDay, // Mark the entry on the chosen day as primary
          totalSplitAmount: isSelectedDay ? amount : undefined
        });

        if (!isAfter(currentDay, actionToday)) {
          if (type === 'expense') immediateAdjustment -= dailyAmount;
          else immediateAdjustment += dailyAmount;
        }
      }

      setData(prev => ({
        ...prev,
        expenses: [...newTransactions, ...prev.expenses],
        currentBalance: Number((prev.currentBalance + immediateAdjustment).toFixed(2))
      }));
    } else {
      const newTransaction: Expense = {
        id: generateId(),
        name,
        amount,
        date: transactionDate.toISOString(),
        categoryId,
        type
      };

      let immediateAdjustment = 0;
      if (!isAfter(transactionDate, actionToday)) {
        immediateAdjustment = type === 'expense' ? -amount : amount;
      }

      setData(prev => ({
        ...prev,
        expenses: [newTransaction, ...prev.expenses],
        currentBalance: Number((prev.currentBalance + immediateAdjustment).toFixed(2))
      }));
    }
    setTransactionMode(null);
  }, []);

  const handleDeleteExpense = React.useCallback((id: string) => {
    haptic.warning();
    setData(prev => {
      const expense = prev.expenses.find(e => e.id === id);
      if (!expense) return prev;

      const deletionToday = startOfToday();
      let refundAmount = 0;
      let idsToRemove = [id];

      // If it's a split transaction, we remove all related parts for consistency
      if (expense.parentTransactionId) {
        const relatedExpenses = prev.expenses.filter(e => e.parentTransactionId === expense.parentTransactionId);
        idsToRemove = relatedExpenses.map(e => e.id);
        
        // Calculate total refund for all parts that have passed
        relatedExpenses.forEach(e => {
          if (!isAfter(parseISO(e.date), deletionToday)) {
            refundAmount += (e.type === 'income' ? -e.amount : e.amount);
          }
        });
      } else {
        const expenseDate = parseISO(expense.date);
        if (!isAfter(expenseDate, deletionToday)) {
          refundAmount = expense.type === 'income' ? -expense.amount : expense.amount;
        }
      }

      return {
        ...prev,
        expenses: prev.expenses.filter(e => !idsToRemove.includes(e.id)),
        currentBalance: Number((prev.currentBalance + refundAmount).toFixed(2))
      };
    });
  }, []);

  const handleEditTransaction = React.useCallback((id: string, name: string, amount: number, categoryId: string, type: 'expense' | 'income', date: string, isSplit: boolean, splitDays: number, splitStartDateISO?: string) => {
    // Simply delete the old one and add the new one to handle split logic and balance adjustments cleanly
    handleDeleteExpense(id);
    handleAddTransaction(name, amount, categoryId, type, date, isSplit, splitDays, splitStartDateISO);
    setTransactionToEdit(undefined);
  }, [handleDeleteExpense, handleAddTransaction]);

  const isNegative = data.isConfigured && dailyBudget < 0;

  // Dynamic Theme Color for Status Bar
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isNegative ? '#dc2626' : '#10b981');
    }
  }, [isNegative]);

  if (!data.isConfigured) {
    return (
      <ErrorBoundary>
        <SetupWizard 
          initialData={data} 
          onComplete={(newData) => {
            const today = startOfToday();
            const { daysInCycle, dayOfCycle } = getCycleInfo(today, newData.salaryDay);
            const totalFixed = calculateMonthlyFixedExpenses(newData.fixedExpenses);
            const dailyAllowance = (newData.salary - newData.savingsGoal - totalFixed) / daysInCycle;
            
            setData({
              ...newData,
              currentBalance: dailyAllowance * dayOfCycle, // Accumulated budget from the start of the cycle
              lastUpdateDate: today.toISOString(),
              isConfigured: true
            });
            setView('dashboard');
          }} 
        />
      </ErrorBoundary>
    );
  }


  return (
    <ErrorBoundary>
      <div className="h-[100dvh] flex flex-col lg:flex-row transition-colors duration-700 bg-[--color-bg-main] overflow-hidden selection:bg-primary/20">
      
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-80 bg-white z-50 transform transition-transform duration-500 ease-out lg:relative lg:translate-x-0 border-r border-slate-100",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-8 pt-[calc(2rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-colors duration-500",
              isNegative ? "bg-red-600" : "bg-primary"
            )}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className={cn(
                "text-xl font-display font-black tracking-tight leading-none uppercase transition-colors duration-500",
                isNegative ? "text-red-600" : "text-slate-900"
              )}>Lunatic Budget</h1>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard />} 
              label="Dashboard" 
              active={view === 'dashboard'} 
              isNegative={isNegative}
              onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Calculator />} 
              label="Sistema Budget" 
              active={view === 'budget'} 
              isNegative={isNegative}
              onClick={() => { setView('budget'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<CalendarIcon />} 
              label="Transazioni" 
              active={view === 'transactions'} 
              isNegative={isNegative}
              onClick={() => { setView('transactions'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<PieChartIcon />} 
              label="Statistiche" 
              active={view === 'stats'} 
              isNegative={isNegative}
              onClick={() => { setView('stats'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Repeat />} 
              label="Spese Ricorrenti" 
              active={view === 'recurring'} 
              isNegative={isNegative}
              onClick={() => { setView('recurring'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Tags />} 
              label="Categorie" 
              active={view === 'categories'} 
              isNegative={isNegative}
              onClick={() => { setView('categories'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<History />} 
              label="Import / Export" 
              active={view === 'import-export'} 
              isNegative={isNegative}
              onClick={() => { setView('import-export'); setIsSidebarOpen(false); }} 
            />
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0 transition-colors duration-700 bg-white lg:bg-transparent overflow-hidden">
        {/* Top Header */}
        <header className={cn(
          "flex items-center justify-between px-6 border-b text-white shrink-0 z-40 lg:hidden shadow-md pt-[env(safe-area-inset-top)] h-[calc(4.5rem+env(safe-area-inset-top))]",
          isNegative ? "bg-red-600 border-red-700" : "bg-primary border-primary-dark"
        )}>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-white/10 rounded-xl transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em]">
              {view === 'dashboard' ? 'Overview' : 
               view === 'budget' ? 'Sistema Budget' :
               view === 'transactions' ? 'Transazioni' :
               view === 'stats' ? 'Statistiche' :
               view === 'recurring' ? 'Spese Ricorrenti' :
               view === 'categories' ? 'Categorie' :
               view === 'import-export' ? 'Import / Export' : 
               view.replace('-', ' ')}
            </h1>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12 pb-[calc(5rem+env(safe-area-inset-bottom))] overscroll-contain modern-scroll">
          <div className="max-w-5xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
              {view === 'dashboard' && (
                <ViewWrapper key="dashboard">
                  <DashboardView 
                    data={data} 
                    dailyBudget={dailyBudget} 
                    idealDailyBudget={idealDailyBudget}
                    daysRemaining={daysRemaining}
                    onAddTransaction={(mode) => setTransactionMode(mode)} 
                  />
                </ViewWrapper>
              )}
              {view === 'budget' && (
                <ViewWrapper key="budget">
                  <BudgetSystemView 
                    data={data} 
                    onSave={(updated) => updateBudgetConfig(updated)} 
                  />
                </ViewWrapper>
              )}
              {view === 'transactions' && (
                <ViewWrapper key="transactions">
                  <TransactionsView 
                    data={data} 
                    onDeleteExpense={handleDeleteExpense} 
                    onOpenAddModal={(mode, date) => {
                      setInitialTransactionDate(date);
                      setTransactionMode(mode);
                    }}
                    onEditExpense={(expense) => {
                      setTransactionToEdit(expense);
                      setTransactionMode(expense.type || 'expense');
                    }}
                  />
                </ViewWrapper>
              )}
              {view === 'categories' && (
                <ViewWrapper key="categories">
                  <CategoriesView 
                    data={data} 
                    onSave={(categories) => setData(prev => ({ ...prev, categories }))} 
                  />
                </ViewWrapper>
              )}
              {view === 'recurring' && (
                <ViewWrapper key="recurring">
                  <RecurringExpensesView 
                    data={data} 
                    onSave={(fixedExpenses) => updateBudgetConfig({ fixedExpenses })} 
                  />
                </ViewWrapper>
              )}
              {view === 'stats' && (
                <ViewWrapper key="stats">
                  <StatsView data={data} />
                </ViewWrapper>
              )}
              {view === 'import-export' && (
                <ViewWrapper key="import-export">
                  <ImportExportView 
                    data={data} 
                    onImport={(newData) => setData(newData)} 
                  />
                </ViewWrapper>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {transactionMode && (
          <AddTransactionModal 
            mode={transactionMode}
            categories={data.categories}
            initialDate={initialTransactionDate}
            transactionToEdit={transactionToEdit}
            onClose={() => {
              setTransactionMode(null);
              setInitialTransactionDate(undefined);
              setTransactionToEdit(undefined);
            }} 
            onAdd={handleAddTransaction}
            onEdit={handleEditTransaction}
            onAddCategory={(name, color, icon, type) => {
              const newCat = { id: generateId(), name, color, icon, type };
              setData(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

const ViewWrapper = React.memo(({ children }: { children: React.ReactNode; key?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ 
        type: 'spring', 
        damping: 30, 
        stiffness: 250,
        restDelta: 0.01 
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
});

const SidebarItem = React.memo(({ icon, label, active, onClick, isNegative }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isNegative?: boolean }) => {
  return (
    <button 
      onClick={() => {
        haptic.light();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all active:scale-[0.98]",
        active 
          ? (isNegative ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
});

// --- Sub-Views (To be implemented in next steps) ---
// I'll implement them as separate components below to keep App.tsx functional.

const BudgetGauge = React.memo(({ amount, max, label, isNegative }: { amount: number, max: number, label: string, isNegative: boolean }) => {
  const percentage = Math.min(Math.max((Math.abs(amount) / (max || 1)) * 100, 0), 100);
  const radius = 42;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        <svg className={cn("w-full h-full -rotate-90 overflow-visible", amount < 0 && "scale-x-[-1]")} viewBox="0 0 100 100">
          {/* Background Circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={stroke}
          />
          {/* Progress Circle */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={amount < 0 ? "#ef4444" : "#10b981"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "circOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={cn(
            "text-[13px] font-display font-black leading-none",
            amount < 0 ? "text-red-500" : "text-emerald-500"
          )}>
            {amount.toFixed(2).replace('.', ',')}€
          </span>
          <p className="text-[6px] sm:text-[7px] font-black uppercase tracking-wider text-slate-400 leading-tight mt-1 max-w-[80%]">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
});

const DashboardView = React.memo(({ data, dailyBudget, idealDailyBudget, daysRemaining, onAddTransaction }: { data: UserData, dailyBudget: number, idealDailyBudget: number, daysRemaining: number, onAddTransaction: (mode: 'expense' | 'income') => void }) => {
  const isNegative = dailyBudget < 0;
  const today = startOfToday();

  const expensesToday = data.expenses.filter(e => 
    e.type === 'expense' && isSameDay(parseISO(e.date), today)
  );
  const spentToday = expensesToday.reduce((acc, curr) => acc + curr.amount, 0);
  
  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Visual Header */}
      <div className={cn(
        "-mx-4 sm:-mx-6 lg:-mx-12 -mt-4 sm:-mt-6 lg:-mt-12 h-[81px] text-white shadow-lg overflow-hidden relative flex items-center transition-colors duration-500",
        isNegative ? "bg-red-600" : "bg-primary"
      )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-3xl -mr-32 -mt-32 rounded-full" />
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 flex flex-row justify-center items-center text-center relative z-10 h-[45px] -mt-[5px] mb-0">
          <div>
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest leading-none opacity-60">{format(today, 'EEEE,', { locale: it })}</p>
              <p className="text-xl font-display font-black leading-tight mt-1 uppercase tracking-tight">{format(today, 'd MMMM yy', { locale: it })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center text-center py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400">
          Disponibilità Oggi
        </p>
        <div className="relative group">
          <h2 className={cn(
            "text-6xl sm:text-7xl lg:text-8xl font-display font-black tracking-tighter transition-colors",
            isNegative ? "text-red-600" : "text-emerald-600"
          )}>
            <AnimatedNumber value={dailyBudget} />€
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-8">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Quota Standard</p>
            <p className="text-lg font-display font-black text-slate-900">{formatCurrency(idealDailyBudget)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Accumulo Mese</p>
            <p className={cn(
              "text-lg font-display font-black",
              (data.currentBalance + (daysRemaining - 1) * idealDailyBudget) < 0 ? "text-red-600" : "text-emerald-600"
            )}>
              {formatCurrency(data.currentBalance + (daysRemaining - 1) * idealDailyBudget)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-row justify-center gap-4 sm:gap-12 lg:gap-16 -mt-[26px] mb-[26px]">
        <BudgetGauge 
          label="Domani" 
          amount={data.currentBalance + idealDailyBudget} 
          max={idealDailyBudget * 2} 
          isNegative={isNegative} 
        />
        <BudgetGauge 
          label={format(addDays(today, 2), 'eeee', { locale: it })} 
          amount={data.currentBalance + idealDailyBudget * 2} 
          max={idealDailyBudget * 3} 
          isNegative={isNegative} 
        />
        <BudgetGauge 
          label={format(addDays(today, 3), 'eeee', { locale: it })} 
          amount={data.currentBalance + idealDailyBudget * 3} 
          max={idealDailyBudget * 4} 
          isNegative={isNegative} 
        />
      </div>

      <div className="flex gap-4 sm:gap-6">
        <button 
          onClick={() => {
            haptic.medium();
            onAddTransaction('expense');
          }}
          className="flex-1 h-[70px] bg-red-500 text-white rounded-[24px] font-bold shadow-lg shadow-red-100 active:scale-[0.95] transition-all flex flex-col items-center justify-center gap-1"
        >
          <Minus className="w-8 h-8" />
          <span className="text-[10px] font-black uppercase tracking-widest">Uscita</span>
        </button>
        <button 
          onClick={() => {
            haptic.medium();
            onAddTransaction('income');
          }}
          className="flex-1 h-[70px] bg-emerald-500 text-white rounded-[24px] font-bold shadow-lg shadow-emerald-100 active:scale-[0.95] transition-all flex flex-col items-center justify-center gap-1"
        >
          <Plus className="w-8 h-8" />
          <span className="text-[10px] font-black uppercase tracking-widest">Entrata</span>
        </button>
      </div>

      {/* Today's Transactions Slider */}
      {data.expenses.filter(e => isSameDay(parseISO(e.date), today)).length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Oggi</h3>
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Scorri per vedere &rarr;</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-0 sm:px-0 hide-scrollbar snap-x snap-mandatory">
            {data.expenses
              .filter(e => isSameDay(parseISO(e.date), today))
              .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
              .map(expense => {
                const category = data.categories.find(c => c.id === expense.categoryId);
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={expense.id} 
                    className="min-w-[140px] bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm snap-center flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <CategoryIndicator color={category?.color || '#cbd5e1'} size="sm" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 truncate">
                        {category?.name || 'Altro'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-900 truncate">{expense.name}</p>
                    <p className={cn(
                      "text-lg font-display font-black leading-none",
                      expense.type === 'income' ? "text-emerald-500" : "text-red-500"
                    )}>
                      {expense.type === 'income' ? '+' : '-'}{expense.amount.toFixed(2)}€
                    </p>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
});

// Removed IconRenderer as requested
const CategoryIndicator = React.memo(({ color, size = 'sm' }: { color: string, size?: 'sm' | 'md' }) => {
  const dimensions = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return <div className={cn(dimensions, "rounded-full shrink-0 shadow-inner")} style={{ backgroundColor: color }} />;
});

const BudgetSystemView = React.memo(({ data, onSave }: { data: UserData, onSave: (d: Partial<UserData>) => void }) => {
  const [salary, setSalary] = useState(data.salary);
  const [savings, setSavings] = useState(data.savingsGoal);
  const [salaryDay, setSalaryDay] = useState(data.salaryDay);
  const [rollover, setRollover] = useState(data.rolloverBalance);

  const hasChanges = salary !== data.salary || savings !== data.savingsGoal || salaryDay !== data.salaryDay || rollover !== data.rolloverBalance;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => {
            haptic.success();
            onSave({ salary, savingsGoal: savings, salaryDay, rolloverBalance: rollover });
          }}
          disabled={!hasChanges}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest",
            hasChanges ? "bg-primary text-white shadow-lg shadow-primary/20 active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          <Save className="w-3.5 h-3.5" />
          Salva Modifiche
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 blur-[80px] -mr-24 -mt-24" />
          <div className="relative z-10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Quota Giornaliera Prevista</p>
            <h3 className="text-4xl font-display font-black text-primary tracking-tighter">
              {formatCurrency((salary - savings - calculateMonthlyFixedExpenses(data.fixedExpenses)) / getCycleInfo(new Date(), salaryDay).daysInCycle)}
            </h3>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-4 mt-4">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">Disponibilità</p>
              <p className="text-xs font-bold">{formatCurrency(salary - savings)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">Spese Fisse</p>
              <p className="text-xs font-bold text-red-400">-{formatCurrency(calculateMonthlyFixedExpenses(data.fixedExpenses))}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">Giorni Ciclo</p>
              <p className="text-xs font-bold">{getCycleInfo(new Date(), salaryDay).daysInCycle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-primary">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Stipendio</span>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" value={salary} onChange={(e) => setSalary(parseFloat(e.target.value) || 0)} className="w-16 text-right font-black text-slate-900 outline-none bg-transparent text-sm" />
              <span className="text-[9px] font-bold text-slate-300">€</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Risparmio</span>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" value={savings} onChange={(e) => setSavings(parseFloat(e.target.value) || 0)} className="w-16 text-right font-black text-slate-900 outline-none bg-transparent text-sm" />
              <span className="text-[9px] font-bold text-slate-300">€</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Giorno</span>
            </div>
            <select value={salaryDay} onChange={(e) => setSalaryDay(parseInt(e.target.value))} className="font-black text-slate-900 outline-none bg-transparent text-sm cursor-pointer">
              {Array.from({ length: 31 }, (_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
            </select>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-secondary/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-secondary">
                <History className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Rollover</span>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" value={rollover} onChange={(e) => setRollover(parseFloat(e.target.value) || 0)} className="w-16 text-right font-black text-slate-900 outline-none bg-transparent text-sm" />
              <span className="text-[9px] font-bold text-slate-300">€</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const RecurringExpensesView = React.memo(({ data, onSave }: { data: UserData, onSave: (f: FixedExpense[]) => void }) => {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(data.fixedExpenses);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'bimonthly' | 'quarterly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState(data.categories.find(c => c.type === 'expense' || c.type === 'both')?.id || '');

  const addFixed = () => {
    if (!newName || !newAmount) return;
    const updated = [...fixedExpenses, { 
      id: generateId(), 
      name: newName, 
      amount: parseFloat(newAmount),
      frequency,
      startDate: frequency === 'custom' ? startDate : undefined,
      endDate: frequency === 'custom' ? endDate : undefined,
      categoryId
    }];
    setFixedExpenses(updated);
    onSave(updated);
    setNewName('');
    setNewAmount('');
  };

  const removeFixed = (id: string) => {
    const updated = fixedExpenses.filter(f => f.id !== id);
    setFixedExpenses(updated);
    onSave(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {fixedExpenses.map(f => {
            const category = data.categories.find(c => c.id === f.categoryId);
            return (
              <div key={f.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center group hover:border-primary transition-all shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all border border-slate-100">
                    <CategoryIndicator color={category?.color || '#cbd5e1'} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{f.name}</p>
                    <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      <span className="text-primary">{formatCurrency(f.amount)}</span>
                      <span>•</span>
                      <span>{f.frequency === 'custom' ? 'Personalizzata' : f.frequency === 'monthly' ? 'Mensile' : f.frequency === 'bimonthly' ? 'Bimestrale' : 'Trimestrale'}</span>
                      {f.frequency === 'custom' && f.startDate && f.endDate && (
                        <>
                          <span>•</span>
                          <span className="text-blue-500">{format(parseISO(f.startDate), 'MMM yy')} - {format(parseISO(f.endDate), 'MMM yy')}</span>
                        </>
                      )}
                      {category && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => removeFixed(f.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {fixedExpenses.length === 0 && (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 italic font-medium text-xs">
              Nessuna spesa ricorrente aggiunta.
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-fit space-y-4">
          <h3 className="text-[10px] font-display font-black uppercase tracking-widest text-slate-900">Aggiungi Nuova</h3>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nome</span>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-sm" placeholder="es. Affitto" />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Importo</span>
              <div className="relative">
                <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-sm" placeholder="0.00" />
                <span className="absolute right-3 top-2.5 font-black text-slate-300 text-sm">€</span>
              </div>
            </label>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Frequenza</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['monthly', 'bimonthly', 'quarterly', 'custom'] as const).map(f => (
                  <button key={f} onClick={() => setFrequency(f)} className={cn("p-2 rounded-lg border text-[8px] font-bold uppercase tracking-widest transition-all", frequency === f ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-400 bg-slate-50")}>
                    {f === 'monthly' ? 'Mensile' : f === 'bimonthly' ? 'Bimestrale' : f === 'quarterly' ? 'Trimestrale' : 'Pers.'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Categoria</span>
              <div className="flex flex-wrap gap-1.5">
                {data.categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => (
                  <button key={cat.id} onClick={() => setCategoryId(cat.id)} className={cn("px-2.5 py-1.5 rounded-lg border text-[8px] font-bold uppercase tracking-widest transition-all", categoryId === cat.id ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-400 bg-slate-50")}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {frequency === 'custom' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-[8px]">Inizio</span>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-[10px]" 
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-[8px]">Fine</span>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-[10px]" 
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={addFixed} className="w-full h-11 bg-primary text-white rounded-xl font-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Aggiungi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const TransactionsView = React.memo(({ data, onDeleteExpense, onOpenAddModal, onEditExpense }: { 
  data: UserData, 
  onDeleteExpense: (id: string) => void, 
  onOpenAddModal: (mode: 'expense' | 'income', date: string) => void,
  onEditExpense: (expense: Expense) => void
}) => {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [showAutoIncomes, setShowAutoIncomes] = useState(false);
  
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const expensesOnSelectedDate = data.expenses.filter(e => {
    const isSelectedDay = isSameDay(parseISO(e.date), selectedDate);
    if (!isSelectedDay) return false;
    // When hidden, we only show the "Primary" part of split incomes
    if (!showAutoIncomes && e.isAutoSplitIncome && !e.isPrimarySplit) return false;
    return true;
  });

  const dailyTotal = expensesOnSelectedDate.reduce((acc, curr) => {
    // If grouped view and it's a primary split, use the total amount for display aggregation
    const amount = (!showAutoIncomes && curr.isPrimarySplit && curr.totalSplitAmount) 
      ? curr.totalSplitAmount 
      : curr.amount;
    return curr.type === 'income' ? acc + amount : acc - amount;
  }, 0);

  const hiddenIncomesCount = data.expenses.filter(e => 
    isSameDay(parseISO(e.date), selectedDate) && e.isAutoSplitIncome && !e.isPrimarySplit
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <div className="flex justify-end items-center mb-4">
        <div className="flex gap-2">
          <button 
            onClick={() => {
              haptic.light();
              setShowAutoIncomes(!showAutoIncomes);
            }} 
            className={cn(
              "px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 border",
              showAutoIncomes 
                ? "bg-primary/10 text-primary border-primary/20" 
                : "bg-slate-50 text-slate-400 border-slate-100"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-widest">{showAutoIncomes ? 'Nascondi' : 'Mostra'} Quote</span>
          </button>
          <button onClick={() => onOpenAddModal('expense', format(selectedDate, 'yyyy-MM-dd'))} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={() => onOpenAddModal('income', format(selectedDate, 'yyyy-MM-dd'))} className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-100 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        <div className="lg:col-span-4 bg-white p-4 sm:p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-display font-black uppercase tracking-widest text-slate-900">
              {format(selectedDate, 'MMMM yyyy', { locale: it })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="p-2 rotate-180 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <div key={`day-header-${i}`} className="text-center text-[8px] font-black text-slate-300 py-1 uppercase tracking-widest">{d}</div>
            ))}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
            {calendarDays.map(day => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, startOfToday());
              const dayExpensesRaw = data.expenses.filter(e => {
                const isSame = isSameDay(parseISO(e.date), day);
                if (!isSame) return false;
                if (!showAutoIncomes && e.isAutoSplitIncome && !e.isPrimarySplit) return false;
                return true;
              });

              const dayIncomeTotal = dayExpensesRaw.reduce((acc, curr) => {
                if (curr.type !== 'income') return acc;
                const amount = (!showAutoIncomes && curr.isPrimarySplit && curr.totalSplitAmount) 
                  ? curr.totalSplitAmount 
                  : curr.amount;
                return acc + amount;
              }, 0);

              const dayExpenseTotal = dayExpensesRaw.reduce((acc, curr) => {
                if (curr.type !== 'expense') return acc;
                const amount = (!showAutoIncomes && curr.isPrimarySplit && curr.totalSplitAmount) 
                  ? curr.totalSplitAmount 
                  : curr.amount;
                return acc + amount;
              }, 0);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => onOpenAddModal('expense', format(day, 'yyyy-MM-dd'))}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center transition-all relative border p-0.5 overflow-hidden",
                    isSelected 
                      ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-105 z-10" 
                      : isToday 
                        ? "bg-white border-primary/30 text-primary" 
                        : "bg-white border-transparent hover:border-slate-200"
                  )}
                >
                  <span className={cn("text-[10px] sm:text-xs font-bold mb-auto", isSelected ? "text-white" : "text-slate-900")}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-col w-full px-0.5 mt-auto">
                    {dayIncomeTotal > 0 && (
                      <span className={cn(
                        "text-[6px] sm:text-[7px] font-black leading-none mb-0.5 text-center",
                        isSelected ? "text-emerald-200" : "text-emerald-500"
                      )}>
                        +{dayIncomeTotal.toFixed(2)}
                      </span>
                    )}
                    {dayExpenseTotal > 0 && (
                      <span className={cn(
                        "text-[6px] sm:text-[7px] font-black leading-none text-center",
                        isSelected ? "text-red-200" : "text-red-500"
                      )}>
                        -{dayExpenseTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-slate-400 mt-6 text-center italic font-medium">Doppio click per aggiungere una spesa</p>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-50 p-5 sm:p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              {format(selectedDate, 'd MMMM yyyy', { locale: it })}
            </h3>
            <div className={cn(
              "text-3xl font-display font-black tracking-tighter mb-6",
              dailyTotal >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {dailyTotal >= 0 ? '+' : ''}{formatCurrency(dailyTotal)}
            </div>
            
            <div className="space-y-2">
              {expensesOnSelectedDate.map(expense => {
                const category = data.categories.find(c => c.id === expense.categoryId);
                const isIncome = expense.type === 'income';
                return (
                  <div key={expense.id} className="flex justify-between items-center group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 shadow-inner">
                        <CategoryIndicator color={category?.color || '#cbd5e1'} size="md" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {(!showAutoIncomes && expense.isPrimarySplit) 
                            ? expense.name.replace(/ \((Quota )?\d+\/\d+\)$/, '') 
                            : expense.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            {category?.name || 'Altro'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{format(parseISO(expense.date), 'HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-bold",
                          isIncome ? "text-emerald-500" : "text-red-500"
                        )}>
                          {isIncome ? '+' : '-'}{(!showAutoIncomes && expense.isPrimarySplit && expense.totalSplitAmount) 
                            ? expense.totalSplitAmount.toFixed(2) 
                            : expense.amount.toFixed(2)} €
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => onEditExpense(expense)} className="p-1.5 text-slate-300 hover:text-primary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDeleteExpense(expense.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                  </div>
                );
              })}
              {expensesOnSelectedDate.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[10px] text-slate-400 italic font-medium">Nessuna transazione.</p>
                </div>
              )}
              {!showAutoIncomes && hiddenIncomesCount > 0 && (
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter text-center pt-2 border-t border-slate-50 opacity-60">
                  {hiddenIncomesCount} quote entrate nascoste
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const CategoriesView = React.memo(({ data, onSave }: { data: UserData, onSave: (c: Category[]) => void }) => {
  const [categories, setCategories] = useState<Category[]>(data.categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [newType, setNewType] = useState<'expense' | 'income' | 'both'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);

  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#6b7280', '#06b6d4'];

  const addCategory = () => {
    if (!newName) return;
    haptic.success();
    
    let updated: Category[];
    if (editingId) {
      updated = categories.map(c => 
        c.id === editingId 
          ? { ...c, name: newName, color: newColor, type: newType } 
          : c
      );
      setEditingId(null);
    } else {
      updated = [...categories, { id: generateId(), name: newName, color: newColor, icon: 'MoreHorizontal', type: newType }];
    }
    
    setCategories(updated);
    onSave(updated);
    setNewName('');
    setNewColor('#10b981');
    setNewType('expense');
  };

  const startEditing = (cat: Category) => {
    haptic.light();
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewColor(cat.color);
    setNewType(cat.type);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewName('');
    setNewColor('#10b981');
    setNewType('expense');
  };

  const removeCategory = (id: string) => {
    if (categories.length <= 1) return;
    haptic.warning();
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    onSave(updated);
  };

  const expenseCats = categories.filter(c => c.type === 'expense' || c.type === 'both');
  const incomeCats = categories.filter(c => c.type === 'income' || c.type === 'both');

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
              <TrendingDown className="w-3 h-3" /> Uscite
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {expenseCats.map(cat => (
                <div key={cat.id} className={cn(
                  "bg-white p-2.5 rounded-xl border flex items-center justify-between group shadow-sm relative transition-all",
                  editingId === cat.id ? "border-primary ring-1 ring-primary/20" : "border-slate-100"
                )}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <CategoryIndicator color={cat.color} />
                    <span className="text-[10px] font-bold text-slate-900 truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditing(cat)} className="p-1 text-slate-300 hover:text-primary transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeCategory(cat.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Entrate
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {incomeCats.map(cat => (
                <div key={cat.id} className={cn(
                  "bg-white p-2.5 rounded-xl border flex items-center justify-between group shadow-sm relative transition-all",
                  editingId === cat.id ? "border-primary ring-1 ring-primary/20" : "border-slate-100"
                )}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <CategoryIndicator color={cat.color} />
                    <span className="text-[10px] font-bold text-slate-900 truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditing(cat)} className="p-1 text-slate-300 hover:text-primary transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeCategory(cat.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-fit space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-display font-black uppercase tracking-widest text-slate-900">
              {editingId ? 'Modifica Categoria' : 'Nuova Categoria'}
            </h3>
            {editingId && (
              <button onClick={cancelEditing} className="text-[8px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                Annulla
              </button>
            )}
          </div>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nome</span>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-sm" placeholder="es. Spesa" />
            </label>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tipo</span>
              <div className="flex gap-1">
                {(['expense', 'income', 'both'] as const).map(t => (
                  <button key={t} onClick={() => setNewType(t)} className={cn("flex-1 p-2 rounded-lg border text-[8px] font-bold uppercase tracking-widest transition-all", newType === t ? "border-primary bg-primary/5 text-primary" : "border-slate-100 text-slate-400 bg-slate-50")}>
                    {t === 'expense' ? 'Uscita' : t === 'income' ? 'Entrata' : 'Entrambe'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Colore</span>
              <div className="flex flex-wrap gap-1.5">
                {colors.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} className={cn("w-5 h-5 rounded-full border-2 transition-all", newColor === c ? "border-slate-900 scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <button onClick={addCategory} className={cn(
              "w-full h-11 text-white rounded-xl font-bold text-xs shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2",
              editingId ? "bg-slate-900" : "bg-primary"
            )}>
              {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Salva Modifiche' : 'Crea Categoria'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

interface CategoryDetailModalProps {
  categoryId: string | null;
  onClose: () => void;
  data: UserData;
  timeRange: 'cycle' | 'annual';
  selectedDate: Date;
}

const CategoryDetailModal = React.memo(({ categoryId, onClose, data, timeRange, selectedDate }: CategoryDetailModalProps) => {
  const category = useMemo(() => 
    data?.categories?.find(c => c.id === categoryId),
    [data?.categories, categoryId]
  );

  const movements = useMemo(() => {
    if (!categoryId || !data) return { expenses: [], fixed: [] };
    
    try {
      let startDate: Date;
      let endDate: Date;
      if (timeRange === 'cycle') {
        const cycle = getCycleInfo(selectedDate, data.salaryDay);
        startDate = cycle.startDate;
        endDate = cycle.endDate;
      } else {
        startDate = startOfYear(selectedDate);
        endDate = endOfYear(selectedDate);
      }

      const filteredExpenses = (data.expenses || []).filter(e => {
        if (!e || e.categoryId !== categoryId) return false;
        try {
          const expenseDate = parseISO(e.date);
          if (!isValid(expenseDate)) return false;
          return isWithinInterval(expenseDate, { start: startDate, end: endDate });
        } catch (err) {
          return false;
        }
      }).sort((a, b) => {
        try {
          return compareDesc(parseISO(a.date), parseISO(b.date));
        } catch (err) {
          return 0;
        }
      });

      const filteredFixed = (data.fixedExpenses || []).filter(f => f && f.categoryId === categoryId);

      return { expenses: filteredExpenses, fixed: filteredFixed };
    } catch (err) {
      console.error("Error filtering movements:", err);
      return { expenses: [], fixed: [] };
    }
  }, [categoryId, data, timeRange, selectedDate]);

  if (!categoryId || !category) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <CategoryIndicator color={category.color} size="md" />
            <div>
              <h3 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">
                {category.name}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Movimenti nel periodo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-xl text-slate-500 active:scale-95 transition-transform">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <div className="space-y-3">
            {movements.expenses.length === 0 && movements.fixed.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs italic font-medium uppercase tracking-widest">
                Nessun movimento trovato
              </div>
            ) : (
              <>
                {movements.expenses.map(e => {
                  const expenseDate = parseISO(e.date);
                  const dateLabel = isValid(expenseDate) ? format(expenseDate, 'dd MMMM yyyy', { locale: it }) : 'Data non valida';
                  return (
                    <div key={e.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                      <div>
                        <p className="font-bold text-slate-900 text-xs uppercase tracking-tight">{e.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dateLabel}</p>
                      </div>
                      <span className={cn("font-display font-black text-sm", e.type === 'expense' ? "text-red-500" : "text-emerald-500")}>
                        {e.type === 'expense' ? '-' : '+'}{formatCurrency(e.amount)}
                      </span>
                    </div>
                  );
                })}
                
                {movements.fixed.length > 0 && (
                  <p className="text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] pt-4 pb-2 border-t border-slate-100">
                    Uscite Fisse Ricorrenti
                  </p>
                )}
                
                {movements.fixed.map(f => (
                  <div key={f.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 opacity-60">
                    <div>
                      <p className="font-bold text-slate-900 text-xs uppercase tracking-tight">{f.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {f.frequency === 'monthly' ? 'Mensile' : f.frequency === 'bimonthly' ? 'Bimensile' : f.frequency === 'quarterly' ? 'Trimestrale' : 'Personalizzata'}
                      </p>
                    </div>
                    <span className="font-display font-black text-sm text-slate-400">
                      -{formatCurrency(f.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
          <button 
            onClick={onClose}
            className="w-full h-14 bg-slate-900 text-white rounded-[20px] font-display font-black text-lg uppercase tracking-tight active:scale-[0.98] transition-all shadow-lg"
          >
            Chiudi
          </button>
        </div>
      </motion.div>
    </div>
  );
});

const StatsView = React.memo(({ data }: { data: UserData }) => {
  const [timeRange, setTimeRange] = useState<'cycle' | 'annual'>('cycle');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    try {
      const categoryTotals: Record<string, number> = {};
      
      let startDate: Date;
      let endDate: Date;

      if (timeRange === 'cycle') {
        const cycle = getCycleInfo(selectedDate, data.salaryDay);
        startDate = cycle.startDate;
        endDate = cycle.endDate;
      } else {
        startDate = startOfYear(selectedDate);
        endDate = endOfYear(selectedDate);
      }
      
      // Regular expenses
      data.expenses.forEach(e => {
        if (e.type === 'income') return;
        
        const expDate = parseISO(e.date);
        if (isWithinInterval(expDate, { start: startDate, end: endDate })) {
          categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
        }
      });

      // Fixed expenses
      data.fixedExpenses.forEach(f => {
        // Calculate based on recurrence in the range
        // For simplicity in annual view, we iterate months
        if (timeRange === 'annual') {
          for (let m = 0; m < 12; m++) {
            const monthDate = addMonths(startDate, m);
            if (isRecurringInMonth(f, monthDate)) {
              let amount = f.amount;
              if (f.frequency === 'bimonthly') amount /= 2;
              else if (f.frequency === 'quarterly') amount /= 3;
              else if (f.frequency === 'custom' && f.startDate && f.endDate) {
                const s = parseISO(f.startDate);
                const e = parseISO(f.endDate);
                const months = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
                amount /= months;
              }
              categoryTotals[f.categoryId] = (categoryTotals[f.categoryId] || 0) + amount;
            }
          }
        } else {
          // Cycle range
          if (isRecurringInMonth(f, selectedDate)) {
             let amount = f.amount;
             if (f.frequency === 'bimonthly') amount /= 2;
             else if (f.frequency === 'quarterly') amount /= 3;
             else if (f.frequency === 'custom' && f.startDate && f.endDate) {
               const s = parseISO(f.startDate);
               const e = parseISO(f.endDate);
               const months = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
               amount /= months;
             }
             categoryTotals[f.categoryId] = (categoryTotals[f.categoryId] || 0) + amount;
          }
        }
      });

      return data.categories
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          value: categoryTotals[cat.id] || 0,
          color: cat.color
        }))
        .filter(s => s.value > 0);
    } catch (err) {
      console.error("Error calculating stats:", err);
      return [];
    }
  }, [data.expenses, data.fixedExpenses, data.categories, timeRange, data.salaryDay, selectedDate]);

  const annualTrend = useMemo(() => {
    if (timeRange !== 'annual') return [];
    const trend = [];
    const yearStart = startOfYear(selectedDate);
    for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(yearStart, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        let total = 0;
        
        data.expenses.forEach(e => {
            if (e.type === 'income') return;
            const d = parseISO(e.date);
            if (isWithinInterval(d, { start: mStart, end: mEnd })) total += e.amount;
        });

        data.fixedExpenses.forEach(f => {
            if (isRecurringInMonth(f, monthDate)) {
                let amount = f.amount;
                if (f.frequency === 'bimonthly') amount /= 2;
                else if (f.frequency === 'quarterly') amount /= 3;
                else if (f.frequency === 'custom' && f.startDate && f.endDate) {
                    const s = parseISO(f.startDate);
                    const e = parseISO(f.endDate);
                    const months = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
                    amount /= months;
                }
                total += amount;
            }
        });
        trend.push({ name: format(monthDate, 'MMM', { locale: it }), total });
    }
    return trend;
  }, [data.expenses, data.fixedExpenses, selectedDate, timeRange]);

  if (!data.categories || data.categories.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm font-bold text-slate-400 uppercase tracking-widest text-[10px]">
        Configura le categorie per vedere le statistiche
      </div>
    );
  }

  const totalSpent = stats.reduce((acc, curr) => acc + curr.value, 0);
  const avgMonthly = timeRange === 'annual' ? totalSpent / 12 : totalSpent;

  const onPieEnter = (_: any, index: number) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  const prevPeriod = () => {
    if (timeRange === 'cycle') setSelectedDate(subMonths(selectedDate, 1));
    else setSelectedDate(subYears(selectedDate, 1));
  };

  const nextPeriod = () => {
    if (timeRange === 'cycle') setSelectedDate(addMonths(selectedDate, 1));
    else setSelectedDate(addYears(selectedDate, 1));
  };

  const resetPeriod = () => setSelectedDate(new Date());
  const currentCycle = getCycleInfo(selectedDate, data.salaryDay);

  return (
    <div className="flex flex-col gap-8 pb-12 px-1">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-black tracking-tight text-slate-900 uppercase leading-none mb-1">Analisi</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
              Dettaglio {timeRange === 'cycle' ? 'Mensile' : 'Annuale'}
            </p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 shrink-0 overflow-hidden">
          <button 
            onClick={() => { setTimeRange('cycle'); resetPeriod(); }}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              timeRange === 'cycle' 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Mese
          </button>
          <button 
            onClick={() => { setTimeRange('annual'); resetPeriod(); }}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              timeRange === 'annual' 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Anno
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white p-2 rounded-[28px] border border-slate-100 shadow-sm flex items-center justify-between">
        <button 
          onClick={prevPeriod}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <span className="text-md font-display font-black text-slate-900 uppercase tracking-tight">
            {timeRange === 'cycle' 
              ? format(currentCycle.startDate, 'MMMM yyyy', { locale: it })
              : format(selectedDate, 'yyyy')
            }
          </span>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {timeRange === 'cycle'
              ? `${format(currentCycle.startDate, 'd MMM')} - ${format(currentCycle.endDate, 'd MMM')}`
              : `Tutto l'anno ${format(selectedDate, 'yyyy')}`
            }
          </p>
        </div>

        <button 
          onClick={nextPeriod}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-400"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Chart Section - First */}
        <div className="w-full bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col min-h-[380px]">
           <div className="flex items-center justify-end mb-2">
                <div className="flex flex-col items-end">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Speso</p>
                    <p className="text-sm font-display font-black text-slate-900 leading-none">{formatCurrency(totalSpent)}</p>
                </div>
           </div>

           {timeRange === 'annual' ? (
               <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={annualTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                           <ReTooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '10px' }}
                                formatter={(v: number) => [formatCurrency(v), 'Spesa']}
                           />
                           <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={16} />
                       </BarChart>
                   </ResponsiveContainer>
               </div>
           ) : (
               <div className="mt-4 px-1 space-y-4">
                    {stats.sort((a, b) => b.value - a.value).map((s, idx) => {
                        const percentage = totalSpent > 0 ? (s.value / totalSpent) * 100 : 0;
                        return (
                            <motion.div 
                                key={s.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group cursor-pointer"
                                onClick={() => setSelectedCategoryId(s.id)}
                            >
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <div className="flex items-center gap-2">
                                        <CategoryIndicator color={s.color} size="sm" />
                                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">{s.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900">{formatCurrency(s.value)}</span>
                                </div>
                                <div className="relative w-full h-8 bg-slate-50 rounded-xl overflow-hidden border border-slate-100/50 group-hover:border-slate-200 transition-colors">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 1, ease: "circOut" }}
                                        className="h-full rounded-l-xl opacity-20 absolute inset-0"
                                        style={{ backgroundColor: s.color }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-between px-3">
                                        <div className="h-1 rounded-full w-[30%]" style={{ backgroundColor: s.color }} />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            {percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                    {stats.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                            <PieChartIcon className="w-8 h-8 opacity-20" />
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nessuna spesa nel periodo</p>
                        </div>
                    )}
               </div>
           )}
        </div>

        {/* Totals Summary - Second */}
        {timeRange === 'annual' && (
          <div className="flex flex-row gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 hide-scrollbar snap-x snap-mandatory">
              <div className="min-w-[140px] flex-1 bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center snap-start">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Media Mensile</p>
                  <p className="text-2xl font-display font-black text-slate-900 leading-none">{formatCurrency(avgMonthly)}</p>
              </div>
          </div>
        )}
      </div>



      <AnimatePresence mode="wait">
        {selectedCategoryId && (
          <CategoryDetailModal 
            categoryId={selectedCategoryId}
            onClose={() => setSelectedCategoryId(null)}
            data={data}
            timeRange={timeRange}
            selectedDate={selectedDate}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

const ImportExportView = React.memo(({ data, onImport }: { data: UserData, onImport: (d: UserData) => void }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetDoubleConfirm, setShowResetDoubleConfirm] = useState(false);
  const csvInputRef = React.useRef<HTMLInputElement>(null);
  const jsonInputRef = React.useRef<HTMLInputElement>(null);

  const exportFullBackup = async () => {
    haptic.success();
    const backupData = JSON.stringify(data, null, 2);
    const filename = format(new Date(), "'LunaticBudget-BACKUP'-MMMM-yyyy-HH-mm", { locale: it }) + '.json';
    
    try {
      // Try Capacitor Share if on native/mobile
      const canShare = await Share.canShare();
      if (canShare.value) {
        // We write to a temporary file first because Share.share wants a file URL or text
        // For JSON, sometimes text is enough, but a file is better for "Import/Export" feel
        const path = `LunaticBudget_Backup.json`;
        
        await Filesystem.writeFile({
          path,
          data: backupData,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path,
        });

        await Share.share({
          title: 'LunaticBudget Backup',
          text: 'Backup completo dei dati di LunaticBudget',
          url: fileUri.uri,
          dialogTitle: 'Esporta Backup',
        });
        return;
      }
    } catch (err) {
      console.log('Capacitor Share failed, falling back to navigator.share/download', err);
    }

    // Fallback to navigator.share if available (Standard Web)
    if (navigator.share && typeof File !== 'undefined') {
      try {
        const file = new File([backupData], filename, { type: 'application/json' });
        await navigator.share({
          files: [file],
          title: 'LunaticBudget Backup',
          text: 'Backup completo dei dati di LunaticBudget'
        });
        return;
      } catch (err) {
        console.log('navigator.share failed, falling back to download', err);
      }
    }

    // Fallback to download (Standard Web Desktop)
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFullRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptic.medium();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const restoredData = JSON.parse(json);
        
        // Basic validation
        if (!restoredData.salary || !Array.isArray(restoredData.expenses) || !Array.isArray(restoredData.categories)) {
          throw new Error("Formato backup non valido.");
        }

        if (confirm("Sei sicuro di voler ripristinare il backup? Tutti i dati attuali verranno sovrascritti.")) {
          onImport(restoredData);
          setImportStatus({ count: restoredData.expenses.length });
          haptic.success();
        }
      } catch (err) {
        setImportStatus({ count: 0, error: "Errore durante il ripristino del backup." });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const exportToCSV = async () => {
    haptic.success();
    const csvData = data.expenses.map(e => {
      const category = data.categories.find(c => c.id === e.categoryId);
      return {
        Data: format(parseISO(e.date), 'yyyy-MM-dd HH:mm'),
        Descrizione: e.name,
        Importo: e.amount,
        Categoria: category?.name || 'Altro',
        Tipo: e.type || 'expense',
        IsSplit: e.isSplit ? 'Sì' : 'No',
        GiorniDivisione: e.splitDays || '',
        AutoSplit: e.isAutoSplitIncome ? 'Sì' : 'No',
        IsPrimary: e.isPrimarySplit ? 'Sì' : 'No',
        ImportoTotaleSplit: e.totalSplitAmount || '',
        ParentID: e.parentTransactionId || ''
      };
    });

    const csv = Papa.unparse(csvData);
    const filename = format(new Date(), "'LunaticBudget'-MMMM-yyyy-HH-mm", { locale: it }) + '.csv';

    try {
      // Try Capacitor Share if on native/mobile
      const canShare = await Share.canShare();
      if (canShare.value) {
        const path = `LunaticBudget_Export.csv`;
        
        await Filesystem.writeFile({
          path,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path,
        });

        await Share.share({
          title: 'LunaticBudget CSV',
          text: 'Esportazione transazioni LunaticBudget',
          url: fileUri.uri,
          dialogTitle: 'Esporta CSV',
        });
        return;
      }
    } catch (err) {
      console.log('Capacitor Share CSV failed, falling back to navigator.share/download', err);
    }

    if (navigator.share && typeof File !== 'undefined') {
      try {
        const file = new File([csv], filename, { type: 'text/csv' });
        await navigator.share({
          files: [file],
          title: 'LunaticBudget CSV',
          text: 'Esportazione transazioni LunaticBudget'
        });
        return;
      } catch (err) {
        console.log('navigator.share failed, falling back to download', err);
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [importStatus, setImportStatus] = useState<{ count: number, error?: string } | null>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptic.medium();
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase(), // normalize headers
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('CSV Parsing errors:', results.errors);
          setImportStatus({ count: 0, error: "Errore nel formato del file." });
          return;
        }

        // Italian headers mapping
        const headerMap: Record<string, string[]> = {
          date: ['data', 'date', 'giorno', 'day'],
          name: ['descrizione', 'description', 'nome', 'name', 'causale', 'info'],
          amount: ['importo', 'amount', 'valore', 'value', 'quantità', 'total'],
          category: ['categoria', 'category', 'tipo spesa', 'cat'],
          type: ['tipo', 'type', 'movimento', 'direction'],
          // Extended fields for LunaticBudget
          isSplit: ['issplit', 'is_split', 'divisa'],
          splitDays: ['giornidivisione', 'split_days', 'giorni'],
          isAutoSplitIncome: ['autosplit', 'auto_split', 'auto'],
          isPrimarySplit: ['isprimary', 'is_primary', 'primaria'],
          totalSplitAmount: ['importototalesplit', 'total_split_amount', 'totale_split'],
          parentTransactionId: ['parentid', 'parent_id', 'id_padre']
        };

        const findValue = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          const matchedKey = rowKeys.find(k => keys.includes(k.trim().toLowerCase()));
          return matchedKey ? row[matchedKey] : undefined;
        };

        // Check if we actually found the amount column (essential)
        const firstRow = results.data[0];
        if (firstRow) {
          const amountKeyFound = Object.keys(firstRow).some(k => 
            headerMap.amount.includes(k.trim().toLowerCase())
          );
          
          if (!amountKeyFound) {
            // Check if it's a delimiter issue (e.g. semicolon)
            const singleKey = Object.keys(firstRow)[0];
            if (singleKey && (singleKey.includes(';') || singleKey.includes('\t'))) {
              setImportStatus({ count: 0, error: "Formato CSV non riconosciuto (usa la virgola o il punto e virgola)." });
              return;
            }
          }
        }

        const parseDateFlexible = (str: string) => {
          if (!str) return new Date().toISOString();
          
          // Try DD/MM/YYYY or DD-MM-YYYY (Common in Italy)
          const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
          if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1]);
            const month = parseInt(ddmmyyyy[2]) - 1;
            const year = parseInt(ddmmyyyy[3]);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d.toISOString();
          }

          const d = new Date(str);
          if (!isNaN(d.getTime())) return d.toISOString();
          
          try {
            return parseISO(str).toISOString();
          } catch {
            return new Date().toISOString();
          }
        };

        const importedExpenses: Expense[] = results.data
          .map((row: any) => {
            const rawAmount = findValue(row, headerMap.amount);
            if (rawAmount === undefined || rawAmount === null || rawAmount === '') return null;

            // Handle European decimals (1.234,56 -> 1234.56 or 12,34 -> 12.34)
            let cleanAmount = rawAmount.toString().trim();
            
            // Remove currency symbols and spaces
            cleanAmount = cleanAmount.replace(/[€$£\s]/g, '');

            // Handle cases like "1.234,56"
            if (cleanAmount.includes('.') && cleanAmount.includes(',')) {
              if (cleanAmount.indexOf('.') < cleanAmount.indexOf(',')) {
                cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
              } else {
                cleanAmount = cleanAmount.replace(/,/g, '');
              }
            } else {
              cleanAmount = cleanAmount.replace(',', '.');
            }
            
            const amount = Math.abs(parseFloat(cleanAmount)) || 0;
            if (amount === 0) return null;

            const name = findValue(row, headerMap.name) || 'Importato';
            const categoryName = findValue(row, headerMap.category) || '';
            const typeValue = (findValue(row, headerMap.type) || 'expense').toString().toLowerCase();
            const dateStr = findValue(row, headerMap.date);

            const category = data.categories.find(c => 
              c.name.toLowerCase() === categoryName.toString().toLowerCase()
            ) || data.categories[0];

            // Metadata fields
            const isSplitVal = findValue(row, headerMap.isSplit);
            const splitDaysVal = findValue(row, headerMap.splitDays);
            const isAutoSplitVal = findValue(row, headerMap.isAutoSplitIncome);
            const isPrimaryVal = findValue(row, headerMap.isPrimarySplit);
            const totalSplitVal = findValue(row, headerMap.totalSplitAmount);
            const parentIdVal = findValue(row, headerMap.parentTransactionId);
            
            return {
              id: generateId(),
              name: name.toString().substring(0, 50),
              amount,
              date: parseDateFlexible(dateStr?.toString() || ''),
              categoryId: category.id,
              type: (typeValue.includes('entrat') || typeValue.includes('income') || typeValue.includes('guadagno')) 
                ? 'income' : 'expense',
              isSplit: isSplitVal?.toString().toLowerCase().includes('sì') || isSplitVal?.toString().toLowerCase().includes('yes'),
              splitDays: splitDaysVal ? parseInt(splitDaysVal) : undefined,
              isAutoSplitIncome: isAutoSplitVal?.toString().toLowerCase().includes('sì') || isAutoSplitVal?.toString().toLowerCase().includes('yes'),
              isPrimarySplit: isPrimaryVal?.toString().toLowerCase().includes('sì') || isPrimaryVal?.toString().toLowerCase().includes('yes'),
              totalSplitAmount: totalSplitVal ? parseFloat(totalSplitVal) : undefined,
              parentTransactionId: parentIdVal || undefined
            };
          })
          .filter((e): e is Expense => e !== null);

        if (importedExpenses.length > 0) {
          const today = startOfToday();
          let balanceAdjustment = 0;
          
          importedExpenses.forEach(exp => {
            const expDate = parseISO(exp.date);
            if (isSameCycle(expDate, today, data.salaryDay)) {
              if (exp.type === 'expense') balanceAdjustment -= exp.amount;
              else balanceAdjustment += exp.amount;
            }
          });

          onImport({
            ...data,
            expenses: [...data.expenses, ...importedExpenses],
            currentBalance: data.currentBalance + balanceAdjustment
          });
          setImportStatus({ count: importedExpenses.length });
          haptic.success();
        } else {
          setImportStatus({ count: 0, error: "Nessun dato valido trovato." });
          haptic.warning();
        }
      }
    });
    // Reset input
    e.target.value = '';
  };

  const handleReset = () => {
    haptic.error();
    onImport(INITIAL_DATA);
    setShowResetConfirm(false);
    setShowResetDoubleConfirm(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Dati transazioni (CSV)</h3>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">Per fogli di calcolo</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportToCSV} className="h-11 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
              <Download className="w-3.5 h-3.5" /> Esporta
            </button>
            <button 
              onClick={() => csvInputRef.current?.click()}
              className="h-11 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all w-full"
            >
              <Upload className="w-3.5 h-3.5" /> Importa
              <input 
                ref={csvInputRef}
                type="file" 
                accept=".csv" 
                onChange={handleImport} 
                className="hidden" 
              />
            </button>
          </div>
        </div>

        {/* System Backup Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Backup Totale (JSON)</h3>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">Migrazione & Ripristino</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportFullBackup} className="h-11 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <Download className="w-3.5 h-3.5" /> Backup
            </button>
            <button 
              onClick={() => jsonInputRef.current?.click()}
              className="h-11 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Ripristina
              <input 
                ref={jsonInputRef}
                type="file" 
                accept=".json" 
                onChange={handleFullRestore} 
                className="hidden" 
              />
            </button>
          </div>
        </div>

        {/* Reset Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Zona di Pericolo</h3>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">Resetta l'applicazione allo stato iniziale</p>
              </div>
            </div>

            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} className="h-11 px-6 bg-red-50 text-red-500 rounded-xl font-bold text-xs hover:bg-red-100 transition-all">
                Reset App
              </button>
            ) : !showResetDoubleConfirm ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowResetConfirm(false)} className="px-4 h-11 text-xs font-bold text-slate-400 uppercase tracking-widest">Annulla</button>
                <button onClick={() => setShowResetDoubleConfirm(true)} className="px-6 h-11 bg-red-600 text-white rounded-xl font-bold text-xs shadow-sm">
                  Sei sicuro?
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowResetConfirm(false); setShowResetDoubleConfirm(false); }} className="px-4 h-11 text-xs font-bold text-slate-400 uppercase tracking-widest">Annulla</button>
                <button onClick={handleReset} className="px-6 h-11 bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm animate-pulse">
                  RESET DEFINITIVO
                </button>
              </div>
            )}
          </div>
          
          <AnimatePresence>
            {importStatus && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center",
                  importStatus.error ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                )}
              >
                {importStatus.error 
                  ? importStatus.error 
                  : `Operazione completata con successo! (${importStatus.count} elementi)`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

// Reuse existing components with slight updates
function SetupWizard({ initialData, onComplete }: { initialData: UserData, onComplete: (data: UserData) => void }) {
  const [step, setStep] = useState(1);
  const [salary, setSalary] = useState(initialData.salary || 1300);
  const [savings, setSavings] = useState(initialData.savingsGoal || 100);
  const [salaryDay, setSalaryDay] = useState(initialData.salaryDay || 1);
  const [rollover, setRollover] = useState(initialData.rolloverBalance || false);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(initialData.fixedExpenses);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newFixedFreq, setNewFixedFreq] = useState<'monthly' | 'bimonthly' | 'quarterly' | 'custom'>('monthly');
  const [newFixedStartDate, setNewFixedStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newFixedEndDate, setNewFixedEndDate] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'));

  const addFixed = () => {
    if (!newFixedName || !newFixedAmount) return;
    setFixedExpenses([...fixedExpenses, { 
      id: generateId(), 
      name: newFixedName, 
      amount: parseFloat(newFixedAmount),
      frequency: newFixedFreq,
      startDate: newFixedFreq === 'custom' ? newFixedStartDate : undefined,
      endDate: newFixedFreq === 'custom' ? newFixedEndDate : undefined
    }]);
    setNewFixedName('');
    setNewFixedAmount('');
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 p-4 sm:p-8 flex flex-col items-center overscroll-contain">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-full py-12">
        <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full space-y-6"
          >
              <div className="space-y-3 text-center">
                <div className="w-16 h-16 bg-primary rounded-[20px] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-100">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-display font-black tracking-tighter text-slate-900 uppercase">LunaticBudget 👋</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configura il tuo budget mensile</p>
              </div>
              <div className="space-y-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Stipendio Mensile</span>
                  <div className="mt-1 relative">
                    <input 
                      type="number" 
                      value={salary}
                      onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                      className="w-full text-4xl font-display font-black border-b-2 border-slate-100 focus:border-primary outline-none py-2 transition-all bg-transparent text-slate-900"
                      placeholder="0"
                    />
                    <span className="absolute right-0 bottom-3 text-2xl font-black text-slate-200">€</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Obiettivo Risparmio</span>
                  <div className="mt-1 relative">
                    <input 
                      type="number" 
                      value={savings}
                      onChange={(e) => setSavings(parseFloat(e.target.value) || 0)}
                      className="w-full text-4xl font-display font-black border-b-2 border-slate-100 focus:border-primary outline-none py-2 transition-all bg-transparent text-slate-900"
                      placeholder="0"
                    />
                    <span className="absolute right-0 bottom-3 text-2xl font-black text-slate-200">€</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Giorno di Stipendio</span>
                  <div className="mt-1 relative">
                    <input 
                      type="number" 
                      min="1"
                      max="31"
                      value={salaryDay}
                      onChange={(e) => setSalaryDay(parseInt(e.target.value) || 1)}
                      className="w-full text-4xl font-display font-black border-b-2 border-slate-100 focus:border-primary outline-none py-2 transition-all bg-transparent text-slate-900"
                      placeholder="1"
                    />
                    <span className="absolute right-0 bottom-3 text-sm font-black text-slate-200">del mese</span>
                  </div>
                </label>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">Carica residuo</p>
                    <p className="text-[8px] text-slate-400 font-medium uppercase tracking-widest">Somma i soldi avanzati</p>
                  </div>
                  <button 
                    onClick={() => setRollover(!rollover)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative",
                      rollover ? "bg-primary" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                      rollover ? "left-5.5" : "left-0.5"
                    )} />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => {
                  haptic.medium();
                  setStep(2);
                }}
                className="w-full h-14 bg-primary text-white rounded-2xl font-bold text-base shadow-sm active:scale-[0.98] transition-all uppercase tracking-widest"
              >
                Continua
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-6"
            >
              <div className="space-y-1 text-center">
                <h2 className="text-3xl font-display font-black tracking-tighter text-slate-900 uppercase">Spese Fisse</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Affitto, bollette, abbonamenti...</p>
              </div>
              
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                {fixedExpenses.map(f => (
                  <div key={f.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900 text-xs uppercase tracking-tight">{f.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        {f.amount} € / {
                          f.frequency === 'monthly' ? 'mese' : 
                          f.frequency === 'bimonthly' ? '2 mesi' : 
                          f.frequency === 'quarterly' ? '3 mesi' : 
                          `dal ${format(parseISO(f.startDate!), 'dd/MM/yy')} al ${format(parseISO(f.endDate!), 'dd/MM/yy')}`
                        }
                      </p>
                    </div>
                    <button onClick={() => setFixedExpenses(fixedExpenses.filter(x => x.id !== f.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-white rounded-[32px] border border-slate-100 space-y-3 shadow-sm">
                <input 
                  type="text" 
                  placeholder="Nome (es. Affitto)" 
                  value={newFixedName}
                  onChange={(e) => setNewFixedName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:border-primary transition-all font-bold text-slate-900 text-xs"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      placeholder="Importo" 
                      value={newFixedAmount}
                      onChange={(e) => setNewFixedAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:border-primary transition-all font-bold text-slate-900 text-xs"
                    />
                    <span className="absolute right-3 top-3 font-black text-slate-300 text-sm">€</span>
                  </div>
                  <select 
                    value={newFixedFreq}
                    onChange={(e) => setNewFixedFreq(e.target.value as any)}
                    className="bg-slate-50 border border-slate-100 rounded-xl px-2 outline-none focus:border-primary transition-all font-bold text-slate-900 text-[10px] uppercase"
                  >
                    <option value="monthly">Mese</option>
                    <option value="bimonthly">2 Mesi</option>
                    <option value="quarterly">3 Mesi</option>
                    <option value="custom">Pers.</option>
                  </select>
                </div>

                <AnimatePresence>
                  {newFixedFreq === 'custom' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Inizio</span>
                          <input 
                            type="date" 
                            value={newFixedStartDate} 
                            onChange={(e) => setNewFixedStartDate(e.target.value)} 
                            className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-xs" 
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Fine</span>
                          <input 
                            type="date" 
                            value={newFixedEndDate} 
                            onChange={(e) => setNewFixedEndDate(e.target.value)} 
                            className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-xs" 
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={addFixed}
                  className="w-full h-11 bg-slate-900 text-white rounded-xl text-[10px] font-bold shadow-sm active:scale-[0.98] transition-all uppercase"
                >
                  Aggiungi Spesa Ricorrente
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => {
                    haptic.light();
                    setStep(1);
                  }} 
                  className="flex-1 h-14 bg-white border border-slate-100 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                >
                  Indietro
                </button>
                <button 
                  onClick={() => {
                    haptic.success();
                    onComplete({ ...initialData, salary, savingsGoal: savings, salaryDay, rolloverBalance: rollover, fixedExpenses, isConfigured: true });
                  }}
                  className="flex-[2] h-14 bg-primary text-white rounded-2xl font-bold text-base shadow-sm active:scale-[0.98] transition-all uppercase tracking-widest"
                >
                  Inizia ora
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AddTransactionModal({ mode, categories, onClose, onAdd, onEdit, onAddCategory, initialDate, transactionToEdit }: { 
  mode: 'expense' | 'income', 
  categories: Category[], 
  onClose: () => void, 
  onAdd: (name: string, amount: number, catId: string, type: 'expense' | 'income', date: string, isSplit: boolean, splitDays: number, splitStartDateISO?: string) => void, 
  onEdit: (id: string, name: string, amount: number, catId: string, type: 'expense' | 'income', date: string, isSplit: boolean, splitDays: number, splitStartDateISO?: string) => void,
  onAddCategory: (name: string, color: string, icon: string, type: 'expense' | 'income' | 'both') => void, 
  initialDate?: string,
  transactionToEdit?: Expense
}) {
  const isEditing = !!transactionToEdit;
  const [step, setStep] = useState(isEditing ? 2 : 1); // If editing, go straight to details
  const [name, setName] = useState(transactionToEdit?.name || '');
  const [amount, setAmount] = useState(
    transactionToEdit 
      ? (transactionToEdit.isPrimarySplit && transactionToEdit.totalSplitAmount ? transactionToEdit.totalSplitAmount.toString() : transactionToEdit.amount.toString())
      : ''
  );
  const filteredCategories = categories.filter(c => c.type === mode || c.type === 'both');
  const [categoryId, setCategoryId] = useState(transactionToEdit?.categoryId || filteredCategories[0]?.id || '');
  const [date, setDate] = useState(transactionToEdit ? format(parseISO(transactionToEdit.date), 'yyyy-MM-dd') : initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [isSplit, setIsSplit] = useState(transactionToEdit?.isSplit ?? false);
  const [splitType, setSplitType] = useState<'days' | 'range'>('days');
  const [splitStartDate, setSplitStartDate] = useState(transactionToEdit ? format(parseISO(transactionToEdit.date), 'yyyy-MM-dd') : date);
  const [splitDays, setSplitDays] = useState(transactionToEdit?.splitDays?.toString() || '30');
  const [splitEndDate, setSplitEndDate] = useState(() => {
    const startDate = transactionToEdit ? parseISO(transactionToEdit.date) : (initialDate ? parse(initialDate, 'yyyy-MM-dd', new Date()) : new Date());
    const days = transactionToEdit?.splitDays || 30;
    return format(addDays(startDate, days - 1), 'yyyy-MM-dd');
  });
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Sync splitDays and splitEndDate
  useEffect(() => {
    const start = parse(splitStartDate, 'yyyy-MM-dd', new Date());
    if (splitType === 'days') {
      const days = parseInt(splitDays) || 1;
      setSplitEndDate(format(addDays(start, days - 1), 'yyyy-MM-dd'));
    } else {
      const end = parse(splitEndDate, 'yyyy-MM-dd', new Date());
      const diff = Math.max(1, differenceInCalendarDays(end, start) + 1);
      setSplitDays(diff.toString());
    }
  }, [splitStartDate, splitDays, splitEndDate, splitType]);

  const handleKeypadPress = (val: string) => {
    haptic.light();
    if (val === 'back') {
      setAmount(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + '.');
    } else {
      if (amount.includes('.') && amount.split('.')[1].length >= 2) return;
      setAmount(prev => prev + val);
    }
  };

  const handleQuickCategory = () => {
    if (!newCatName) return;
    onAddCategory(newCatName, mode === 'expense' ? '#ef4444' : '#10b981', 'MoreHorizontal', mode);
    setNewCatName('');
    setShowQuickCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    haptic.success();
    const finalName = name || (mode === 'expense' ? 'Spesa generica' : 'Entrata generica');
    const finalAmount = parseFloat(amount);
    const finalDate = parse(date, 'yyyy-MM-dd', new Date()).toISOString();
    const finalSplit = isSplit;
    const finalSplitDays = parseInt(splitDays) || 1;
    const finalSplitStartDate = finalSplit ? parse(splitStartDate, 'yyyy-MM-dd', new Date()).toISOString() : undefined;

    if (isEditing && transactionToEdit) {
      onEdit(transactionToEdit.id, finalName, finalAmount, categoryId, mode, finalDate, finalSplit, finalSplitDays, finalSplitStartDate);
    } else {
      onAdd(finalName, finalAmount, categoryId, mode, finalDate, finalSplit, finalSplitDays, finalSplitStartDate);
    }
  };

  const isExpense = mode === 'expense';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%", scale: 1 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: "100%", scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-auto sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn(
          "p-4 sm:p-5 flex justify-between items-center",
          isExpense ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
        )}>
          <div>
            <h3 className="text-lg font-display font-black tracking-tight uppercase">
              {isEditing ? (isExpense ? 'Modifica Spesa' : 'Modifica Entrata') : (isExpense ? 'Nuova Spesa' : 'Nuova Entrata')}
            </h3>
            <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">{format(parse(date, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy', { locale: it })}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="keypad"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div className="text-center py-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Importo</div>
                  <div className={cn(
                    "text-6xl font-display font-black tracking-tighter flex items-center justify-center gap-2",
                    isExpense ? "text-red-500" : "text-emerald-500"
                  )}>
                    {amount || '0'}<span className="text-2xl text-slate-200">€</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'back'].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num.toString())}
                      className="h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-xl font-bold active:bg-slate-100 active:scale-[0.98] transition-all shadow-sm text-slate-900"
                    >
                      {num === 'back' ? <Delete className="w-5 h-5 text-slate-400" /> : num}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 h-11 bg-slate-100 text-slate-400 rounded-xl font-bold uppercase tracking-widest text-[9px]">Annulla</button>
                  <button 
                    disabled={!amount || parseFloat(amount) <= 0}
                    onClick={() => setStep(2)} 
                    className={cn(
                      "flex-[2] h-11 text-white rounded-xl font-bold text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale uppercase tracking-widest",
                      isExpense ? "bg-red-500" : "bg-emerald-500"
                    )}
                  >
                    Continua
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="details"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4 pb-2"
              >
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Importo</span>
                  <span className={cn("text-xl font-display font-black tracking-tight", isExpense ? "text-red-500" : "text-emerald-500")}>{amount} €</span>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Descrizione</span>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-sm"
                      placeholder={isExpense ? "Cosa hai comprato?" : "Da dove arrivano?"}
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Categoria</span>
                      <button 
                        onClick={() => setShowQuickCategory(!showQuickCategory)}
                        className="text-[8px] font-bold text-primary flex items-center gap-1 uppercase tracking-widest"
                      >
                        <Plus className="w-2 h-2" /> Nuova
                      </button>
                    </div>

                    <AnimatePresence>
                      {showQuickCategory && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex gap-2 p-2 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                            <input 
                              type="text" 
                              value={newCatName}
                              onChange={(e) => setNewCatName(e.target.value)}
                              className="flex-1 bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-primary"
                              placeholder="Nome categoria..."
                            />
                            <button 
                              onClick={handleQuickCategory}
                              className="px-2 py-1.5 bg-primary text-white rounded-lg text-[8px] font-bold uppercase"
                            >
                              OK
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-wrap gap-1">
                      {filteredCategories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryId(cat.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all",
                            categoryId === cat.id 
                              ? (isExpense ? "border-red-500 bg-red-50 text-red-500" : "border-emerald-500 bg-emerald-50 text-emerald-500")
                              : "border-slate-100 text-slate-400 bg-slate-50"
                          )}
                        >
                          <CategoryIndicator color={cat.color} />
                          <span className="text-[8px] font-bold uppercase tracking-widest">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Data</span>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all text-slate-900 text-sm"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 shadow-sm">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-bold text-[10px] text-slate-900 uppercase tracking-widest">Dividi spesa</span>
                      <div className="relative inline-block w-8 h-4 transition duration-200 ease-in">
                        <input 
                          type="checkbox" 
                          checked={isSplit}
                          onChange={(e) => setIsSplit(e.target.checked)}
                          className="opacity-0 w-0 h-0 peer"
                        />
                        <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-slate-200 rounded-full transition-all peer-checked:bg-primary before:content-[''] before:absolute before:h-3 before:w-3 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all peer-checked:before:translate-x-4"></span>
                      </div>
                    </label>

                    <AnimatePresence>
                      {isSplit && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-2"
                        >
                          <div className="pt-2 border-t border-slate-200 space-y-3">
                            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                              <button 
                                type="button"
                                onClick={() => setSplitType('days')}
                                className={cn(
                                  "flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all",
                                  splitType === 'days' ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-50"
                                )}
                              >
                                Giorni
                              </button>
                              <button 
                                type="button"
                                onClick={() => setSplitType('range')}
                                className={cn(
                                  "flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all",
                                  splitType === 'range' ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-50"
                                )}
                              >
                                Intervallo
                              </button>
                            </div>

                            {splitType === 'days' ? (
                              <div className="space-y-3">
                                <label className="block space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest px-1">Dal giorno</span>
                                  <input 
                                    type="date" 
                                    value={splitStartDate}
                                    onChange={(e) => setSplitStartDate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary text-slate-900 text-xs"
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest px-1">Numero di giorni</span>
                                  <input 
                                    type="number" 
                                    value={splitDays}
                                    onChange={(e) => setSplitDays(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary text-slate-900 text-xs"
                                    placeholder="es. 30"
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <label className="block space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest px-1">Dal giorno</span>
                                  <input 
                                    type="date" 
                                    value={splitStartDate}
                                    onChange={(e) => setSplitStartDate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary text-slate-900 text-xs"
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest px-1">Al giorno (compreso)</span>
                                  <input 
                                    type="date" 
                                    value={splitEndDate}
                                    onChange={(e) => setSplitEndDate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-primary text-slate-900 text-xs"
                                  />
                                </label>
                              </div>
                            )}

                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest px-1">
                              La divisione durerà {splitDays} {parseInt(splitDays) === 1 ? 'giorno' : 'giorni'} (dal {format(parse(splitStartDate, 'yyyy-MM-dd', new Date()), 'd MMMM', { locale: it })} al {format(addDays(parse(splitStartDate, 'yyyy-MM-dd', new Date()), parseInt(splitDays) - 1), 'd MMMM', { locale: it })})
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => isEditing ? onClose() : setStep(1)} className="flex-1 h-11 bg-slate-100 text-slate-400 rounded-xl font-bold uppercase tracking-widest text-[9px]">
                    {isEditing ? 'Annulla' : 'Indietro'}
                  </button>
                  <button 
                    onClick={handleSubmit}
                    className={cn(
                      "flex-[2] h-11 text-white rounded-xl font-bold text-xs shadow-sm active:scale-[0.98] transition-all uppercase tracking-widest",
                      isExpense ? "bg-red-500" : "bg-emerald-500"
                    )}
                  >
                    {isEditing ? 'Salva Modifiche' : 'Salva'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
