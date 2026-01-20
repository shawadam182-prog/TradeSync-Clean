import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, AlertTriangle, Search, ArrowLeft, ChevronDown, ChevronUp,
  Eye, Mail, CheckCircle2, Download, Filter, Users, PoundSterling,
  Calendar, Hash, ArrowUpDown, X, Loader2, FileText, AlertCircle
} from 'lucide-react';
import { useData } from '../src/contexts/DataContext';
import { useToast } from '../src/contexts/ToastContext';
import { Quote, Customer, AppSettings } from '../types';
import { quotesService } from '../src/services/dataService';

interface AgedReceivablesPageProps {
  onBack?: () => void;
  onViewInvoice?: (id: string) => void;
}

type AgingBucket = 'all' | 'current' | '30-60' | '60-90' | '90+';
type SortField = 'age' | 'amount' | 'customer' | 'date';
type SortDirection = 'asc' | 'desc';

interface OutstandingInvoice {
  id: string;
  referenceNumber: number | undefined;
  title: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string | undefined;
  amount: number;
  status: string;
  daysOutstanding: number;
  bucket: 'current' | '30-60' | '60-90' | '90+';
}

interface CustomerSummary {
  customerId: string;
  customerName: string;
  totalOwed: number;
  invoiceCount: number;
  oldestDays: number;
}

// Calculate invoice total from sections
const calculateInvoiceTotal = (invoice: Quote): number => {
  const sections = invoice.sections || [];
  const materialsTotal = sections.reduce((sum, section) =>
    sum + (section.items || []).reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0), 0);
  const labourHoursTotal = sections.reduce((sum, section) => sum + (section.labourHours || 0), 0);
  const labourTotal = labourHoursTotal * (invoice.labourRate || 0);

  const subtotal = materialsTotal + labourTotal;
  const markup = subtotal * ((invoice.markupPercent || 0) / 100);
  const tax = (subtotal + markup) * ((invoice.taxPercent || 0) / 100);
  return subtotal + markup + tax;
};

// Calculate days outstanding from invoice date or due date
const calculateDaysOutstanding = (invoice: Quote): number => {
  const referenceDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(invoice.date);
  const now = new Date();
  const diff = now.getTime() - referenceDate.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

// Determine aging bucket
const getAgingBucket = (days: number): 'current' | '30-60' | '60-90' | '90+' => {
  if (days < 30) return 'current';
  if (days < 60) return '30-60';
  if (days < 90) return '60-90';
  return '90+';
};

export const AgedReceivablesPage: React.FC<AgedReceivablesPageProps> = ({
  onBack,
  onViewInvoice
}) => {
  const { quotes, customers, settings } = useData();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeBucket, setActiveBucket] = useState<AgingBucket>('all');
  const [sortField, setSortField] = useState<SortField>('age');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [showCustomerSummary, setShowCustomerSummary] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Process outstanding invoices
  const outstandingInvoices = useMemo((): OutstandingInvoice[] => {
    return quotes
      .filter(q =>
        q.type === 'invoice' &&
        q.status !== 'paid' &&
        q.status !== 'draft' &&
        q.status !== 'declined'
      )
      .map(invoice => {
        const customer = customers.find(c => c.id === invoice.customerId);
        const daysOutstanding = calculateDaysOutstanding(invoice);
        return {
          id: invoice.id,
          referenceNumber: invoice.referenceNumber,
          title: invoice.title,
          customerId: invoice.customerId,
          customerName: customer?.name || 'Unknown Customer',
          date: invoice.date,
          dueDate: invoice.dueDate,
          amount: calculateInvoiceTotal(invoice),
          status: invoice.status,
          daysOutstanding,
          bucket: getAgingBucket(daysOutstanding)
        };
      });
  }, [quotes, customers]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const current = outstandingInvoices.filter(i => i.bucket === 'current');
    const days30_60 = outstandingInvoices.filter(i => i.bucket === '30-60');
    const days60_90 = outstandingInvoices.filter(i => i.bucket === '60-90');
    const days90plus = outstandingInvoices.filter(i => i.bucket === '90+');

    return {
      total: {
        count: outstandingInvoices.length,
        amount: outstandingInvoices.reduce((sum, i) => sum + i.amount, 0)
      },
      current: {
        count: current.length,
        amount: current.reduce((sum, i) => sum + i.amount, 0)
      },
      days30_60: {
        count: days30_60.length,
        amount: days30_60.reduce((sum, i) => sum + i.amount, 0)
      },
      days60_90: {
        count: days60_90.length,
        amount: days60_90.reduce((sum, i) => sum + i.amount, 0)
      },
      days90plus: {
        count: days90plus.length,
        amount: days90plus.reduce((sum, i) => sum + i.amount, 0)
      }
    };
  }, [outstandingInvoices]);

  // Customer summary
  const customerSummaries = useMemo((): CustomerSummary[] => {
    const summaryMap = new Map<string, CustomerSummary>();

    outstandingInvoices.forEach(invoice => {
      const existing = summaryMap.get(invoice.customerId);
      if (existing) {
        existing.totalOwed += invoice.amount;
        existing.invoiceCount += 1;
        existing.oldestDays = Math.max(existing.oldestDays, invoice.daysOutstanding);
      } else {
        summaryMap.set(invoice.customerId, {
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          totalOwed: invoice.amount,
          invoiceCount: 1,
          oldestDays: invoice.daysOutstanding
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  }, [outstandingInvoices]);

  // Unique customers for filter
  const uniqueCustomers = useMemo(() => {
    const customerSet = new Set(outstandingInvoices.map(i => i.customerId));
    return customers.filter(c => customerSet.has(c.id));
  }, [outstandingInvoices, customers]);

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    let filtered = [...outstandingInvoices];

    // Apply bucket filter
    if (activeBucket !== 'all') {
      filtered = filtered.filter(i => i.bucket === activeBucket);
    }

    // Apply customer filter
    if (customerFilter !== 'all') {
      filtered = filtered.filter(i => i.customerId === customerFilter);
    }

    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.customerName.toLowerCase().includes(search) ||
        i.title.toLowerCase().includes(search) ||
        (i.referenceNumber && `INV-${i.referenceNumber.toString().padStart(4, '0')}`.toLowerCase().includes(search))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'age':
          comparison = a.daysOutstanding - b.daysOutstanding;
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'customer':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [outstandingInvoices, activeBucket, customerFilter, searchTerm, sortField, sortDirection]);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async (invoice: OutstandingInvoice) => {
    setMarkingPaid(invoice.id);
    try {
      await quotesService.update(invoice.id, {
        status: 'paid',
        payment_date: new Date().toISOString().split('T')[0]
      });
      toast.success('Invoice Marked Paid', `${invoice.customerName} - £${invoice.amount.toFixed(2)}`);
      // Refresh will happen through DataContext
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      toast.error('Update Failed', 'Could not mark invoice as paid');
    } finally {
      setMarkingPaid(null);
    }
  };

  // Generate chase email
  const generateChaseEmail = (invoice: OutstandingInvoice) => {
    const prefix = settings.invoicePrefix || 'INV-';
    const ref = `${prefix}${(invoice.referenceNumber || 0).toString().padStart(4, '0')}`;
    const dueDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'as per terms';

    const subject = `Payment Reminder - Invoice ${ref}`;
    const body = `Hi ${invoice.customerName.split(' ')[0]},

This is a friendly reminder that invoice ${ref} for £${invoice.amount.toFixed(2)} was due on ${dueDate}.

If you've already sent payment, please disregard this message.

${settings.companyName ? `Bank Details:\n[Your bank details here]\n\n` : ''}Thanks,
${settings.companyName || 'Your Company'}`;

    return { subject, body };
  };

  // Handle send reminder
  const handleSendReminder = (invoice: OutstandingInvoice) => {
    setSelectedInvoice(invoice);
    setShowEmailModal(true);
  };

  // Open email client
  const openEmailClient = () => {
    if (!selectedInvoice) return;

    const customer = customers.find(c => c.id === selectedInvoice.customerId);
    const { subject, body } = generateChaseEmail(selectedInvoice);

    if (customer?.email) {
      window.location.href = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      // Copy to clipboard if no email
      navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast.info('Copied to Clipboard', 'Email template copied - customer has no email on file');
    }
    setShowEmailModal(false);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Customer', 'Invoice #', 'Date', 'Due Date', 'Amount', 'Days Outstanding', 'Status', 'Bucket'];
    const prefix = settings.invoicePrefix || 'INV-';

    const rows = filteredInvoices.map(inv => [
      inv.customerName,
      `${prefix}${(inv.referenceNumber || 0).toString().padStart(4, '0')}`,
      new Date(inv.date).toISOString().split('T')[0],
      inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      inv.amount.toFixed(2),
      inv.daysOutstanding.toString(),
      inv.status,
      inv.bucket
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aged_receivables_${new Date().toISOString().split('T')[0]}.csv`;
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

  // Get bucket color classes
  const getBucketColors = (bucket: string) => {
    switch (bucket) {
      case 'current':
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' };
      case '30-60':
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' };
      case '60-90':
        return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: 'text-orange-500' };
      case '90+':
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500' };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: 'text-slate-500' };
    }
  };

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
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Aged Receivables</h1>
            <p className="text-slate-500 text-sm font-medium italic">Outstanding invoices by age</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

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
          <p className="text-xs text-slate-500">{summaryStats.total.count} invoice{summaryStats.total.count !== 1 ? 's' : ''}</p>
        </button>

        <button
          onClick={() => setActiveBucket('current')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === 'current' ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-100 hover:border-emerald-200'
          }`}
        >
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Current (0-30)</p>
          <p className="text-xl md:text-2xl font-black text-emerald-700">{formatCurrency(summaryStats.current.amount)}</p>
          <p className="text-xs text-slate-500">{summaryStats.current.count} invoice{summaryStats.current.count !== 1 ? 's' : ''}</p>
        </button>

        <button
          onClick={() => setActiveBucket('30-60')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left ${
            activeBucket === '30-60' ? 'border-amber-500 shadow-lg shadow-amber-500/10' : 'border-slate-100 hover:border-amber-200'
          }`}
        >
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">30-60 Days</p>
          <p className="text-xl md:text-2xl font-black text-amber-700">{formatCurrency(summaryStats.days30_60.amount)}</p>
          <p className="text-xs text-slate-500">{summaryStats.days30_60.count} invoice{summaryStats.days30_60.count !== 1 ? 's' : ''}</p>
        </button>

        <button
          onClick={() => setActiveBucket('60-90')}
          className={`bg-white rounded-2xl p-4 md:p-5 border-2 transition-all text-left relative ${
            activeBucket === '60-90' ? 'border-orange-500 shadow-lg shadow-orange-500/10' : 'border-slate-100 hover:border-orange-200'
          }`}
        >
          <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider mb-1">60-90 Days</p>
          <p className="text-xl md:text-2xl font-black text-orange-700">{formatCurrency(summaryStats.days60_90.amount)}</p>
          <p className="text-xs text-slate-500">{summaryStats.days60_90.count} invoice{summaryStats.days60_90.count !== 1 ? 's' : ''}</p>
        </button>
      </div>

      {/* 90+ Days Alert Card */}
      {summaryStats.days90plus.count > 0 && (
        <button
          onClick={() => setActiveBucket('90+')}
          className={`w-full mb-6 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-4 md:p-6 text-white text-left transition-all ${
            activeBucket === '90+' ? 'ring-4 ring-red-300' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="animate-pulse" size={24} />
              <div>
                <p className="font-black uppercase tracking-wider text-sm">Critical: 90+ Days Overdue</p>
                <p className="text-red-100 text-sm">{summaryStats.days90plus.count} invoice{summaryStats.days90plus.count !== 1 ? 's' : ''} need urgent attention</p>
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black">{formatCurrency(summaryStats.days90plus.amount)}</p>
          </div>
        </button>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" size={18} />
          <input
            type="text"
            placeholder="Search by customer or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 md:pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">All Customers</option>
            {uniqueCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowCustomerSummary(!showCustomerSummary)}
            className={`px-4 py-3 rounded-2xl text-sm font-bold transition-colors flex items-center gap-2 ${
              showCustomerSummary ? 'bg-teal-500 text-white' : 'bg-white border-2 border-slate-100 text-slate-700'
            }`}
          >
            <Users size={16} />
            <span className="hidden md:inline">By Customer</span>
          </button>
        </div>
      </div>

      {/* Customer Summary Section */}
      {showCustomerSummary && (
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 md:p-6 mb-6">
          <h3 className="font-black text-slate-900 uppercase tracking-wider text-sm mb-4">Outstanding by Customer</h3>
          <div className="space-y-2">
            {customerSummaries.map(summary => {
              const bucketColors = getBucketColors(getAgingBucket(summary.oldestDays));
              return (
                <div
                  key={summary.customerId}
                  onClick={() => {
                    setCustomerFilter(summary.customerId);
                    setShowCustomerSummary(false);
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all hover:shadow-md ${bucketColors.bg} ${bucketColors.border} border`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{summary.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {summary.invoiceCount} invoice{summary.invoiceCount !== 1 ? 's' : ''} · Oldest: {summary.oldestDays} days
                    </p>
                  </div>
                  <p className={`font-black text-lg ${bucketColors.text}`}>{formatCurrency(summary.totalOwed)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-white rounded-[28px] border-2 border-slate-100 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">
          <button
            onClick={() => handleSort('customer')}
            className="col-span-3 flex items-center gap-1 hover:text-slate-700"
          >
            Customer
            {sortField === 'customer' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <div className="col-span-2">Invoice #</div>
          <button
            onClick={() => handleSort('date')}
            className="col-span-2 flex items-center gap-1 hover:text-slate-700"
          >
            Date
            {sortField === 'date' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <button
            onClick={() => handleSort('amount')}
            className="col-span-2 flex items-center gap-1 hover:text-slate-700"
          >
            Amount
            {sortField === 'amount' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <button
            onClick={() => handleSort('age')}
            className="col-span-2 flex items-center gap-1 hover:text-slate-700"
          >
            Age
            {sortField === 'age' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
          </button>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Invoice Rows */}
        {filteredInvoices.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">
              {activeBucket === 'all' ? 'No outstanding invoices!' : `No invoices in this aging bucket`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredInvoices.map(invoice => {
              const prefix = settings.invoicePrefix || 'INV-';
              const ref = `${prefix}${(invoice.referenceNumber || 0).toString().padStart(4, '0')}`;
              const bucketColors = getBucketColors(invoice.bucket);
              const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date();

              return (
                <div
                  key={invoice.id}
                  className={`p-4 md:grid md:grid-cols-12 md:gap-4 md:items-center hover:bg-slate-50/50 transition-colors ${bucketColors.bg}`}
                >
                  {/* Mobile View */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{invoice.customerName}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded">{ref}</span>
                          <span>{new Date(invoice.date).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${bucketColors.text}`}>{formatCurrency(invoice.amount)}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${bucketColors.bg} ${bucketColors.text} border ${bucketColors.border}`}>
                          {isOverdue && <AlertTriangle size={10} />}
                          {invoice.daysOutstanding} days
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(invoice.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                        >
                          <Eye size={14} /> View
                        </button>
                      )}
                      <button
                        onClick={() => handleSendReminder(invoice)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold"
                      >
                        <Mail size={14} /> Chase
                      </button>
                      <button
                        onClick={() => handleMarkAsPaid(invoice)}
                        disabled={markingPaid === invoice.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold disabled:opacity-50"
                      >
                        {markingPaid === invoice.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:contents">
                    <div className="col-span-3">
                      <p className="font-bold text-slate-900 truncate">{invoice.customerName}</p>
                      <p className="text-xs text-slate-500 truncate">{invoice.title}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="bg-teal-100 text-teal-700 font-bold px-2 py-1 rounded text-xs">{ref}</span>
                    </div>
                    <div className="col-span-2 text-sm">
                      <p className="text-slate-700">{new Date(invoice.date).toLocaleDateString('en-GB')}</p>
                      {invoice.dueDate && (
                        <p className={`text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                          Due: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className={`font-black ${bucketColors.text}`}>{formatCurrency(invoice.amount)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${bucketColors.bg} ${bucketColors.text} border ${bucketColors.border}`}>
                        {isOverdue && <AlertTriangle size={12} />}
                        {invoice.daysOutstanding} days
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(invoice.id)}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                          title="View Invoice"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleSendReminder(invoice)}
                        className="p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                        title="Send Reminder"
                      >
                        <Mail size={16} />
                      </button>
                      <button
                        onClick={() => handleMarkAsPaid(invoice)}
                        disabled={markingPaid === invoice.id}
                        className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
                        title="Mark as Paid"
                      >
                        {markingPaid === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Send Payment Reminder</h2>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">To</p>
                <p className="font-bold text-slate-900">{selectedInvoice.customerName}</p>
                <p className="text-sm text-slate-500">
                  {customers.find(c => c.id === selectedInvoice.customerId)?.email || 'No email on file'}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Subject</p>
                <p className="font-bold text-slate-900">{generateChaseEmail(selectedInvoice).subject}</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Message Preview</p>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono">
                  {generateChaseEmail(selectedInvoice).body}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={openEmailClient}
                  className="flex-1 px-4 py-3 bg-teal-500 text-white rounded-2xl font-black hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={18} />
                  {customers.find(c => c.id === selectedInvoice.customerId)?.email ? 'Open Email' : 'Copy Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
