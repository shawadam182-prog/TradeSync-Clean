import React, { useState, useEffect, useMemo } from 'react';
import { Quote } from '../types';
import { TrendingUp, TrendingDown, Info, PoundSterling, Receipt, Hammer, Calculator } from 'lucide-react';
import { calculateQuoteTotals, CalculationOptions } from '../src/utils/quoteCalculations';
import { supabase } from '../src/lib/supabase';
import { useData } from '../src/contexts/DataContext';

interface JobProfitSummaryProps {
  jobPackId: string;
  quotes: Quote[];
}

interface DBExpense {
  id: string;
  amount: number;
  vat_amount: number;
  category: string;
}

export const JobProfitSummary: React.FC<JobProfitSummaryProps> = ({
  jobPackId,
  quotes,
}) => {
  const { settings } = useData();
  const [expenses, setExpenses] = useState<DBExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  // Fetch expenses for this job pack
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('id, amount, vat_amount, category')
          .eq('job_pack_id', jobPackId);

        if (error) throw error;
        setExpenses(data || []);
      } catch (err) {
        console.error('Failed to fetch expenses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [jobPackId]);

  // Filter quotes linked to this job pack with relevant statuses
  const linkedQuotes = useMemo(() => {
    return quotes.filter(
      q => q.projectId === jobPackId &&
           ['accepted', 'invoiced', 'paid'].includes(q.status)
    );
  }, [quotes, jobPackId]);

  // Calculate totals
  const calculations = useMemo(() => {
    if (linkedQuotes.length === 0) return null;

    const calcOptions: CalculationOptions = {
      enableVat: settings?.enableVat ?? true,
      enableCis: settings?.enableCis ?? false,
      showVat: true,
      showCis: false,
      defaultLabourRate: settings?.defaultLabourRate ?? 35,
    };

    let totalQuoted = 0;
    let totalLabourCost = 0;
    let totalMaterialsCost = 0;

    linkedQuotes.forEach(quote => {
      const displayOptions = quote.displayOptions || {
        showMaterials: true,
        showMaterialItems: true,
        showMaterialQty: true,
        showMaterialUnitPrice: true,
        showMaterialLineTotals: true,
        showMaterialSectionTotal: true,
        showLabour: true,
        showLabourItems: true,
        showLabourQty: true,
        showLabourUnitPrice: true,
        showLabourLineTotals: true,
        showLabourSectionTotal: true,
        showVat: true,
        showCis: false,
        showNotes: true,
        showLogo: true,
        showTotalsBreakdown: true,
      };

      const totals = calculateQuoteTotals(quote, calcOptions, displayOptions);
      totalQuoted += totals.grandTotal;
      totalLabourCost += totals.labourTotal;
      totalMaterialsCost += totals.materialsTotal;
    });

    // Total expenses (amount includes VAT already paid)
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Profit = What we quoted - What we spent
    // Note: Labour is our "cost of time" but represents revenue, not an expense
    // Real profit = Revenue (quoted) - Actual costs (expenses for materials, etc.)
    const profit = totalQuoted - totalExpenses;
    const marginPercent = totalQuoted > 0 ? (profit / totalQuoted) * 100 : 0;

    return {
      totalQuoted,
      totalExpenses,
      totalLabourCost,
      totalMaterialsCost,
      profit,
      marginPercent,
    };
  }, [linkedQuotes, expenses, settings]);

  // Don't render if no linked quotes
  if (linkedQuotes.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-slate-50 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!calculations) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const isPositiveProfit = calculations.profit >= 0;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500 text-white rounded-xl">
            <Calculator size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Job Profit Summary
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {linkedQuotes.length} accepted quote{linkedQuotes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <Info size={16} />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-8 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-xl z-50">
              <p className="font-bold mb-1">How is this calculated?</p>
              <p className="opacity-80 leading-relaxed">
                Profit = Total Quoted - Total Expenses.
                The quoted amount comes from accepted/invoiced/paid quotes.
                Expenses are all costs logged against this job pack.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Profit Display */}
      <div className={`rounded-xl p-4 ${isPositiveProfit ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Net Profit
            </p>
            <p className={`text-2xl md:text-3xl font-black ${isPositiveProfit ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(calculations.profit)}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
            isPositiveProfit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {isPositiveProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-sm font-black">
              {calculations.marginPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <PoundSterling size={14} className="text-emerald-500" />
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Total Quoted
            </p>
          </div>
          <p className="text-lg font-black text-slate-900">
            {formatCurrency(calculations.totalQuoted)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={14} className="text-red-500" />
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Total Expenses
            </p>
          </div>
          <p className="text-lg font-black text-slate-900">
            {formatCurrency(calculations.totalExpenses)}
          </p>
        </div>
      </div>

      {/* Labour & Materials Reference (smaller, informational) */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <Hammer size={12} />
          <span>Labour in quotes:</span>
          <span className="font-bold text-slate-700">{formatCurrency(calculations.totalLabourCost)}</span>
        </div>
        <div>
          <span>Materials in quotes:</span>
          <span className="font-bold text-slate-700 ml-1">{formatCurrency(calculations.totalMaterialsCost)}</span>
        </div>
      </div>
    </div>
  );
};
