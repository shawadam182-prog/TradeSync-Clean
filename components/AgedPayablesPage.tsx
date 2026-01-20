import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, AlertTriangle, Clock, Check, Calendar, PoundSterling,
  Loader2, X, Building2, FileText, ChevronDown, ChevronUp, Trash2, Edit2,
  CheckCircle, AlertCircle, RefreshCw, ArrowLeft, Download, Users,
  TrendingUp, Ban, DollarSign
} from 'lucide-react';
import { payablesService, vendorsService, Payable } from '../src/services/dataService';
import { ExpensesListSkeleton } from './Skeletons';
import { useToast } from '../src/contexts/ToastContext';
import { handleApiError } from '../src/utils/errorHandler';

interface Vendor {
  id: string;
  name: string;
  default_category?: string | null;
}

type AgingBucket = 'all' | 'comfortable' | 'due_soon' | 'overdue' | 'critical' | 'disputed';
type SortField = 'due_date' | 'amount' | 'vendor';
type SortDirection = 'asc' | 'desc';

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-slate-100 text-slate-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  disputed: { label: 'Disputed', color: 'bg-purple-100 text-purple-700', icon: Ban },
};

const CATEGORIES = [
  { id: 'materials', label: 'Materials' },
  { id: 'tools', label: 'Tools' },
  { id: 'subcontractor', label: 'Subcontractor' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'office', label: 'Office' },
  { id: 'other', label: 'Other' },
];

interface VendorSummary {
  vendorName: string;
  totalOwed: number;
  billCount: number;
  oldestDueDays: number;
}

interface CashFlowWeek {
  label: string;
  amount: number;
  billCount: number;
}

interface AgedPayablesPageProps {
  onBack?: () => void;
}

// Calculate days until due (negative if overdue)
const getDaysUntilDue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// Get aging bucket based on days until due
const getAgingBucket = (daysUntilDue: number | null, status: string): AgingBucket => {
  if (status === 'disputed') return 'disputed';
  if (daysUntilDue === null) return 'comfortable'; // No due date = comfortable
  if (daysUntilDue < -30) return 'critical';
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'due_soon';
  return 'comfortable';
};

// Get bucket colors
const getBucketColors = (bucket: AgingBucket) => {
  switch (bucket) {
    case 'comfortable':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'due_soon':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'overdue':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'critical':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'disputed':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  }
};

export const AgedPayablesPage: React.FC<AgedPayablesPageProps> = ({ onBack }) => {
  const toast = useToast();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<AgingBucket>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vendor_name: '',
    invoice_number: '',
    description: '',
    amount: '',
    vat_amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    category: 'materials',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payablesData, vendorsData] = await Promise.all([
        payablesService.getAll(),
        vendorsService.getAll().catch(() => []),
      ]);
      setPayables(payablesData || []);
      setVendors(vendorsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Outstanding payables (not paid)
  const outstandingPayables = useMemo(() => {
    return payables.filter(p => p.status !== 'paid');
  }, [payables]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const dueSoon = outstandingPayables.filter(p => {
      const days = getDaysUntilDue(p.due_date);
      return days !== null && days >= 0 && days <= 7 && p.status !== 'disputed';
    });
    const overdue = outstandingPayables.filter(p => {
      const days = getDaysUntilDue(p.due_date);
      return days !== null && days < 0 && p.status !== 'disputed';
    });
    const disputed = outstandingPayables.filter(p => p.status === 'disputed');

    return {
      total: {
        count: outstandingPayables.length,
        amount: outstandingPayables.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0)
      },
      dueSoon: {
        count: dueSoon.length,
        amount: dueSoon.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0)
      },
      overdue: {
        count: overdue.length,
        amount: overdue.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0)
      },
      disputed: {
        count: disputed.length,
        amount: disputed.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0)
      }
    };
  }, [outstandingPayables]);

  // Cash flow forecast by week
  const cashFlowForecast = useMemo((): CashFlowWeek[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const thisWeekEnd = new Date(now);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

    const nextWeekEnd = new Date(thisWeekEnd);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const twoWeeksEnd = new Date(nextWeekEnd);
    twoWeeksEnd.setDate(twoWeeksEnd.getDate() + 7);

    const thirtyDaysEnd = new Date(now);
    thirtyDaysEnd.setDate(thirtyDaysEnd.getDate() + 30);

    const nonDisputedPayables = outstandingPayables.filter(p => p.status !== 'disputed' && p.due_date);

    const thisWeek = nonDisputedPayables.filter(p => {
      const due = new Date(p.due_date!);
      return due >= now && due < thisWeekEnd;
    });

    const nextWeek = nonDisputedPayables.filter(p => {
      const due = new Date(p.due_date!);
      return due >= thisWeekEnd && due < nextWeekEnd;
    });

    const twoWeeks = nonDisputedPayables.filter(p => {
      const due = new Date(p.due_date!);
      return due >= nextWeekEnd && due < twoWeeksEnd;
    });

    const thirtyDays = nonDisputedPayables.filter(p => {
      const due = new Date(p.due_date!);
      return due >= now && due < thirtyDaysEnd;
    });

    return [
      { label: 'This Week', amount: thisWeek.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0), billCount: thisWeek.length },
      { label: 'Next Week', amount: nextWeek.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0), billCount: nextWeek.length },
      { label: 'In 2 Weeks', amount: twoWeeks.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0), billCount: twoWeeks.length },
      { label: 'Next 30 Days', amount: thirtyDays.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0), billCount: thirtyDays.length },
    ];
  }, [outstandingPayables]);

  // Vendor summary
  const vendorSummaries = useMemo((): VendorSummary[] => {
    const summaryMap = new Map<string, VendorSummary>();

    outstandingPayables.forEach(p => {
      const existing = summaryMap.get(p.vendor_name);
      const remaining = p.amount - p.amount_paid;
      const daysUntilDue = getDaysUntilDue(p.due_date);

      if (existing) {
        existing.totalOwed += remaining;
        existing.billCount += 1;
        if (daysUntilDue !== null) {
          existing.oldestDueDays = Math.min(existing.oldestDueDays, daysUntilDue);
        }
      } else {
        summaryMap.set(p.vendor_name, {
          vendorName: p.vendor_name,
          totalOwed: remaining,
          billCount: 1,
          oldestDueDays: daysUntilDue ?? 999
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  }, [outstandingPayables]);

  // Unique vendors for filter
  const uniqueVendors = useMemo(() => {
    return [...new Set(outstandingPayables.map(p => p.vendor_name))].sort();
  }, [outstandingPayables]);

  // Unique categories for filter
  const uniqueCategories = useMemo(() => {
    return [...new Set(outstandingPayables.map(p => p.category))].sort();
  }, [outstandingPayables]);

  // Filtered and sorted payables
  const filteredPayables = useMemo(() => {
    let filtered = [...outstandingPayables];

    // Apply bucket filter
    if (activeBucket !== 'all') {
      filtered = filtered.filter(p => {
        const daysUntilDue = getDaysUntilDue(p.due_date);
        const bucket = getAgingBucket(daysUntilDue, p.status);
        return bucket === activeBucket;
      });
    }

    // Apply vendor filter
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(p => p.vendor_name === vendorFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.vendor_name.toLowerCase().includes(search) ||
        p.invoice_number?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'due_date':
          const aDays = getDaysUntilDue(a.due_date) ?? 999;
          const bDays = getDaysUntilDue(b.due_date) ?? 999;
          comparison = aDays - bDays;
          break;
        case 'amount':
          comparison = (a.amount - a.amount_paid) - (b.amount - b.amount_paid);
          break;
        case 'vendor':
          comparison = a.vendor_name.localeCompare(b.vendor_name);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [outstandingPayables, activeBucket, vendorFilter, categoryFilter, searchTerm, sortField, sortDirection]);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_name: '',
      invoice_number: '',
      description: '',
      amount: '',
      vat_amount: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      category: 'materials',
      notes: '',
    });
    setEditingPayable(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (payable: Payable) => {
    setFormData({
      vendor_name: payable.vendor_name,
      invoice_number: payable.invoice_number || '',
      description: payable.description || '',
      amount: payable.amount.toString(),
      vat_amount: payable.vat_amount?.toString() || '',
      invoice_date: payable.invoice_date,
      due_date: payable.due_date || '',
      category: payable.category,
      notes: payable.notes || '',
    });
    setEditingPayable(payable);
    setShowAddModal(true);
  };

  const openPaymentModal = (payable: Payable) => {
    setPayingPayable(payable);
    setPaymentAmount((payable.amount - payable.amount_paid).toFixed(2));
    setShowPaymentModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.amount) return;

    setProcessing('form');
    try {
      const payableData = {
        vendor_name: formData.vendor_name,
        invoice_number: formData.invoice_number || undefined,
        description: formData.description || undefined,
        amount: parseFloat(formData.amount),
        vat_amount: formData.vat_amount ? parseFloat(formData.vat_amount) : 0,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || undefined,
        category: formData.category,
        notes: formData.notes || undefined,
      };

      if (editingPayable) {
        await payablesService.update(editingPayable.id, payableData);
        toast.success('Bill Updated', 'Changes saved successfully');
      } else {
        await payablesService.create(payableData);
        toast.success('Bill Added', `£${formData.amount} bill from ${formData.vendor_name}`);
      }

      setShowAddModal(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      const { message } = handleApiError(error);
      toast.error('Save Failed', message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingPayable || !paymentAmount) return;

    setProcessing(payingPayable.id);
    try {
      const amount = parseFloat(paymentAmount);
      const newAmountPaid = payingPayable.amount_paid + amount;
      const newStatus = newAmountPaid >= payingPayable.amount ? 'paid' : 'partial';

      await payablesService.update(payingPayable.id, {
        amount_paid: newAmountPaid,
        status: newStatus,
        paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
      });

      toast.success('Payment Recorded', `£${amount.toFixed(2)} payment to ${payingPayable.vendor_name}`);
      setShowPaymentModal(false);
      setPayingPayable(null);
      await loadData();
    } catch (error) {
      console.error('Failed to record payment:', error);
      const { message } = handleApiError(error);
      toast.error('Payment Failed', message);
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setProcessing(id);
    try {
      await payablesService.markPaid(id);
      await loadData();
      toast.success('Marked as Paid', 'Bill payment recorded');
    } catch (error) {
      console.error('Failed to mark paid:', error);
      const { message } = handleApiError(error);
      toast.error('Update Failed', message);
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkDisputed = async (payable: Payable) => {
    setProcessing(payable.id);
    try {
      await payablesService.update(payable.id, { status: 'disputed' });
      await loadData();
      toast.info('Marked as Disputed', `${payable.vendor_name} bill flagged for review`);
    } catch (error) {
      console.error('Failed to mark disputed:', error);
      const { message } = handleApiError(error);
      toast.error('Update Failed', message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill?')) return;
    setProcessing(id);
    try {
      await payablesService.delete(id);
      await loadData();
      toast.success('Bill Deleted', 'Bill removed successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      const { message } = handleApiError(error);
      toast.error('Delete Failed', message);
    } finally {
      setProcessing(null);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Vendor', 'Invoice #', 'Date', 'Due Date', 'Amount', 'Paid', 'Remaining', 'Status', 'Category', 'Days Until Due'];

    const rows = filteredPayables.map(p => {
      const daysUntilDue = getDaysUntilDue(p.due_date);
      return [
        p.vendor_name,
        p.invoice_number || '',
        p.invoice_date,
        p.due_date || '',
        p.amount.toFixed(2),
        p.amount_paid.toFixed(2),
        (p.amount - p.amount_paid).toFixed(2),
        p.status,
        p.category,
        daysUntilDue !== null ? daysUntilDue.toString() : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aged_payables_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Export Complete', 'CSV file downloaded');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format days until due
  const formatDaysUntilDue = (days: number | null): string => {
    if (days === null) return 'No due date';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days > 0) return `Due in ${days} days`;
    if (days === -1) return '1 day overdue';
    return `${Math.abs(days)} days overdue`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4 md:mb-8">
          <div className="space-y-2">
            <div className="skeleton h-8 w-32 rounded-lg" />
            <div className="skeleton h-4 w-48 rounded-lg" />
          </div>
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
        <ExpensesListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 md:p-2 -ml-1 md:-ml-2 text-slate-500 hover:text-slate-700 bg-slate-100 md:bg-transparent hover:bg-slate-200 md:hover:bg-slate-100 rounded-xl transition-colors active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft size={22} className="md:w-5 md:h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Aged Payables</h1>
            <p className="text-slate-500 text-sm font-medium italic">Bills to pay by age</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            <Download size={16} />
            <span className="hidden md:inline">Export</span>
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-amber-500 text-slate-900 px-5 py-2 rounded-xl font-black text-sm hover:bg-amber-400 transition-colors"
          >
            <Plus size={18} />
            Add Bill
          </button>
        </div>
      </div>

      {/* Critical Overdue Alert */}
      {summaryStats.overdue.count > 0 && (
        <div className="mb-6 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="animate-pulse" size={24} />
            <div>
              <p className="font-black">Overdue Bills Need Attention</p>
              <p className="text-red-100 text-sm">{summaryStats.overdue.count} bill{summaryStats.overdue.count !== 1 ? 's' : ''} past due date</p>
            </div>
          </div>
          <p className="text-2xl font-black">{formatCurrency(summaryStats.overdue.amount)}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <button
          onClick={() => setActiveBucket('all')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === 'all' ? 'border-slate-900 shadow-lg' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Owed</p>
          <p className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(summaryStats.total.amount)}</p>
          <p className="text-xs text-slate-500">{summaryStats.total.count} bill{summaryStats.total.count !== 1 ? 's' : ''}</p>
        </button>

        <button
          onClick={() => setActiveBucket('due_soon')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === 'due_soon' ? 'border-amber-500 shadow-lg shadow-amber-500/10' : 'border-slate-100 hover:border-amber-200'
          }`}
        >
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">Due Soon</p>
          <p className="text-xl md:text-2xl font-black text-amber-700">{formatCurrency(summaryStats.dueSoon.amount)}</p>
          <p className="text-xs text-slate-500">Due &lt;7 days</p>
        </button>

        <button
          onClick={() => setActiveBucket('overdue')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === 'overdue' ? 'border-red-500 shadow-lg shadow-red-500/10' : 'border-slate-100 hover:border-red-200'
          }`}
        >
          <p className="text-[10px] font-black text-red-600 uppercase tracking-wider mb-1">Overdue</p>
          <p className="text-xl md:text-2xl font-black text-red-700">{formatCurrency(summaryStats.overdue.amount)}</p>
          <p className="text-xs text-slate-500">Past due</p>
        </button>

        <button
          onClick={() => setActiveBucket('disputed')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === 'disputed' ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-100 hover:border-purple-200'
          }`}
        >
          <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-1">Disputed</p>
          <p className="text-xl md:text-2xl font-black text-purple-700">{formatCurrency(summaryStats.disputed.amount)}</p>
          <p className="text-xs text-slate-500">{summaryStats.disputed.count} bill{summaryStats.disputed.count !== 1 ? 's' : ''}</p>
        </button>
      </div>

      {/* Cash Flow Forecast */}
      <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900">Cash Flow Forecast</h3>
            <p className="text-xs text-slate-500">Upcoming payment obligations</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cashFlowForecast.map((week, idx) => (
            <div key={idx} className={`p-3 rounded-xl ${idx === 0 && week.amount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
              <p className="text-xs font-bold text-slate-500">{week.label}</p>
              <p className={`text-lg font-black ${idx === 0 && week.amount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {formatCurrency(week.amount)}
              </p>
              <p className="text-[10px] text-slate-400">{week.billCount} bill{week.billCount !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" size={18} />
          <input
            type="text"
            placeholder="Search by vendor or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 md:pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="all">All Vendors</option>
            {uniqueVendors.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowVendorSummary(!showVendorSummary)}
            className={`px-4 py-3 rounded-2xl text-sm font-bold transition-colors flex items-center gap-2 ${
              showVendorSummary ? 'bg-amber-500 text-slate-900' : 'bg-white border-2 border-slate-100 text-slate-700'
            }`}
          >
            <Users size={16} />
            <span className="hidden md:inline">By Vendor</span>
          </button>
        </div>
      </div>

      {/* Vendor Summary Section */}
      {showVendorSummary && (
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 md:p-6 mb-6">
          <h3 className="font-black text-slate-900 uppercase tracking-wider text-sm mb-4">Outstanding by Vendor</h3>
          <div className="space-y-2">
            {vendorSummaries.map(summary => {
              const bucket = getAgingBucket(summary.oldestDueDays, 'unpaid');
              const bucketColors = getBucketColors(bucket);
              return (
                <div
                  key={summary.vendorName}
                  onClick={() => {
                    setVendorFilter(summary.vendorName);
                    setShowVendorSummary(false);
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all hover:shadow-md ${bucketColors.bg} ${bucketColors.border} border`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{summary.vendorName}</p>
                    <p className="text-xs text-slate-500">
                      {summary.billCount} bill{summary.billCount !== 1 ? 's' : ''} · {formatDaysUntilDue(summary.oldestDueDays)}
                    </p>
                  </div>
                  <p className={`font-black text-lg ${bucketColors.text}`}>{formatCurrency(summary.totalOwed)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bills Table */}
      <div className="bg-white rounded-[28px] border-2 border-slate-100 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">
          <button
            onClick={() => handleSort('vendor')}
            className="col-span-3 flex items-center gap-1 hover:text-slate-700"
          >
            Vendor
            {sortField === 'vendor' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <div className="col-span-2">Invoice #</div>
          <button
            onClick={() => handleSort('due_date')}
            className="col-span-2 flex items-center gap-1 hover:text-slate-700"
          >
            Due Date
            {sortField === 'due_date' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className="col-span-2 flex items-center gap-1 hover:text-slate-700"
          >
            Remaining
            {sortField === 'amount' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Bills List */}
        {filteredPayables.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">
              {activeBucket === 'all' ? 'No outstanding bills!' : 'No bills in this category'}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 text-amber-600 font-bold text-sm hover:underline"
            >
              Add your first bill
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredPayables.map(payable => {
              const daysUntilDue = getDaysUntilDue(payable.due_date);
              const bucket = getAgingBucket(daysUntilDue, payable.status);
              const bucketColors = getBucketColors(bucket);
              const remaining = payable.amount - payable.amount_paid;
              const StatusIcon = STATUS_CONFIG[payable.status]?.icon || Clock;

              return (
                <div key={payable.id} className={`p-4 md:grid md:grid-cols-12 md:gap-4 md:items-center hover:bg-slate-50/50 transition-colors ${bucketColors.bg}`}>
                  {/* Mobile View */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{payable.vendor_name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          {payable.invoice_number && (
                            <span className="bg-slate-100 font-bold px-2 py-0.5 rounded">#{payable.invoice_number}</span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full">{payable.category}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${bucketColors.text}`}>{formatCurrency(remaining)}</p>
                        {payable.amount_paid > 0 && (
                          <p className="text-xs text-slate-400">of {formatCurrency(payable.amount)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${bucketColors.bg} ${bucketColors.text} border ${bucketColors.border}`}>
                        {daysUntilDue !== null && daysUntilDue < 0 && <AlertTriangle size={12} />}
                        {formatDaysUntilDue(daysUntilDue)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-black ${STATUS_CONFIG[payable.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_CONFIG[payable.status]?.label || payable.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openPaymentModal(payable)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold"
                      >
                        <DollarSign size={14} /> Payment
                      </button>
                      <button
                        onClick={() => handleMarkPaid(payable.id)}
                        disabled={processing === payable.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50"
                      >
                        {processing === payable.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Paid
                      </button>
                      <button
                        onClick={() => openEditModal(payable)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:contents">
                    <div className="col-span-3">
                      <p className="font-bold text-slate-900 truncate">{payable.vendor_name}</p>
                      {payable.description && (
                        <p className="text-xs text-slate-400 truncate">{payable.description}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      {payable.invoice_number ? (
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-xs">#{payable.invoice_number}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className={`text-sm ${daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                        {payable.due_date ? new Date(payable.due_date).toLocaleDateString('en-GB') : '-'}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${bucketColors.text}`}>
                        {daysUntilDue !== null && daysUntilDue < 0 && <AlertTriangle size={10} />}
                        {formatDaysUntilDue(daysUntilDue)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className={`font-black ${bucketColors.text}`}>{formatCurrency(remaining)}</p>
                      {payable.amount_paid > 0 && (
                        <p className="text-xs text-slate-400">of {formatCurrency(payable.amount)}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black ${STATUS_CONFIG[payable.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        <StatusIcon size={12} />
                        {STATUS_CONFIG[payable.status]?.label || payable.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <button
                        onClick={() => openPaymentModal(payable)}
                        className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                        title="Record Payment"
                      >
                        <DollarSign size={16} />
                      </button>
                      <button
                        onClick={() => handleMarkPaid(payable.id)}
                        disabled={processing === payable.id}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="Mark as Paid"
                      >
                        {processing === payable.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      {payable.status !== 'disputed' && (
                        <button
                          onClick={() => handleMarkDisputed(payable)}
                          className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-purple-100 hover:text-purple-600 transition-colors"
                          title="Mark Disputed"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(payable)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(payable.id)}
                        disabled={processing === payable.id}
                        className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Bill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">
                  {editingPayable ? 'Edit Bill' : 'Add New Bill'}
                </h2>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Vendor */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Supplier / Vendor *
                </label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="e.g. Screwfix, Travis Perkins"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                  list="vendor-suggestions"
                />
                <datalist id="vendor-suggestions">
                  {vendors.map(v => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </div>

              {/* Amount & VAT */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Amount *
                  </label>
                  <div className="relative">
                    <PoundSterling className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    VAT Amount
                  </label>
                  <div className="relative">
                    <PoundSterling className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vat_amount}
                      onChange={(e) => setFormData({ ...formData, vat_amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Number & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What's this bill for?"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing === 'form'}
                  className="flex-1 px-6 py-3 bg-amber-500 text-slate-900 rounded-2xl font-black hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing === 'form' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {editingPayable ? 'Update Bill' : 'Add Bill'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && payingPayable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Record Payment</h2>
                <button
                  onClick={() => { setShowPaymentModal(false); setPayingPayable(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <p className="text-xs font-bold text-slate-400 mb-1">Bill Details</p>
                <p className="font-bold text-slate-900">{payingPayable.vendor_name}</p>
                {payingPayable.invoice_number && (
                  <p className="text-sm text-slate-500">#{payingPayable.invoice_number}</p>
                )}
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Total Amount</span>
                  <span className="font-bold">{formatCurrency(payingPayable.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Already Paid</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(payingPayable.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                  <span className="font-bold text-slate-700">Remaining</span>
                  <span className="font-black text-slate-900">{formatCurrency(payingPayable.amount - payingPayable.amount_paid)}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Payment Amount
                </label>
                <div className="relative">
                  <PoundSterling className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    max={payingPayable.amount - payingPayable.amount_paid}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowPaymentModal(false); setPayingPayable(null); }}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={processing === payingPayable.id || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing === payingPayable.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
