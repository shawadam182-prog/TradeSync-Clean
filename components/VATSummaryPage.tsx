import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, PoundSterling,
  Calendar, ChevronDown, Loader2, FileText, Receipt,
  ArrowUpRight, ArrowDownRight, Building2, AlertCircle,
  Download, Car, Clock, CheckCircle, Info, Percent
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
  deadline: Date;
  isSubmitted?: boolean;
}

// Flat Rate Scheme percentages by business type
const FRS_RATES: Record<string, { rate: number; label: string }> = {
  'general_building': { rate: 9.5, label: 'General building/construction' },
  'labour_only': { rate: 14.5, label: 'Labour-only building services' },
  'electrical': { rate: 10.5, label: 'Electrical/plumbing services' },
  'architect': { rate: 14.5, label: 'Architect/surveying' },
  'other': { rate: 12.0, label: 'Other services' },
};

const VAT_RATE = 0.20; // 20% UK standard rate
const MILEAGE_RATE = 0.45; // HMRC approved mileage rate
const FUEL_VAT_PER_MILE = 0.02; // Approximate recoverable VAT on fuel

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

const getQuarterDeadline = (quarterStr: string): Date => {
  const [year, q] = quarterStr.split('-Q');
  const quarterNum = parseInt(q);
  // Deadline is 1 month and 7 days after quarter end
  const deadlineMonth = quarterNum * 3 + 1; // Month after quarter end
  const deadlineYear = deadlineMonth > 12 ? parseInt(year) + 1 : parseInt(year);
  const adjustedMonth = deadlineMonth > 12 ? deadlineMonth - 12 : deadlineMonth;
  return new Date(deadlineYear, adjustedMonth - 1, 7);
};

export const VATSummaryPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string | 'all'>('all');
  const [vatScheme, setVatScheme] = useState<'standard' | 'flat_rate'>('standard');
  const [frsBusinessType, setFrsBusinessType] = useState('general_building');
  const [showMileageCalc, setShowMileageCalc] = useState(false);
  const [businessMiles, setBusinessMiles] = useState('');

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
        deadline: getQuarterDeadline(quarter),
      };
      existing.inputVat += exp.vat_amount || 0;
      existing.expenseCount += 1;
      summaryMap.set(quarter, existing);
    });

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
        deadline: getQuarterDeadline(quarter),
      };
      existing.outputVat += inv.vat || 0;
      existing.invoiceCount += 1;
      summaryMap.set(quarter, existing);
    });

    const summaries = Array.from(summaryMap.values())
      .map(s => ({ ...s, netVat: s.outputVat - s.inputVat }))
      .sort((a, b) => b.quarter.localeCompare(a.quarter));

    return summaries;
  }, [expenses, invoices]);

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
            grossSales: acc.grossSales,
          }),
          { inputVat: 0, outputVat: 0, netVat: 0, expenseCount: 0, invoiceCount: 0, grossSales: 0 }
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
    const grossSales = filteredInvoices.reduce((sum, i) => sum + i.total, 0);

    return {
      expenses: filteredExpenses,
      invoices: filteredInvoices,
      summary: {
        inputVat,
        outputVat,
        netVat: outputVat - inputVat,
        expenseCount: filteredExpenses.length,
        invoiceCount: filteredInvoices.length,
        grossSales,
      },
    };
  }, [selectedQuarter, expenses, invoices, quarterSummaries]);

  // Flat Rate Scheme calculation
  const frsCalculation = useMemo(() => {
    const rate = FRS_RATES[frsBusinessType]?.rate || 12.0;
    const grossSales = invoices.reduce((sum, i) => sum + i.total, 0);
    const vatDue = grossSales * (rate / 100);
    const keepAmount = filteredData.summary.outputVat - vatDue;
    return { rate, grossSales, vatDue, keepAmount };
  }, [invoices, frsBusinessType, filteredData.summary.outputVat]);

  // Mileage VAT calculation
  const mileageVat = useMemo(() => {
    const miles = parseFloat(businessMiles) || 0;
    return miles * FUEL_VAT_PER_MILE;
  }, [businessMiles]);

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

  // Export VAT report
  const handleExportReport = () => {
    const report = {
      period: selectedQuarter === 'all' ? 'All Time' : getQuarterLabel(selectedQuarter),
      generated: new Date().toISOString(),
      scheme: vatScheme === 'flat_rate' ? `Flat Rate (${FRS_RATES[frsBusinessType]?.rate}%)` : 'Standard VAT',
      summary: {
        box1_vatDueSales: filteredData.summary.outputVat.toFixed(2),
        box2_vatDueAcquisitions: '0.00',
        box3_totalVatDue: filteredData.summary.outputVat.toFixed(2),
        box4_vatReclaimedInputs: vatScheme === 'standard' ? filteredData.summary.inputVat.toFixed(2) : '0.00',
        box5_netVatPayable: vatScheme === 'standard'
          ? filteredData.summary.netVat.toFixed(2)
          : frsCalculation.vatDue.toFixed(2),
        box6_totalSalesExVat: (invoices.reduce((sum, i) => sum + i.subtotal, 0)).toFixed(2),
        box7_totalPurchasesExVat: (expenses.reduce((sum, e) => sum + e.amount, 0)).toFixed(2),
        box8_totalGoodsSuppliedEU: '0.00',
        box9_totalGoodsAcquiredEU: '0.00',
      },
      expenses: filteredData.expenses.map(e => ({
        date: e.expense_date,
        vendor: e.vendor,
        amount: e.amount,
        vat: e.vat_amount,
        category: e.category,
      })),
      invoices: filteredData.invoices.map(i => ({
        number: i.reference_number,
        date: i.updated_at,
        subtotal: i.subtotal,
        vat: i.vat,
        total: i.total,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-report-${selectedQuarter === 'all' ? 'all' : selectedQuarter}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upcoming deadline
  const upcomingDeadline = useMemo(() => {
    const now = new Date();
    return quarterSummaries.find(s => s.deadline > now);
  }, [quarterSummaries]);

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

        <div className="flex flex-wrap gap-3">
          {/* VAT Scheme Toggle */}
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setVatScheme('standard')}
              className={`px-4 py-2 text-xs font-bold ${vatScheme === 'standard' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              Standard
            </button>
            <button
              onClick={() => setVatScheme('flat_rate')}
              className={`px-4 py-2 text-xs font-bold ${vatScheme === 'flat_rate' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              Flat Rate
            </button>
          </div>

          {/* Quarter Selector */}
          <div className="relative">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              {quarterSummaries.map(s => (
                <option key={s.quarter} value={s.quarter}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          </div>

          {/* Export */}
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 bg-amber-500 text-slate-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-amber-400 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Upcoming Deadline Alert */}
      {upcomingDeadline && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-blue-900">Next VAT Return Deadline</p>
            <p className="text-sm text-blue-700">
              {upcomingDeadline.label} - Due by {upcomingDeadline.deadline.toLocaleDateString()}
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
            {Math.ceil((upcomingDeadline.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
          </span>
        </div>
      )}

      {/* Flat Rate Scheme Selector */}
      {vatScheme === 'flat_rate' && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Percent className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-purple-900">Flat Rate Scheme Business Type</span>
          </div>
          <select
            value={frsBusinessType}
            onChange={(e) => setFrsBusinessType(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-purple-200 rounded-xl text-sm bg-white"
          >
            {Object.entries(FRS_RATES).map(([key, { rate, label }]) => (
              <option key={key} value={key}>{label} ({rate}%)</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {vatScheme === 'standard' ? (
          <>
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
          </>
        ) : (
          <>
            {/* Flat Rate - Gross Sales */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-slate-200 rounded-2xl">
                  <PoundSterling className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Gross Sales</p>
                  <p className="text-[10px] text-slate-500">Total invoiced (inc. VAT)</p>
                </div>
              </div>
              <p className="text-4xl font-black text-slate-700">£{frsCalculation.grossSales.toFixed(2)}</p>
            </div>

            {/* Flat Rate - VAT Due */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-3xl border border-purple-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-2xl">
                  <Percent className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-purple-600 uppercase tracking-widest">FRS VAT Due</p>
                  <p className="text-[10px] text-purple-500">{frsCalculation.rate}% of gross sales</p>
                </div>
              </div>
              <p className="text-4xl font-black text-purple-700">£{frsCalculation.vatDue.toFixed(2)}</p>
            </div>

            {/* Flat Rate - You Keep */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl border border-emerald-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-100 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">You Keep</p>
                  <p className="text-[10px] text-emerald-500">Difference vs standard VAT</p>
                </div>
              </div>
              <p className="text-4xl font-black text-emerald-700">£{frsCalculation.keepAmount.toFixed(2)}</p>
              <p className="text-sm text-emerald-600 mt-2">Extra profit from FRS</p>
            </div>
          </>
        )}
      </div>

      {/* Mileage VAT Calculator */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8">
        <button
          onClick={() => setShowMileageCalc(!showMileageCalc)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-amber-500" />
            <span className="font-black text-slate-900">Mileage VAT Calculator</span>
          </div>
          <ChevronDown className={`text-slate-400 transition-transform ${showMileageCalc ? 'rotate-180' : ''}`} size={20} />
        </button>

        {showMileageCalc && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-4">
              Calculate VAT you can reclaim on fuel for business miles (approx 2p per mile)
            </p>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 block mb-2">Business Miles This Quarter</label>
                <input
                  type="number"
                  value={businessMiles}
                  onChange={(e) => setBusinessMiles(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="flex-1 p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs font-bold text-emerald-600 mb-1">Reclaimable Fuel VAT</p>
                <p className="text-2xl font-black text-emerald-700">£{mileageVat.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              <Info size={12} className="inline mr-1" />
              Keep fuel receipts and mileage log as evidence for HMRC
            </p>
          </div>
        )}
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
                  <th className="text-right p-3 font-black text-slate-600 text-xs uppercase">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quarterSummaries.map(s => {
                  const isPastDeadline = s.deadline < new Date();
                  return (
                    <tr key={s.quarter} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{s.label}</td>
                      <td className="p-3 text-right text-emerald-600 font-bold">£{s.inputVat.toFixed(2)}</td>
                      <td className="p-3 text-right text-red-600 font-bold">£{s.outputVat.toFixed(2)}</td>
                      <td className={`p-3 text-right font-black ${s.netVat >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                        {s.netVat >= 0 ? '' : '-'}£{Math.abs(s.netVat).toFixed(2)}
                      </td>
                      <td className={`p-3 text-right text-xs ${isPastDeadline ? 'text-slate-400' : 'text-slate-600'}`}>
                        {s.deadline.toLocaleDateString()}
                        {isPastDeadline && <CheckCircle size={12} className="inline ml-1 text-emerald-500" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && vatScheme === 'standard' && (
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
          <strong>Making Tax Digital (MTD):</strong> If your taxable turnover exceeds £85,000, you must submit VAT returns
          digitally through MTD-compatible software. This summary can be exported and used as a reference for your submissions.
          Always verify figures against your official records before submitting to HMRC.
        </p>
      </div>
    </div>
  );
};
