import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2, Check, X, AlertCircle, Loader2, Search,
  Calendar, PoundSterling, ArrowRight, Sparkles,
  CheckCircle, Building2, Filter, RefreshCw
} from 'lucide-react';
import { bankTransactionsService, expensesService, quotesService } from '../src/services/dataService';

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  balance?: number;
  is_reconciled: boolean;
  reconciled_expense_id?: string;
  reconciled_invoice_id?: string;
}

interface Expense {
  id: string;
  vendor: string;
  amount: number;
  expense_date: string;
  is_reconciled: boolean;
  category: string;
}

interface Invoice {
  id: string;
  reference_number: number;
  total: number;
  updated_at: string;
  status: string;
  type: string;
}

interface SuggestedMatch {
  transaction: BankTransaction;
  expense?: Expense;
  invoice?: Invoice;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export const ReconciliationPage: React.FC = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestedMatch[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unreconciled' | 'reconciled'>('unreconciled');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, expData, quoteData] = await Promise.all([
        bankTransactionsService.getAll(),
        expensesService.getAll(),
        quotesService.getAll(),
      ]);
      setTransactions(txData || []);
      setExpenses(expData || []);
      // Filter to only paid invoices
      setInvoices((quoteData || []).filter((q: any) => q.type === 'invoice' && q.status === 'paid'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-match logic
  useEffect(() => {
    if (transactions.length === 0) return;

    const unreconciledTx = transactions.filter(tx => !tx.is_reconciled);
    const unreconciledExp = expenses.filter(exp => !exp.is_reconciled);

    const matches: SuggestedMatch[] = [];

    unreconciledTx.forEach(tx => {
      // For outgoing transactions (negative amounts), match with expenses
      if (tx.amount < 0) {
        const txAmount = Math.abs(tx.amount);
        const txDate = new Date(tx.transaction_date);

        // Find expenses with matching amount
        const matchingExpenses = unreconciledExp.filter(exp => {
          const expAmount = exp.amount;
          const expDate = new Date(exp.expense_date);
          const daysDiff = Math.abs((txDate.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));

          // Exact amount match within 7 days
          if (Math.abs(txAmount - expAmount) < 0.01 && daysDiff <= 7) {
            return true;
          }
          // Amount with VAT (20%) within 7 days
          const amountWithVat = expAmount * 1.2;
          if (Math.abs(txAmount - amountWithVat) < 0.01 && daysDiff <= 7) {
            return true;
          }
          return false;
        });

        if (matchingExpenses.length > 0) {
          const bestMatch = matchingExpenses[0];
          const daysDiff = Math.abs(
            (txDate.getTime() - new Date(bestMatch.expense_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const exactAmount = Math.abs(txAmount - bestMatch.amount) < 0.01;

          matches.push({
            transaction: tx,
            expense: bestMatch,
            confidence: exactAmount && daysDiff <= 2 ? 'high' : daysDiff <= 5 ? 'medium' : 'low',
            reason: exactAmount
              ? `Exact amount match (£${txAmount.toFixed(2)}), ${daysDiff.toFixed(0)} days apart`
              : `Amount with VAT match, ${daysDiff.toFixed(0)} days apart`,
          });
        }
      }

      // For incoming transactions (positive amounts), match with paid invoices
      if (tx.amount > 0) {
        const txAmount = tx.amount;
        const txDate = new Date(tx.transaction_date);

        const matchingInvoices = invoices.filter(inv => {
          const invAmount = inv.total;
          const invDate = new Date(inv.updated_at);
          const daysDiff = Math.abs((txDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

          return Math.abs(txAmount - invAmount) < 0.01 && daysDiff <= 30;
        });

        if (matchingInvoices.length > 0) {
          const bestMatch = matchingInvoices[0];
          const daysDiff = Math.abs(
            (txDate.getTime() - new Date(bestMatch.updated_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          matches.push({
            transaction: tx,
            invoice: bestMatch,
            confidence: daysDiff <= 7 ? 'high' : daysDiff <= 14 ? 'medium' : 'low',
            reason: `Invoice #${bestMatch.reference_number} (£${bestMatch.total.toFixed(2)}), ${daysDiff.toFixed(0)} days apart`,
          });
        }
      }
    });

    setSuggestions(matches);
  }, [transactions, expenses, invoices]);

  const handleAcceptMatch = async (suggestion: SuggestedMatch) => {
    setProcessing(suggestion.transaction.id);
    try {
      if (suggestion.expense) {
        await bankTransactionsService.reconcileWithExpense(
          suggestion.transaction.id,
          suggestion.expense.id
        );
      } else if (suggestion.invoice) {
        await bankTransactionsService.reconcileWithInvoice(
          suggestion.transaction.id,
          suggestion.invoice.id
        );
      }
      await loadData();
    } catch (error) {
      console.error('Failed to reconcile:', error);
    } finally {
      setProcessing(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filter === 'unreconciled' && tx.is_reconciled) return false;
      if (filter === 'reconciled' && !tx.is_reconciled) return false;
      if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filter, searchTerm]);

  const stats = useMemo(() => {
    const total = transactions.length;
    const reconciled = transactions.filter(tx => tx.is_reconciled).length;
    const pending = total - reconciled;
    const suggestedCount = suggestions.length;
    return { total, reconciled, pending, suggestedCount };
  }, [transactions, suggestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reconciliation</h1>
          <p className="text-slate-500 text-sm font-medium">Match bank transactions with expenses and invoices</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Transactions</p>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reconciled</p>
          <p className="text-2xl font-black text-emerald-600">{stats.reconciled}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
          <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Suggested Matches</p>
          <p className="text-2xl font-black text-blue-600">{stats.suggestedCount}</p>
        </div>
      </div>

      {/* Suggested Matches */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-900">Smart Matches Found</h2>
              <p className="text-sm text-slate-600">Review and accept suggested reconciliations</p>
            </div>
          </div>

          <div className="space-y-3">
            {suggestions.slice(0, 5).map((suggestion, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 border border-blue-100 flex flex-col md:flex-row md:items-center gap-4"
              >
                {/* Transaction */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-bold mb-1">Bank Transaction</p>
                  <p className="font-bold text-slate-900 truncate">{suggestion.transaction.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>{new Date(suggestion.transaction.transaction_date).toLocaleDateString()}</span>
                    <span className={`font-bold ${suggestion.transaction.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {suggestion.transaction.amount < 0 ? '-' : '+'}£{Math.abs(suggestion.transaction.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                <ArrowRight className="text-slate-300 hidden md:block" size={20} />

                {/* Match */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-bold mb-1">
                    {suggestion.expense ? 'Expense' : 'Invoice'}
                  </p>
                  {suggestion.expense && (
                    <>
                      <p className="font-bold text-slate-900 truncate">{suggestion.expense.vendor}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{new Date(suggestion.expense.expense_date).toLocaleDateString()}</span>
                        <span className="font-bold text-slate-700">£{suggestion.expense.amount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {suggestion.invoice && (
                    <>
                      <p className="font-bold text-slate-900">Invoice #{suggestion.invoice.reference_number}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="font-bold text-slate-700">£{suggestion.invoice.total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Confidence & Actions */}
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    suggestion.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                    suggestion.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {suggestion.confidence}
                  </span>
                  <button
                    onClick={() => handleAcceptMatch(suggestion)}
                    disabled={processing === suggestion.transaction.id}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {processing === suggestion.transaction.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check size={20} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {suggestions.length > 5 && (
            <p className="text-center text-sm text-blue-600 font-bold mt-4">
              +{suggestions.length - 5} more matches available
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'unreconciled', 'reconciled'] as const).map(f => (
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

      {/* Transactions List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">
              {filter === 'unreconciled' ? 'All transactions reconciled!' : 'No transactions found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map(tx => (
              <div key={tx.id} className="p-4 md:p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.is_reconciled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {tx.is_reconciled ? <Link2 size={18} /> : <PoundSterling size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{tx.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </span>
                      {tx.is_reconciled && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-black text-[10px] uppercase">
                          Reconciled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-right font-black ${tx.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {tx.amount < 0 ? '-' : '+'}£{Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
