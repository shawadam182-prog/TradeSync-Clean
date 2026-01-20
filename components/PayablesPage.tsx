import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Filter, AlertTriangle, Clock, Check,
  Calendar, PoundSterling, Loader2, X, Building2,
  FileText, ChevronDown, MoreVertical, Trash2, Edit2,
  CheckCircle, AlertCircle, RefreshCw, ArrowLeft
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

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-slate-100 text-slate-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  disputed: { label: 'Disputed', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
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

interface PayablesPageProps {
  onBack?: () => void;
}

export const PayablesPage: React.FC<PayablesPageProps> = ({ onBack }) => {
  const toast = useToast();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('unpaid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
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

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (filter === 'unpaid' && !['unpaid', 'partial', 'overdue'].includes(p.status)) return false;
      if (filter === 'overdue' && p.status !== 'overdue') return false;
      if (filter === 'paid' && p.status !== 'paid') return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return p.vendor_name.toLowerCase().includes(search) ||
          p.invoice_number?.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [payables, filter, searchTerm]);

  const stats = useMemo(() => {
    const unpaid = payables.filter(p => ['unpaid', 'partial'].includes(p.status));
    const overdue = payables.filter(p => p.status === 'overdue');
    const totalOutstanding = [...unpaid, ...overdue].reduce((sum, p) => sum + (p.amount - p.amount_paid), 0);
    const overdueAmount = overdue.reduce((sum, p) => sum + (p.amount - p.amount_paid), 0);
    return {
      unpaidCount: unpaid.length + overdue.length,
      overdueCount: overdue.length,
      totalOutstanding,
      overdueAmount,
    };
  }, [payables]);

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

  const selectVendor = (vendor: Vendor) => {
    setFormData(prev => ({
      ...prev,
      vendor_name: vendor.name,
      category: vendor.default_category || prev.category,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4 md:mb-8">
          <div className="space-y-2">
            <div className="skeleton h-8 w-32 rounded-lg" />
            <div className="skeleton h-4 w-48 rounded-lg" />
          </div>
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 md:mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200">
              <div className="skeleton h-3 w-20 mb-2 rounded" />
              <div className="skeleton h-7 w-24 rounded" />
            </div>
          ))}
        </div>
        <ExpensesListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
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
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bills to Pay</h1>
            <p className="text-slate-500 text-sm font-medium">Track supplier invoices and payment deadlines</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-teal-500 text-white px-5 py-2 rounded-xl font-black text-sm hover:bg-teal-400 transition-colors"
          >
            <Plus size={18} />
            Add Bill
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 md:mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Outstanding</p>
          <p className="text-2xl font-black text-slate-900">£{stats.totalOutstanding.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unpaid Bills</p>
          <p className="text-2xl font-black text-amber-600">{stats.unpaidCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-red-200 bg-red-50">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Overdue</p>
          <p className="text-2xl font-black text-red-600">{stats.overdueCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-red-200 bg-red-50">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Overdue Amount</p>
          <p className="text-2xl font-black text-red-600">£{stats.overdueAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-3 md:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block" size={18} />
          <input
            type="text"
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 md:pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'unpaid', 'overdue', 'paid'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black capitalize transition-colors ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Payables List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        {filteredPayables.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">
              {filter === 'unpaid' ? 'No unpaid bills' : filter === 'overdue' ? 'No overdue bills' : 'No bills found'}
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 text-teal-600 font-bold text-sm hover:underline"
            >
              Add your first bill
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPayables.map(payable => {
              const StatusIcon = STATUS_CONFIG[payable.status]?.icon || Clock;
              const statusConfig = STATUS_CONFIG[payable.status] || STATUS_CONFIG.unpaid;
              const remaining = payable.amount - payable.amount_paid;
              const isOverdue = payable.due_date && new Date(payable.due_date) < new Date() && payable.status !== 'paid';

              return (
                <div key={payable.id} className="p-4 md:p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isOverdue ? 'bg-red-100 text-red-600' : statusConfig.color.replace('text-', 'text-').split(' ')[0]
                    }`}>
                      <StatusIcon size={18} className={isOverdue ? 'text-red-600' : ''} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-900">{payable.vendor_name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {payable.invoice_number && (
                              <span className="text-xs text-slate-500">#{payable.invoice_number}</span>
                            )}
                            {payable.description && (
                              <span className="text-xs text-slate-400 truncate max-w-[200px]">{payable.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-900">£{remaining.toFixed(2)}</p>
                          {payable.amount_paid > 0 && (
                            <p className="text-xs text-slate-400">of £{payable.amount.toFixed(2)}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                        <span className={`px-2 py-1 rounded-full font-black ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {payable.due_date && (
                          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                            <Calendar size={12} />
                            Due {new Date(payable.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {payable.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {payable.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(payable.id)}
                          disabled={processing === payable.id}
                          className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"
                          title="Mark as Paid"
                        >
                          {processing === payable.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check size={18} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(payable)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(payable.id)}
                        disabled={processing === payable.id}
                        className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
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
    </div>
  );
};
