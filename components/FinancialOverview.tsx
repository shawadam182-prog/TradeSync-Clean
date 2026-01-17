import React, { useMemo, useState } from 'react';
import { Quote, AppSettings } from '../types';
import {
  PoundSterling, Calendar, CalendarDays, CalendarRange,
  TrendingUp, TrendingDown, Clock, ChevronDown
} from 'lucide-react';

type RevenuePeriod = 'all_time' | 'tax_year' | 'month' | 'week';

interface FinancialOverviewProps {
  quotes: Quote[];
  settings: AppSettings;
}

interface PeriodOption {
  id: RevenuePeriod;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  quotes,
  settings
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<RevenuePeriod>('month');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const periodOptions: PeriodOption[] = [
    { id: 'all_time', label: 'All Time', shortLabel: 'All', icon: <Clock size={16} /> },
    { id: 'tax_year', label: 'Tax Year', shortLabel: 'Tax Yr', icon: <CalendarRange size={16} /> },
    { id: 'month', label: 'This Month', shortLabel: 'Month', icon: <CalendarDays size={16} /> },
    { id: 'week', label: 'This Week', shortLabel: 'Week', icon: <Calendar size={16} /> },
  ];

  // Calculate quote total helper
  const calculateQuoteTotal = (quote: Quote): number => {
    const sections = quote.sections || [];
    const materialsTotal = sections.reduce((sum, section) =>
      sum + (section.items || []).reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0), 0);
    const labourHoursTotal = sections.reduce((sum, section) => sum + (section.labourHours || 0), 0);
    const labourTotal = labourHoursTotal * (quote.labourRate || 0);
    const subtotal = materialsTotal + labourTotal;
    const markup = subtotal * ((quote.markupPercent || 0) / 100);
    const tax = (subtotal + markup) * ((quote.taxPercent || 0) / 100);
    return subtotal + markup + tax;
  };

  // Get tax year boundaries based on settings
  const getTaxYearBoundaries = () => {
    const now = new Date();
    const taxMonth = (settings.taxYearStartMonth || 4) - 1; // Convert to 0-indexed
    const taxDay = settings.taxYearStartDay || 6;

    // Determine current tax year start
    let taxYearStart = new Date(now.getFullYear(), taxMonth, taxDay);
    if (now < taxYearStart) {
      // We're before the start date this year, so tax year started last year
      taxYearStart = new Date(now.getFullYear() - 1, taxMonth, taxDay);
    }

    // Tax year end is the day before next year's start
    const taxYearEnd = new Date(taxYearStart.getFullYear() + 1, taxMonth, taxDay);

    return { taxYearStart, taxYearEnd };
  };

  // Calculate revenue for different periods
  const revenueData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Week boundaries (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - mondayOffset);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Last week for comparison
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    // Month boundaries
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Tax year boundaries
    const { taxYearStart, taxYearEnd } = getTaxYearBoundaries();

    // Filter paid invoices
    const paidInvoices = quotes.filter(q => q.type === 'invoice' && q.status === 'paid');

    // Helper to check if payment is in date range
    const isInRange = (quote: Quote, start: Date, end?: Date) => {
      const paymentDate = quote.paymentDate ? new Date(quote.paymentDate) : new Date(quote.updatedAt);
      if (end) {
        return paymentDate >= start && paymentDate < end;
      }
      return paymentDate >= start;
    };

    // All time revenue
    const allTimeRevenue = paidInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);
    const allTimeCount = paidInvoices.length;

    // Tax year revenue
    const taxYearInvoices = paidInvoices.filter(inv => isInRange(inv, taxYearStart, taxYearEnd));
    const taxYearRevenue = taxYearInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);
    const taxYearCount = taxYearInvoices.length;

    // This month revenue
    const thisMonthInvoices = paidInvoices.filter(inv => isInRange(inv, startOfMonth));
    const monthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);
    const monthCount = thisMonthInvoices.length;

    // Last month revenue (for trend)
    const lastMonthInvoices = paidInvoices.filter(inv => isInRange(inv, startOfLastMonth, endOfLastMonth));
    const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);

    // This week revenue
    const thisWeekInvoices = paidInvoices.filter(inv => isInRange(inv, startOfWeek, endOfWeek));
    const weekRevenue = thisWeekInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);
    const weekCount = thisWeekInvoices.length;

    // Last week revenue (for trend)
    const lastWeekInvoices = paidInvoices.filter(inv => isInRange(inv, startOfLastWeek, startOfWeek));
    const lastWeekRevenue = lastWeekInvoices.reduce((sum, inv) => sum + calculateQuoteTotal(inv), 0);

    // Calculate trends
    const monthTrend = lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : monthRevenue > 0 ? 100 : 0;

    const weekTrend = lastWeekRevenue > 0
      ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
      : weekRevenue > 0 ? 100 : 0;

    return {
      all_time: { revenue: allTimeRevenue, count: allTimeCount, trend: null },
      tax_year: { revenue: taxYearRevenue, count: taxYearCount, trend: null, label: formatTaxYearLabel(taxYearStart) },
      month: { revenue: monthRevenue, count: monthCount, trend: monthTrend },
      week: { revenue: weekRevenue, count: weekCount, trend: weekTrend },
    };
  }, [quotes, settings.taxYearStartMonth, settings.taxYearStartDay]);

  function formatTaxYearLabel(start: Date): string {
    const endYear = start.getFullYear() + 1;
    return `${start.getFullYear()}/${endYear.toString().slice(-2)}`;
  }

  const formatCurrency = (value: number, compact: boolean = false) => {
    if (compact && value >= 1000) {
      return `£${(value / 1000).toFixed(1)}k`;
    }
    return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const currentData = revenueData[selectedPeriod];
  const selectedOption = periodOptions.find(p => p.id === selectedPeriod)!;

  return (
    <div className="space-y-4">
      {/* Main Revenue Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl shadow-slate-900/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          {/* Header with Period Selector */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-teal-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-1">
                Total Revenue
              </p>
              <div className="flex items-center gap-2">
                <PoundSterling size={28} className="text-teal-500" />
                <span className="text-4xl md:text-5xl font-black tracking-tight">
                  {formatCurrency(currentData.revenue)}
                </span>
              </div>
            </div>

            {/* Period Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2.5 rounded-2xl transition-all border border-white/10"
              >
                {selectedOption.icon}
                <span className="text-sm font-bold hidden sm:inline">{selectedOption.label}</span>
                <span className="text-sm font-bold sm:hidden">{selectedOption.shortLabel}</span>
                <ChevronDown size={16} className={`transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showPeriodDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20 min-w-[160px]">
                    {periodOptions.map(option => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSelectedPeriod(option.id);
                          setShowPeriodDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                          selectedPeriod === option.id
                            ? 'bg-teal-500 text-slate-900'
                            : 'hover:bg-slate-700 text-white'
                        }`}
                      >
                        {option.icon}
                        <span className="text-sm font-bold">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
              <span className="text-[10px] md:text-xs font-bold text-white/60 uppercase tracking-wider">
                Invoices
              </span>
              <span className="text-lg md:text-xl font-black ml-2">{currentData.count}</span>
            </div>

            {currentData.trend !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                currentData.trend >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {currentData.trend >= 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                <span className="text-sm font-black">
                  {currentData.trend >= 0 ? '+' : ''}{currentData.trend}%
                </span>
                <span className="text-xs font-medium opacity-75">
                  vs last {selectedPeriod === 'week' ? 'week' : 'month'}
                </span>
              </div>
            )}

            {selectedPeriod === 'tax_year' && revenueData.tax_year.label && (
              <div className="bg-teal-500/20 backdrop-blur rounded-xl px-4 py-2">
                <span className="text-[10px] md:text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Year
                </span>
                <span className="text-base md:text-lg font-black ml-2 text-teal-300">
                  {revenueData.tax_year.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Period Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {periodOptions.map(option => {
          const data = revenueData[option.id];
          const isSelected = selectedPeriod === option.id;

          return (
            <button
              key={option.id}
              onClick={() => setSelectedPeriod(option.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                  : 'bg-white border-slate-100 hover:border-slate-300 text-slate-900'
              }`}
            >
              <div className={`flex items-center gap-2 mb-2 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`}>
                {option.icon}
                <span className="text-[10px] font-black uppercase tracking-wider">{option.shortLabel}</span>
              </div>
              <p className={`text-lg md:text-xl font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                {formatCurrency(data.revenue, true)}
              </p>
              <p className={`text-[10px] font-bold ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                {data.count} invoice{data.count !== 1 ? 's' : ''}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
