
import React from 'react';
import { Quote, Customer, AppSettings, TIER_LIMITS } from '../types';
import { ReceiptText, Eye, Search, CheckCircle2, AlertCircle, Plus, Hash, User, ChevronRight, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { hapticTap } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';
import { useSubscription } from '../src/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { useData } from '../src/contexts/DataContext';
import { PageHeader } from './common/PageHeader';

// Helper functions for overdue detection
const isOverdue = (invoice: Quote): boolean => {
  if (invoice.status === 'paid' || invoice.status === 'draft') return false;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate) < new Date();
};

const getDaysOverdue = (invoice: Quote): number => {
  if (!invoice.dueDate) return 0;
  const diff = new Date().getTime() - new Date(invoice.dueDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getDaysUntilDue = (invoice: Quote): number => {
  if (!invoice.dueDate) return 0;
  const diff = new Date(invoice.dueDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

interface InvoicesListProps {
  quotes: Quote[];
  customers: Customer[];
  settings: AppSettings;
  onViewQuote: (id: string) => void;
  onCreateInvoice: () => void;
  onDeleteInvoice?: (id: string) => Promise<void>;
  onBack?: () => void;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({
  quotes, customers, settings, onViewQuote, onCreateInvoice, onDeleteInvoice, onBack
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = React.useState(false);
  const toast = useToast();

  // Get all invoices for limit checking
  const { quotes: allQuotes } = useData();
  const subscription = useSubscription();
  const limits = subscription.usageLimits || TIER_LIMITS[subscription.tier];
  const invoiceLimit = limits.invoices;
  const currentInvoiceCount = allQuotes.filter(q => q.type === 'invoice').length;
  const canCreateInvoice = invoiceLimit === null || currentInvoiceCount < invoiceLimit;

  const handleDelete = async (e: React.MouseEvent, invoice: Quote) => {
    e.stopPropagation();
    hapticTap();

    const customer = customers.find(c => c.id === invoice.customerId);
    if (window.confirm(`Delete invoice "${invoice.title}" for ${customer?.name || 'Unknown'}? This cannot be undone.`)) {
      try {
        await onDeleteInvoice?.(invoice.id);
        toast.success('Invoice Deleted', `"${invoice.title}" has been removed`);
      } catch (err) {
        toast.error('Delete Failed', 'Could not delete invoice');
      }
    }
  };

  const calculateQuoteTotal = (quote: Quote) => {
    // Fix: Aggregate totals from all sections instead of accessing items directly on the quote
    const sections = quote.sections || [];
    const materialsTotal = sections.reduce((sum, section) => 
      sum + (section.items || []).reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0), 0);
    const labourHoursTotal = sections.reduce((sum, section) => sum + (section.labourHours || 0), 0);
    const labourTotal = labourHoursTotal * (quote.labourRate || 0);
    
    const subtotal = materialsTotal + labourTotal;
    const markup = subtotal * (quote.markupPercent / 100);
    const tax = (subtotal + markup) * (quote.taxPercent / 100);
    return subtotal + markup + tax;
  };

  const filtered = quotes.filter(q => {
    const searchLower = searchTerm.toLowerCase();
    const customer = customers.find(c => c.id === q.customerId);
    return (
      q.title.toLowerCase().includes(searchLower) ||
      (customer?.name?.toLowerCase().includes(searchLower) ?? false) ||
      (customer?.company?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Final Invoices"
        subtitle="Billed jobs and financial history."
        onBack={onBack}
        actions={
          <button
            onClick={() => {
              if (canCreateInvoice) {
                onCreateInvoice();
              } else {
                setShowUpgradePrompt(true);
              }
            }}
            className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-teal-500/20"
          >
            <Plus size={18} />
            <span>New Invoice</span>
            {invoiceLimit !== null && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {currentInvoiceCount}/{invoiceLimit}
              </span>
            )}
          </button>
        }
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search invoices..." 
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-teal-200 outline-none shadow-sm transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-100 opacity-60">
            <ReceiptText size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm italic">No invoices recorded yet.</p>
          </div>
        ) : (
          filtered.map((invoice) => {
            const customer = customers.find(c => c.id === invoice.customerId);
            const prefix = settings.invoicePrefix || 'INV-';
            const numStr = (invoice.referenceNumber || 1).toString().padStart(4, '0');
            const ref = `${prefix}${numStr}`;
            const isPaid = invoice.status === 'paid';
            const overdue = isOverdue(invoice);
            const daysOverdue = getDaysOverdue(invoice);
            const daysUntilDue = getDaysUntilDue(invoice);

            return (
              <div
                key={invoice.id}
                onClick={() => onViewQuote(invoice.id)}
                className={`bg-white p-5 rounded-[28px] border-2 transition-all group cursor-pointer shadow-sm hover:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  overdue
                    ? 'border-red-200 hover:border-red-400 bg-red-50/30'
                    : 'border-slate-100 hover:border-teal-500'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-teal-500 text-white text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Hash size={12} /> {ref}
                    </span>
                    {overdue && (
                      <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 animate-pulse">
                        <AlertTriangle size={12} /> {daysOverdue} {daysOverdue === 1 ? 'DAY' : 'DAYS'} OVERDUE
                      </span>
                    )}
                    <h3 className={`font-black text-lg leading-tight truncate transition-colors ${
                      overdue ? 'text-red-700 group-hover:text-red-600' : 'text-slate-900 group-hover:text-teal-600'
                    }`}>
                      {invoice.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold italic flex-wrap">
                    <div className="flex items-center gap-1.5 truncate">
                      <User size={14} className="text-slate-300" />
                      {customer?.name || 'Unknown'}
                      {customer?.company && <span className="text-teal-600 text-[10px] font-black uppercase not-italic ml-1">({customer.company})</span>}
                    </div>
                    {invoice.dueDate && !isPaid && (
                      <div className={`flex items-center gap-1 text-xs font-black uppercase not-italic ${
                        overdue ? 'text-red-500' : daysUntilDue <= 7 ? 'text-teal-500' : 'text-slate-400'
                      }`}>
                        <Clock size={14} />
                        {overdue
                          ? `Was due ${new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                          : `Due ${new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${daysUntilDue}d)`
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                  <div className="flex flex-col items-start sm:items-end">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest mb-1 ${
                      isPaid
                        ? 'bg-teal-100 text-teal-700'
                        : overdue
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}>
                      {isPaid ? <CheckCircle2 size={12}/> : overdue ? <AlertTriangle size={12}/> : <AlertCircle size={12}/>}
                      {overdue ? 'OVERDUE' : invoice.status}
                    </div>
                    <p className={`font-black text-sm md:text-xl tracking-tight ${overdue ? 'text-red-700' : 'text-slate-900'}`}>
                      £{calculateQuoteTotal(invoice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-xl transition-all border border-teal-100 group-hover:scale-105">
                      <Eye size={20} />
                    </div>
                    {onDeleteInvoice && (
                      <button
                        onClick={(e) => handleDelete(e, invoice)}
                        className="p-3 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Delete invoice"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <div className="p-3 bg-white text-slate-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upgrade Prompt for Free Tier Limit */}
      {showUpgradePrompt && invoiceLimit !== null && (
        <UpgradePrompt
          resourceName="invoices"
          currentCount={currentInvoiceCount}
          limit={invoiceLimit}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  );
};
