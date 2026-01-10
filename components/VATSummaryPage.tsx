import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, PoundSterling,
  Calendar, ChevronDown, Loader2, FileText, Receipt,
  ArrowUpRight, ArrowDownRight, Building2, AlertCircle
} from 'lucide-react';
import { expensesService, quotesService, userSettingsService } from '../src/services/dataService';

interface Expense {
  id: string;
  vendor: string;
  amount: number;
  vat_amount: number;
  expense_date: string;
  category: string;
}

interface Invoice {
  id: string;
  reference_number: number;
  subtotal: number;
  vat: number;
  total: number;
  updated_at: string;
  status: string;
  type: string;
}

interface QuarterSummary {
  quarter: string;
  label: string;
  inputVat: number;
  outputVat: number;
  netVat: number;
  expenseCount: number;
  invoiceCount: number;
}

const VAT_RATE = 0.20; // 20% UK standard rate

const getQuarter = (date: Date): string => {
  const month = date.getMonth();
  const year = date.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
};

const getQuarterLabel = (quarterStr: string): string => {
  const [year, q] = quarterStr.split('-Q');
  const quarterNames: Record<string, string> = {
    '1': 'Jan - Mar',
    '2': 'Apr - Jun',
    '3': 'Jul - Sep',
    '4': 'Oct - Dec',
  };
  return `${quarterNames[q]} ${year}`;
};

export const VATSummaryPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, quoteData, settings] = await Promise.all([
        expensesService.getAll(),
        quotesService.getAll(),
        userSettingsService.get(),
      ]);
      setExpenses(expData || []);
      // Only count paid invoices for VAT
      setInvoices((quoteData || []).filter((q: any) => q.type === 'invoice' && q.status === 'paid'));
      setIsVatRegistered(settings?.is_vat_registered || false);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate quarterly summaries
  const quarterSummaries = useMemo(() => {
    const summaryMap = new Map<string, QuarterSummary>();

    // Process expenses (input VAT)
    expenses.forEach(exp => {
      const quarter = getQuarter(new Date(exp.expense_date));
      const existing = summaryMap.get(quarter) || {
        quarter,
        label: getQuarterLabel(quarter),
        inputVat: 0,
        outputVat: 0,
        netVat: 0,
        expenseCount: 0,
        invoiceCount: 0,
      };
      existing.inputVat += exp.vat_amount || 0;
      existing.expenseCount += 1;
      summaryMap.set(quarter, existing);
    });

    // Process invoices (output VAT)
    invoices.forEach(inv => {
      const quarter = getQuarter(new Date(inv.updated_at));
      const existing = summaryMap.get(quarter) || {
        quarter,
        label: getQuarterLabel(quarter),
        inputVat: 0,
        outputVat: 0,
        netVat: 0,
        expenseCount: 0,
        invoiceCount: 0,
      };
      existing.outputVat += inv.vat || 0;
      existing.invoiceCount += 1;
      summaryMap.set(quarter, existing);
    });

    // Calculate net VAT and sort by quarter
    const summaries = Array.from(summaryMap.values())
      .map(s => ({ ...s, netVat: s.outputVat - s.inputVat }))
      .sort((a, b) => b.quarter.localeCompare(a.quarter));

    return summaries;
  }, [expenses, invoices]);

  // Get available quarters for dropdown
  const availableQuarters = useMemo(() => {
    return ['all', ...quarterSummaries.map(s => s.quarter)];
  }, [quarterSummaries]);

  // Filter data by selected quarter
  const filteredData = useMemo(() => {
    if (selectedQuarter === 'all') {
      return {
        expenses,
        invoices,
        summary: quarterSummaries.reduce(
          (acc, s) => ({
            inputVat: acc.inputVat + s.inputVat,
            outputVat: acc.outputVat + s.outputVat,
            netVat: acc.netVat + s.netVat,
            expenseCount: acc.expenseCount + s.expenseCount,
            invoiceCount: acc.invoiceCount + s.invoiceCount,
          }),
          { inputVat: 0, outputVat: 0, netVat: 0, expenseCount: 0, invoiceCount: 0 }
        ),
      };
    }

    const quarterStart = new Date(selectedQuarter.replace('-Q', '-0') + '-01');
    const quarterNum = parseInt(selectedQuarter.split('Q')[1]);
    quarterStart.setMonth((quarterNum - 1) * 3);
    const quarterEnd = new Date(quarterStart);
    quarterEnd.setMonth(quarterEnd.getMonth() + 3);

    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d >= quarterStart && d < quarterEnd;
    });

    const filteredInvoices = invoices.filter(i => {
      const d = new Date(i.updated_at);
      return d >= quarterStart && d < quarterEnd;
    });

    const inputVat = filteredExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
    const outputVat = filteredInvoices.reduce((sum, i) => sum + (i.vat || 0), 0);

    return {
      expenses: filteredExpenses,
      invoices: filteredInvoices,
      summary: {
        inputVat,
        outputVat,
        netVat: outputVat - inputVat,
        expenseCount: filteredExpenses.length,
        invoiceCount: filteredInvoices.length,
      },
    };
  }, [selectedQuarter, expenses, invoices, quarterSummaries]);

  // Category breakdown for expenses
  const categoryBreakdown = useMemo(() => {
    const categories = new Map<string, { amount: number; vat: number; count: number }>();
    filteredData.expenses.forEach(exp => {
      const cat = exp.category || 'other';
      const existing = categories.get(cat) || { amount: 0, vat: 0, count: 0 };
      existing.amount += exp.amount;
      existing.vat += exp.vat_amount || 0;
      existing.count += 1;
      categories.set(cat, existing);
    });
    return Array.from(categories.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.vat - a.vat);
  }, [filteredData.expenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!isVatRegistered) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="bg-amber-50 rounded-3xl border border-amber-200 p-10">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-3">VAT Registration Required</h2>
          <p className="text-slate-600 mb-6">
            You need to enable VAT registration in Settings to use the VAT Summary features.
          </p>
          <p className="text-sm text-slate-500">
            Go to Settings → Company → Toggle "VAT Registered Business"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">VAT Summary</h1>
          <p className="text-slate-500 text-sm font-medium">Track your VAT position for HMRC returns</p>
        </div>

        {/* Quarter Selector */}
        <div className="relative">
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            {quarterSummaries.map(s => (
              <option key={s.quarter} value={s.quarter}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Input VAT (Reclaimable) */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl border border-emerald-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <ArrowDownRight className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Input VAT</p>
              <p className="text-[10px] text-emerald-500">Reclaimable from purchases</p>
            </div>
          </div>
          <p className="text-4xl font-black text-emerald-700">£{filteredData.summary.inputVat.toFixed(2)}</p>
          <p className="text-sm text-emerald-600 mt-2">{filteredData.summary.expenseCount} expenses</p>
        </div>

        {/* Output VAT (Owed) */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-3xl border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-2xl">
              <ArrowUpRight className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-black text-red-600 uppercase tracking-widest">Output VAT</p>
              <p className="text-[10px] text-red-500">Charged on invoices</p>
            </div>
          </div>
          <p className="text-4xl font-black text-red-700">£{filteredData.summary.outputVat.toFixed(2)}</p>
          <p className="text-sm text-red-600 mt-2">{filteredData.summary.invoiceCount} paid invoices</p>
        </div>

        {/* Net VAT Position */}
        <div className={`rounded-3xl border p-6 ${
          filteredData.summary.netVat >= 0
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${filteredData.summary.netVat >= 0 ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Calculator className={`w-6 h-6 ${filteredData.summary.netVat >= 0 ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${filteredData.summary.netVat >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                {filteredData.summary.netVat >= 0 ? 'VAT to Pay' : 'VAT Refund Due'}
              </p>
              <p className={`text-[10px] ${filteredData.summary.netVat >= 0 ? 'text-amber-500' : 'text-blue-500'}`}>
                Net position for HMRC
              </p>
            </div>
          </div>
          <p className={`text-4xl font-black ${filteredData.summary.netVat >= 0 ? 'text-amber-700' : 'text-blue-700'}`}>
            £{Math.abs(filteredData.summary.netVat).toFixed(2)}
          </p>
          <p className={`text-sm mt-2 ${filteredData.summary.netVat >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
            {filteredData.summary.netVat >= 0 ? 'You owe HMRC' : 'HMRC owes you'}
          </p>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      {selectedQuarter === 'all' && quarterSummaries.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8">
          <h2 className="font-black text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-amber-500" />
            Quarterly Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-3 font-black text-slate-600 text-xs uppercase">Quarter</th>
                  <th className="text-right p-3 font-black text-slate-600 text-xs uppercase">Input VAT</th>
                  <th className="text-right p-3 font-black text-slate-600 text-xs uppercase">Output VAT</th>
                  <th className="text-right p-3 font-black text-slate-600 text-xs uppercase">Net Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quarterSummaries.map(s => (
                  <tr key={s.quarter} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{s.label}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">£{s.inputVat.toFixed(2)}</td>
                    <td className="p-3 text-right text-red-600 font-bold">£{s.outputVat.toFixed(2)}</td>
                    <td className={`p-3 text-right font-black ${s.netVat >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                      {s.netVat >= 0 ? '' : '-'}£{Math.abs(s.netVat).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h2 className="font-black text-slate-900 mb-4 flex items-center gap-2">
            <Receipt size={20} className="text-amber-500" />
            Input VAT by Category
          </h2>
          <div className="space-y-3">
            {categoryBreakdown.map(cat => (
              <div key={cat.category} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="flex-1">
                  <p className="font-bold text-slate-900 capitalize">{cat.category}</p>
                  <p className="text-xs text-slate-500">{cat.count} expenses · £{cat.amount.toFixed(2)} total</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">£{cat.vat.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 uppercase">VAT Reclaimable</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HMRC Notice */}
      <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-xs text-slate-500">
          <strong>Note:</strong> This summary is for reference only. Always verify figures against your official records
          before submitting VAT returns to HMRC. VAT returns are typically due quarterly.
        </p>
      </div>
    </div>
  );
};
