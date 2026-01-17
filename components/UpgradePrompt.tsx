import React, { useState } from 'react';
import { Lock, Sparkles, X, Loader2 } from 'lucide-react';
import { redirectToCheckout } from '../src/lib/stripe';

interface UpgradePromptProps {
  resourceName: string;
  currentCount: number;
  limit: number;
  onClose: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  resourceName,
  currentCount,
  limit,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await redirectToCheckout('professional');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-2">
            <Lock size={32} className="text-amber-600" />
          </div>

          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Free Tier Limit Reached
          </h3>

          <p className="text-slate-600 text-sm">
            You've reached your limit of <span className="font-bold text-amber-600">{limit} {resourceName}</span> on the free tier.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 my-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Usage</span>
              <span className="text-xs font-bold text-slate-400">{currentCount} / {limit}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-amber-500 h-3 rounded-full transition-all"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-5 border border-amber-200">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Sparkles size={18} className="text-amber-600" />
              <span className="text-sm font-black text-amber-700 uppercase tracking-wider">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-amber-700/80">
              Get unlimited jobs, quotes, and invoices plus premium features like expense tracking and materials library.
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl p-3">{error}</p>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Upgrade Now
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-full bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
