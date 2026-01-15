import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Receipt, Camera, Plus, Filter, Search, Trash2,
  Calendar, Tag, Building2, X, Check, Loader2,
  ChevronDown, Image as ImageIcon, FileText, Fuel,
  Wrench, Users, Shield, MoreHorizontal, Eye, Settings,
  Package, Car, CreditCard, Briefcase, Zap, Coffee,
  Phone, Home, Truck, HardHat, Hammer, Lightbulb, Sparkles,
  Clock, TrendingUp
} from 'lucide-react';
import { expensesService, expenseCategoriesService, vendorKeywordsService, vendorsService, filingService } from '../src/services/dataService';
import { CategoryManager } from './CategoryManager';
import { ExpensesListSkeleton } from './Skeletons';
import { useToast } from '../src/contexts/ToastContext';
import { handleApiError } from '../src/utils/errorHandler';

interface Expense {
  id: string;
  vendor: string;
  description?: string;
  amount: number;
  vat_amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  receipt_storage_path?: string;
  is_reconciled: boolean;
  job_pack?: { id: string; title: string } | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
  is_default: boolean;
}

interface Vendor {
  id: string;
  name: string;
  default_category: string | null;
  default_payment_method: string | null;
  total_spent: number;
  expense_count: number;
  last_expense_date: string | null;
}

interface ExpensesPageProps {
  projects: { id: string; title: string }[];
}

const DEFAULT_CATEGORIES = [
  { id: 'materials', name: 'Materials', icon: 'package', color: '#3b82f6' },
  { id: 'tools', name: 'Tools', icon: 'wrench', color: '#8b5cf6' },
  { id: 'fuel', name: 'Fuel', icon: 'fuel', color: '#ef4444' },
  { id: 'vehicle', name: 'Vehicle', icon: 'car', color: '#06b6d4' },
  { id: 'insurance', name: 'Insurance', icon: 'shield', color: '#10b981' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'credit-card', color: '#f59e0b' },
  { id: 'office', name: 'Office', icon: 'briefcase', color: '#6366f1' },
  { id: 'other', name: 'Other', icon: 'tag', color: '#64748b' },
];

const PAYMENT_METHODS = [
  { id: 'card', label: 'Card' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'cheque', label: 'Cheque' },
];

const ICON_MAP: Record<string, React.FC<any>> = {
  'package': Package,
  'wrench': Wrench,
  'fuel': Fuel,
  'car': Car,
  'shield': Shield,
  'credit-card': CreditCard,
  'briefcase': Briefcase,
  'tag': Tag,
  'zap': Zap,
  'coffee': Coffee,
  'phone': Phone,
  'home': Home,
  'truck': Truck,
  'hard-hat': HardHat,
  'hammer': Hammer,
  'lightbulb': Lightbulb,
  'file-text': FileText,
  'users': Users,
  'more-horizontal': MoreHorizontal,
};

const getIconComponent = (iconName: string): React.FC<any> => {
  return ICON_MAP[iconName] || Tag;
};

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ projects }) => {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [suggestedCategory, setSuggestedCategory] = useState<{ id: string; name: string } | null>(null);
  const [vendorSuggestions, setVendorSuggestions] = useState<Vendor[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [topVendors, setTopVendors] = useState<Vendor[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs for directly setting input values on mobile (bypasses React controlled input issues)
  const vendorInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const vatInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Persist modal state to handle iOS PWA state loss when camera opens
  const [showAddModal, setShowAddModalState] = useState(() => {
    try {
      return sessionStorage.getItem('expenseModalOpen') === 'true';
    } catch { return false; }
  });
  const setShowAddModal = (show: boolean) => {
    setShowAddModalState(show);
    try {
      if (show) sessionStorage.setItem('expenseModalOpen', 'true');
      else sessionStorage.removeItem('expenseModalOpen');
    } catch { /* ignore */ }
  };

  const [formData, setFormData] = useState(() => {
    // Check for scanned data in sessionStorage (persists across PWA camera resumption)
    try {
      const scanned = sessionStorage.getItem('scannedExpense');
      if (scanned) {
        sessionStorage.removeItem('scannedExpense');
        return JSON.parse(scanned);
      }
    } catch { /* ignore */ }
    return {
      vendor: '',
      description: '',
      amount: '',
      vat_amount: '',
      category: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'card',
      job_pack_id: '',
    };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, topV] = await Promise.all([
        expensesService.getAll(),
        loadCategories(),
        vendorsService.getTopVendors(5).then(setTopVendors).catch(() => []),
      ]);
      setExpenses(expData || []);
    } catch (error) { console.error('Failed to load data:', error); }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const data = await expenseCategoriesService.getAll();
      if (data && data.length > 0) {
        setCategories(data);
        if (!formData.category) setFormData(prev => ({ ...prev, category: data[0]?.name || 'Materials' }));
        return data;
      }
      setCategories(DEFAULT_CATEGORIES as any);
      setFormData(prev => ({ ...prev, category: 'Materials' }));
      return DEFAULT_CATEGORIES;
    } catch (error) {
      setCategories(DEFAULT_CATEGORIES as any);
      return DEFAULT_CATEGORIES;
    }
  };

  // Vendor search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.vendor.length >= 2) {
        try {
          const results = await vendorsService.search(formData.vendor);
          setVendorSuggestions(results);
          setShowVendorDropdown(results.length > 0);
        } catch (e) {
          setVendorSuggestions([]);
        }
      } else {
        setVendorSuggestions([]);
        setShowVendorDropdown(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [formData.vendor]);

  // Check for keyword-based category suggestion
  const checkVendorKeyword = useCallback(async (vendorName: string) => {
    if (vendorName.length < 3) { setSuggestedCategory(null); return; }
    try {
      const match = await vendorKeywordsService.findCategoryByVendor(vendorName);
      if (match) setSuggestedCategory({ id: match.id, name: match.name });
      else setSuggestedCategory(null);
    } catch (error) { console.error('Keyword lookup failed:', error); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (formData.vendor && !showVendorDropdown) checkVendorKeyword(formData.vendor); }, 300);
    return () => clearTimeout(timer);
  }, [formData.vendor, checkVendorKeyword, showVendorDropdown]);

  const selectVendor = (vendor: Vendor) => {
    setFormData(prev => ({
      ...prev,
      vendor: vendor.name,
      category: vendor.default_category || prev.category,
      payment_method: vendor.default_payment_method || prev.payment_method,
    }));
    setShowVendorDropdown(false);
    setSuggestedCategory(null);
  };

  const processFile = async (file: File) => {
    console.log('processFile started:', file.name, file.type, file.size);
    try {
      // Set preview immediately using object URL (synchronous, more reliable on mobile)
      const previewUrl = URL.createObjectURL(file);
      console.log('Created preview URL:', previewUrl);
      setReceiptPreview(previewUrl);
      setReceiptFile(file);
      setScanning(true);
      console.log('Set preview, file, and scanning state');

      // Convert to base64 and send to AI
      const base64 = await fileToBase64(file);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: 'parseReceipt', data: { imageBase64: base64 } }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('AI response:', result);
        if (result.vendor || result.amount) {
          // Map AI category to user's actual category (case-insensitive match)
          let matchedCategory: string | null = null;
          if (result.category) {
            const found = categories.find(c =>
              c.name.toLowerCase() === result.category.toLowerCase()
            );
            matchedCategory = found?.name || null;
            console.log('Category mapping:', result.category, '->', matchedCategory);
          }

          // Build new form data with ONLY API values - no closure dependencies
          const newFormData = {
            vendor: String(result.vendor || ''),
            description: String(result.description || ''),
            amount: String(result.amount || ''),
            vat_amount: String(result.vatAmount || ''),
            category: matchedCategory || 'Materials',
            expense_date: String(result.date || new Date().toISOString().split('T')[0]),
            payment_method: String(result.paymentMethod || 'card'),
            job_pack_id: '',
          };

          console.log('About to update form with:', newFormData);

          // Store in sessionStorage and reload page to force fresh state
          try {
            sessionStorage.setItem('scannedExpense', JSON.stringify(newFormData));
            sessionStorage.setItem('expenseModalOpen', 'true');
          } catch { /* ignore */ }

          // Force page reload to pick up the sessionStorage data
          window.location.reload();
          return;
        } else {
          toast.info('Receipt uploaded', 'Unable to read details. Please fill in manually.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI scan failed:', response.status, errorData);
        toast.info('Receipt uploaded', 'AI scanning failed. Please fill in manually.');
      }
    } catch (error) {
      console.error('Receipt processing failed:', error);
      toast.info('Receipt uploaded', 'Please fill in the details manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect triggered');
    const file = e.target.files?.[0];
    console.log('File selected:', file?.name, file?.size);

    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!file) {
      console.log('No file selected');
      return;
    }
    await processFile(file);
  };

  // Trigger the hidden file input
  const triggerFileSelect = () => {
    console.log('triggerFileSelect called');
    // Reset value before clicking to ensure onChange fires
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { const result = reader.result as string; resolve(result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!formData.vendor?.trim()) {
      toast.error('Missing Vendor', 'Please enter a vendor name');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Missing Amount', 'Please enter a valid amount');
      return;
    }

    // Use category as-is (constraint has been removed from database)
    // Fall back to first available category or 'Other' if none selected
    const validCategory = formData.category || categories[0]?.name || 'Other';

    setSaving(true);
    try {
      // Step 1: Create the expense
      const expense = await expensesService.create({
        vendor: formData.vendor,
        description: formData.description || null,
        amount: parseFloat(formData.amount),
        vat_amount: parseFloat(formData.vat_amount) || 0,
        category: validCategory,
        expense_date: formData.expense_date,
        payment_method: formData.payment_method,
        job_pack_id: formData.job_pack_id || null,
      });

      // Step 2: If there's a receipt file, file it to the cabinet AND link to expense
      if (receiptFile && expense?.id) {
        try {
          // Calculate tax year from expense date (UK tax year: April 6 - April 5)
          const expenseDate = new Date(formData.expense_date);
          const year = expenseDate.getFullYear();
          const month = expenseDate.getMonth();
          const day = expenseDate.getDate();
          const taxYear = (month > 3 || (month === 3 && day >= 6))
            ? `${year}/${year + 1}`
            : `${year - 1}/${year}`;

          // Upload to filing cabinet with expense link
          const receiptDate = new Date(formData.expense_date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          const filedDoc = await filingService.upload(receiptFile, {
            name: `${formData.vendor} - £${parseFloat(formData.amount).toFixed(2)} (${receiptDate})`,
            description: formData.description || `Receipt from ${formData.vendor} dated ${receiptDate}`,
            category: 'receipt',
            vendor_name: formData.vendor,
            document_date: formData.expense_date,
            job_pack_id: formData.job_pack_id || undefined,
            expense_id: expense.id, // Link directly during creation
            tax_year: taxYear,
          });

          // Update the expense with the receipt storage path
          if (filedDoc?.storage_path) {
            await expensesService.update(expense.id, {
              receipt_storage_path: filedDoc.storage_path
            });
          }
        } catch (fileError) {
          console.error('Failed to file receipt (expense still saved):', fileError);
        }
      }

      // Step 3: Learn the vendor keyword for auto-categorization
      const selectedCat = categories.find(c => c.name === formData.category);
      if (selectedCat && formData.vendor.length >= 3) {
        try { await vendorKeywordsService.learnKeyword(formData.vendor, selectedCat.id); }
        catch (err) { console.log('Keyword learning skipped:', err); }
      }

      await loadData();
      resetForm();
      setShowAddModal(false);
      toast.success('Expense Saved', `£${formData.amount} expense recorded`);
    } catch (error) {
      console.error('Failed to save expense:', error);
      const { message } = handleApiError(error);
      toast.error('Save Failed', message);
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesService.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Deleted', 'Expense removed successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      const { message } = handleApiError(error);
      toast.error('Delete Failed', message);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor: '', description: '', amount: '', vat_amount: '',
      category: categories[0]?.name || 'Materials',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'card', job_pack_id: '',
    });
    setReceiptPreview(null);
    setReceiptFile(null);
    setSuggestedCategory(null);
    setVendorSuggestions([]);
    setShowVendorDropdown(false);
  };

  const applySuggestedCategory = () => {
    if (suggestedCategory) { setFormData(prev => ({ ...prev, category: suggestedCategory.name })); setSuggestedCategory(null); }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filterCategory && expense.category !== filterCategory) return false;
    if (searchTerm && !expense.vendor.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVat = filteredExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);

  const getCategoryInfo = (categoryName: string) => {
    return categories.find(c => c.name === categoryName) || { name: categoryName, icon: 'tag', color: '#64748b' };
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4 md:mb-8">
        <div className="space-y-2">
          <div className="skeleton h-8 w-32 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded-lg" />
        </div>
        <div className="skeleton h-12 w-32 rounded-2xl" />
      </div>
      <ExpensesListSkeleton />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hidden file input for receipt capture - using id for label association */}
      <input
        id="receipt-file-input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="sr-only"
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-slate-500 text-sm font-medium">Track receipts and business costs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryManager(true)} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-3 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-colors">
            <Settings size={18} />Categories
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
            <Plus size={20} />Add Expense
          </button>
        </div>
      </div>

      {/* Top Vendors Quick Stats */}
      {topVendors.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
            <TrendingUp size={12} />Top Vendors
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {topVendors.map(v => (
              <button
                key={v.id}
                onClick={() => { setShowAddModal(true); setTimeout(() => selectVendor(v), 100); }}
                className="flex-shrink-0 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
              >
                <p className="font-bold text-slate-900 text-sm">{v.name}</p>
                <p className="text-[10px] text-slate-500">{v.expense_count} expenses · £{v.total_spent.toFixed(0)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 md:mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Expenses</p>
          <p className="text-2xl font-black text-slate-900">{filteredExpenses.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
          <p className="text-2xl font-black text-slate-900">£{totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">VAT Reclaimable</p>
          <p className="text-2xl font-black text-emerald-600">£{totalVat.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Cost</p>
          <p className="text-2xl font-black text-slate-900">£{(totalAmount - totalVat).toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-3 md:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search vendors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
          <button onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${!filterCategory ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>All</button>
          {categories.map(cat => (
            <button key={cat.id || cat.name} onClick={() => setFilterCategory(cat.name)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${filterCategory === cat.name ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{cat.name}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No expenses yet</p>
            <p className="text-slate-400 text-sm">Add your first expense to start tracking</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredExpenses.map(expense => {
              const category = getCategoryInfo(expense.category);
              const CategoryIcon = getIconComponent(category.icon);
              return (
                <div key={expense.id} className="p-4 md:p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: category.color + '20' }}>
                      <CategoryIcon size={22} style={{ color: category.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 truncate">{expense.vendor}</h3>
                        {expense.is_reconciled && (<span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">Reconciled</span>)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={12} />{new Date(expense.expense_date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Tag size={12} />{category.name}</span>
                        {expense.job_pack && (<span className="flex items-center gap-1 text-amber-600"><Building2 size={12} />{expense.job_pack.title}</span>)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900">£{expense.amount.toFixed(2)}</p>
                      {expense.vat_amount > 0 && (<p className="text-xs text-emerald-600 font-bold">+£{expense.vat_amount.toFixed(2)} VAT</p>)}
                    </div>
                    <button onClick={() => handleDelete(expense.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">Add Expense</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Scan Receipt (Optional)</label>
                {receiptPreview ? (
                  <div className="relative">
                    <img src={receiptPreview} className="w-full h-48 object-cover rounded-2xl" alt="Receipt" />
                    <button onClick={() => { setReceiptPreview(null); setReceiptFile(null); }} className="absolute top-2 right-2 p-2 bg-white rounded-full shadow"><X size={16} /></button>
                    {scanning && (<div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center"><div className="text-center text-white"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /><p className="text-sm font-bold">Scanning receipt...</p></div></div>)}
                    {/* Debug: Show if state updated */}
                    {formData.vendor && (
                      <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded-lg text-xs">
                        <strong>State updated:</strong> {formData.vendor} - £{formData.amount}
                      </div>
                    )}
                  </div>
                ) : (
                  <label htmlFor="receipt-file-input" className="w-full p-4 md:p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-amber-500 hover:bg-amber-50 transition-colors cursor-pointer block">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-600">Tap to scan receipt</p>
                    <p className="text-xs text-slate-400">AI will auto-fill the details</p>
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="col-span-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Vendor *</label>
                  {/* DEBUG: Show actual state value */}
                  {formData.vendor && <div className="text-xs text-green-600 mb-1">Value: "{formData.vendor}"</div>}
                  <input
                    ref={vendorInputRef}
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                    onFocus={() => formData.vendor.length >= 2 && vendorSuggestions.length > 0 && setShowVendorDropdown(true)}
                    placeholder="e.g. Screwfix, Travis Perkins"
                    className="w-full px-4 py-2 md:py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  {/* Vendor Autocomplete Dropdown */}
                  {showVendorDropdown && vendorSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {vendorSuggestions.map(v => (
                        <button
                          key={v.id}
                          onClick={() => selectVendor(v)}
                          className="w-full px-4 py-3 text-left hover:bg-amber-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{v.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                              {v.default_category && <span className="flex items-center gap-1"><Tag size={10} />{v.default_category}</span>}
                              <span className="flex items-center gap-1"><Clock size={10} />{v.expense_count} expenses</span>
                            </p>
                          </div>
                          <span className="text-sm font-bold text-slate-400">£{v.total_spent.toFixed(0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Category Suggestion */}
                  {suggestedCategory && !showVendorDropdown && (
                    <button onClick={applySuggestedCategory} className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm hover:bg-amber-100 transition-colors w-full">
                      <Sparkles size={16} className="text-amber-500" />
                      <span className="text-slate-700">Auto-categorize as <strong className="text-amber-600">{suggestedCategory.name}</strong>?</span>
                      <Check size={16} className="text-amber-500 ml-auto" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Amount (exc. VAT) *</label>
                  {/* DEBUG */}
                  {formData.amount && <div className="text-xs text-green-600 mb-1">Value: "£{formData.amount}"</div>}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">£</span>
                    <input ref={amountInputRef} type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00" className="w-full pl-8 pr-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">VAT Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">£</span>
                    <input ref={vatInputRef} type="number" step="0.01" value={formData.vat_amount} onChange={(e) => setFormData(prev => ({ ...prev, vat_amount: e.target.value }))}
                      placeholder="0.00" className="w-full pl-8 pr-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Date</label>
                  <input ref={dateInputRef} type="date" value={formData.expense_date} onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                    className="w-full px-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Payment Method</label>
                  <select value={formData.payment_method} onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                    {PAYMENT_METHODS.map(pm => (<option key={pm.id} value={pm.id}>{pm.label}</option>))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Category</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {categories.slice(0, 8).map(cat => {
                      const Icon = getIconComponent(cat.icon);
                      return (
                        <button key={cat.id || cat.name} type="button" onClick={() => setFormData(prev => ({ ...prev, category: cat.name }))}
                          className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center ${formData.category === cat.name ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <Icon size={20} className="mb-1 flex-shrink-0" style={{ color: formData.category === cat.name ? cat.color : '#94a3b8' }} />
                          <p className="text-[10px] font-bold uppercase text-center leading-tight break-words w-full" style={{ color: formData.category === cat.name ? cat.color : '#94a3b8' }}>{cat.name}</p>
                        </button>
                      );
                    })}
                  </div>
                  {categories.length > 8 && (
                    <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full mt-2 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                      {categories.map(cat => (<option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>))}
                    </select>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Link to Job (Optional)</label>
                  <select value={formData.job_pack_id} onChange={(e) => setFormData(prev => ({ ...prev, job_pack_id: e.target.value }))}
                    className="w-full px-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                    <option value="">No job linked</option>
                    {projects.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description (Optional)</label>
                  <textarea ref={descriptionInputRef} value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What was this expense for?" rows={2}
                    className="w-full px-4 py-2 md:py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-slate-100 flex gap-2 md:gap-3">
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 px-4 md:px-6 py-2 md:py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!formData.vendor || !formData.amount || saving}
                className="flex-1 px-4 md:px-6 py-2 md:py-3 bg-amber-500 text-slate-900 rounded-xl font-black hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={20} />}
                <span className="hidden sm:inline">Save Expense</span>
                <span className="sm:hidden">Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryManager isOpen={showCategoryManager} onClose={() => setShowCategoryManager(false)} onCategoriesChange={loadCategories} />
    </div>
  );
};
