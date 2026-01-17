
import React from 'react';
import { Quote, Customer, AppSettings, TIER_LIMITS } from '../types';
import { FileText, Plus, Eye, Search, Hash, User, ChevronRight, Trash2 } from 'lucide-react';
import { hapticTap } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';
import { useSubscription } from '../src/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { useData } from '../src/contexts/DataContext';

interface QuotesListProps {
  quotes: Quote[];
  customers: Customer[];
  settings: AppSettings;
  onViewQuote: (id: string) => void;
  onEditQuote: (id: string) => void;
  onCreateQuote: () => void;
  onDeleteQuote?: (id: string) => Promise<void>;
}

export const QuotesList: React.FC<QuotesListProps> = ({
  quotes, customers, settings, onViewQuote, onEditQuote, onCreateQuote, onDeleteQuote
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estimates & Quotes</h2>
          <p className="text-slate-500 font-medium text-sm italic tracking-tight">Active project estimates and site proposals.</p>
        </div>
        <button
          onClick={() => {
            if (canCreateQuote) {
              onCreateQuote();
            } else {
              setShowUpgradePrompt(true);
            }
          }}
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-200"
        >
          <Plus size={18} />
          <span>New Estimate</span>
          {quoteLimit !== null && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {currentQuoteCount}/{quoteLimit}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search quotes or customers..." 
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-amber-200 outline-none shadow-sm transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-100 opacity-60">
            <FileText size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-sm italic">No matching quotes found.</p>
          </div>
        ) : (
          filtered.map((quote) => {
            const customer = customers.find(c => c.id === quote.customerId);
            const prefix = settings.quotePrefix || 'EST-';
            const numStr = (quote.referenceNumber || 1).toString().padStart(4, '0');
            const ref = `${prefix}${numStr}`;
            
            return (
              <div 
                key={quote.id} 
                onClick={() => onViewQuote(quote.id)}
                className="bg-white p-5 rounded-[28px] border-2 border-slate-100 hover:border-amber-500 transition-all group cursor-pointer shadow-sm hover:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-slate-900 text-amber-500 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Hash size={10} /> {ref}
                    </span>
                    <h3 className="font-black text-slate-900 text-lg leading-tight truncate group-hover:text-amber-600 transition-colors">
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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                      Estimate Total
                    </p>
                    <p className="font-black text-slate-900 text-sm md:text-xl tracking-tight">
                      £{calculateQuoteTotal(quote).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl transition-all border border-amber-100 group-hover:scale-105">
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
                    <div className="p-3 bg-white text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">
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
