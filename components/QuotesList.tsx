
import React from 'react';
import { Quote, Customer, AppSettings, TIER_LIMITS } from '../types';
import { FileText, Plus, Eye, Search, Hash, User, ChevronRight, Trash2, Clock, Send, CheckCircle2, XCircle, ReceiptText } from 'lucide-react';
import { hapticTap } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';
import { useSubscription } from '../src/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { useData } from '../src/contexts/DataContext';
import { PageHeader } from './common/PageHeader';

interface QuotesListProps {
  quotes: Quote[];
  customers: Customer[];
  settings: AppSettings;
  onViewQuote: (id: string) => void;
  onEditQuote: (id: string) => void;
  onCreateQuote: () => void;
  onDeleteQuote?: (id: string) => Promise<void>;
  onBack?: () => void;
}

// Tab filter types for quotes
type QuoteFilterTab = 'all' | 'draft' | 'pending' | 'accepted' | 'declined';

export const QuotesList: React.FC<QuotesListProps> = ({
  quotes, customers, settings, onViewQuote, onEditQuote, onCreateQuote, onDeleteQuote, onBack
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<QuoteFilterTab>('all');
  const [showUpgradePrompt, setShowUpgradePrompt] = React.useState(false);
  const toast = useToast();

  // Get all quotes (estimates + quotations) for limit checking
  const { quotes: allQuotes } = useData();
  const subscription = useSubscription();
  const limits = subscription.usageLimits || TIER_LIMITS[subscription.tier];
  const quoteLimit = limits.quotes;
  const currentQuoteCount = allQuotes.filter(q => q.type === 'estimate' || q.type === 'quotation').length;
  const canCreateQuote = quoteLimit === null || currentQuoteCount < quoteLimit;

  const handleDelete = async (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation(); // Don't trigger row click
    hapticTap();

    const customer = customers.find(c => c.id === quote.customerId);
    if (window.confirm(`Delete quote "${quote.title}" for ${customer?.name || 'Unknown'}? This cannot be undone.`)) {
      try {
        await onDeleteQuote?.(quote.id);
        toast.success('Quote Deleted', `"${quote.title}" has been removed`);
      } catch (err) {
        toast.error('Delete Failed', 'Could not delete quote');
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

  // Filter by tab status first
  const filterByTab = (quote: Quote): boolean => {
    switch (activeTab) {
      case 'draft':
        return quote.status === 'draft';
      case 'pending':
        return quote.status === 'sent';
      case 'accepted':
        return quote.status === 'accepted' || quote.status === 'invoiced';
      case 'declined':
        return quote.status === 'declined';
      case 'all':
      default:
        return true;
    }
  };

  const filtered = quotes.filter(q => {
    // First apply tab filter
    if (!filterByTab(q)) return false;

    // Then apply search filter
    const searchLower = searchTerm.toLowerCase();
    const customer = customers.find(c => c.id === q.customerId);
    return (
      q.title.toLowerCase().includes(searchLower) ||
      (customer?.name?.toLowerCase().includes(searchLower) ?? false) ||
      (customer?.company?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  // Count quotes for each tab (for badges)
  const tabCounts = {
    all: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    pending: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted' || q.status === 'invoiced').length,
    declined: quotes.filter(q => q.status === 'declined').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates & Quotes"
        subtitle="Active project estimates and site proposals."
        onBack={onBack}
        actions={
          <button
            onClick={() => {
              if (canCreateQuote) {
                onCreateQuote();
              } else {
                setShowUpgradePrompt(true);
              }
            }}
            className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-teal-500/20"
          >
            <Plus size={18} />
            <span>New Estimate</span>
            {quoteLimit !== null && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {currentQuoteCount}/{quoteLimit}
              </span>
            )}
          </button>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {(['all', 'draft', 'pending', 'accepted', 'declined'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              hapticTap();
              setActiveTab(tab);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab
                ? tab === 'declined'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : tab === 'accepted'
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-200'
            }`}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab
                  ? 'bg-white/20'
                  : tab === 'declined' && tabCounts.declined > 0
                    ? 'bg-red-100 text-red-600'
                    : tab === 'accepted' && tabCounts.accepted > 0
                      ? 'bg-green-100 text-green-600'
                      : 'bg-slate-100'
              }`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search quotes or customers..."
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-teal-200 outline-none shadow-sm transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-100 opacity-60">
            <FileText size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm italic">
              {activeTab === 'all' && 'No quotes found.'}
              {activeTab === 'draft' && 'No draft quotes.'}
              {activeTab === 'pending' && 'No pending quotes.'}
              {activeTab === 'accepted' && 'No accepted quotes.'}
              {activeTab === 'declined' && 'No declined quotes.'}
            </p>
          </div>
        ) : (
          filtered.map((quote) => {
            const customer = customers.find(c => c.id === quote.customerId);
            const prefix = settings.quotePrefix || 'EST-';
            const numStr = (quote.referenceNumber || 1).toString().padStart(4, '0');
            const ref = `${prefix}${numStr}`;

            // Status badge configuration
            const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
              draft: { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Clock size={10} />, label: 'Draft' },
              sent: { bg: 'bg-blue-100', text: 'text-blue-600', icon: <Send size={10} />, label: 'Pending' },
              accepted: { bg: 'bg-green-100', text: 'text-green-600', icon: <CheckCircle2 size={10} />, label: 'Accepted' },
              declined: { bg: 'bg-red-100', text: 'text-red-600', icon: <XCircle size={10} />, label: 'Declined' },
              invoiced: { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: <ReceiptText size={10} />, label: 'Invoiced' },
            };
            const status = statusConfig[quote.status] || statusConfig.draft;

            return (
              <div
                key={quote.id}
                onClick={() => onViewQuote(quote.id)}
                className={`bg-white p-5 rounded-[28px] border-2 transition-all group cursor-pointer shadow-sm hover:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  quote.status === 'declined'
                    ? 'border-red-100 hover:border-red-300'
                    : quote.status === 'accepted'
                      ? 'border-green-100 hover:border-green-300'
                      : 'border-slate-100 hover:border-teal-500'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-slate-900 text-teal-500 text-xs font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Hash size={12} /> {ref}
                    </span>
                    <span className={`${status.bg} ${status.text} text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 uppercase`}>
                      {status.icon} {status.label}
                    </span>
                    <h3 className="font-black text-slate-900 text-lg leading-tight truncate group-hover:text-teal-600 transition-colors">
                      {quote.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold italic">
                    <div className="flex items-center gap-1.5 truncate">
                      <User size={14} className="text-slate-300" />
                      {customer?.name || 'Unknown Client'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                  <div className="flex flex-col items-start sm:items-end">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                      Estimate Total
                    </p>
                    <p className="font-black text-slate-900 text-sm md:text-xl tracking-tight">
                      £{calculateQuoteTotal(quote).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-xl transition-all border border-teal-100 group-hover:scale-105">
                      <Eye size={20} />
                    </div>
                    {onDeleteQuote && (
                      <button
                        onClick={(e) => handleDelete(e, quote)}
                        className="p-3 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Delete quote"
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
      {showUpgradePrompt && quoteLimit !== null && (
        <UpgradePrompt
          resourceName="quotes"
          currentCount={currentQuoteCount}
          limit={quoteLimit}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  );
};
