import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { hapticTap, hapticSuccess } from '../hooks/useHaptic';

/**
 * Sticky action bar for mobile forms
 * Sticks above the bottom navigation
 */
interface MobileStickyActionsProps {
  children: ReactNode;
  className?: string;
}

export const MobileStickyActions: React.FC<MobileStickyActionsProps> = ({ children, className = '' }) => {
  return (
    <div className={`mobile-sticky-actions ${className}`}>
      {children}
    </div>
  );
};

/**
 * Mobile-optimized button with haptic feedback
 */
interface MobileButtonProps {
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  type = 'button',
}) => {
  const handleClick = () => {
    if (!disabled && !loading) {
      hapticTap();
      onClick?.();
    }
  };

  const baseClasses = 'min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95 transition-transform touch-target';

  const variantClasses = {
    primary: 'bg-teal-500 text-white shadow-lg shadow-teal-500/20 disabled:bg-teal-300',
    secondary: 'bg-white border-2 border-slate-200 text-slate-700 disabled:opacity-50',
    danger: 'bg-red-500 text-white shadow-lg shadow-red-500/20 disabled:bg-red-300',
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : null}
      {children}
    </button>
  );
};

/**
 * Pull to refresh container
 */
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, className = '' }) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance
      const distance = Math.min(diff * 0.5, 120);
      setPullDistance(distance);
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      hapticSuccess();

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={`pull-refresh-indicator ${pullDistance > 20 || isRefreshing ? 'visible' : ''} ${isRefreshing ? 'refreshing' : ''}`}
        style={{
          transform: isRefreshing
            ? undefined
            : `translateX(-50%) translateY(${Math.min(pullDistance, 70)}px)`
        }}
      >
        <RefreshCw size={20} />
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: isPulling && !isRefreshing ? `translateY(${pullDistance * 0.3}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Mobile-optimized form input
 */
interface MobileInputProps {
  type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'search' | 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  autoComplete?: string;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled = false,
  className = '',
  inputMode,
  autoComplete,
}) => {
  // Determine inputMode if not provided
  const getInputMode = () => {
    if (inputMode) return inputMode;
    switch (type) {
      case 'tel': return 'tel';
      case 'email': return 'email';
      case 'number': return 'decimal';
      case 'search': return 'search';
      default: return 'text';
    }
  };

  return (
    <div className={`space-y-0.5 ${className}`}>
      {label && (
        <label className="block text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider px-0.5">
          {label}
        </label>
      )}
      <input
        type={type}
        inputMode={getInputMode()}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full min-h-[38px] sm:min-h-[40px] bg-slate-50 border-2 rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 md:px-4 md:py-3
          text-sm font-bold text-slate-900 outline-none
          focus:border-teal-400 focus:bg-white
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-300' : 'border-slate-100'}
        `}
      />
      {error && (
        <p className="text-xs text-red-500 font-medium px-1">{error}</p>
      )}
    </div>
  );
};

/**
 * Mobile-optimized textarea
 */
interface MobileTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  className?: string;
}

export const MobileTextarea: React.FC<MobileTextareaProps> = ({
  value,
  onChange,
  placeholder,
  label,
  rows = 4,
  className = '',
}) => {
  return (
    <div className={`space-y-0.5 ${className}`}>
      {label && (
        <label className="block text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider px-0.5">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="
          w-full min-h-[60px] sm:min-h-[80px] md:min-h-[100px] bg-slate-50 border-2 border-slate-100 rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 md:px-4 md:py-3
          text-sm font-medium text-slate-900 outline-none resize-none
          focus:border-teal-400 focus:bg-white
        "
      />
    </div>
  );
};

/**
 * Floating Action Button
 */
interface FABProps {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
}

export const FAB: React.FC<FABProps> = ({ onClick, icon, label }) => {
  const handleClick = () => {
    hapticTap();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="fab"
      aria-label={label}
    >
      {icon}
    </button>
  );
};

/**
 * Mobile card wrapper with better spacing
 */
interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const MobileCard: React.FC<MobileCardProps> = ({ children, className = '', onClick }) => {
  const handleClick = () => {
    if (onClick) {
      hapticTap();
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        bg-white rounded-3xl border border-slate-200 p-4 md:p-6 shadow-sm
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/**
 * Quick action button for mobile home screen
 */
interface QuickActionProps {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  color: 'blue' | 'teal' | 'emerald' | 'purple' | 'red' | 'slate';
}

export const QuickAction: React.FC<QuickActionProps> = ({ onClick, icon, label, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500 shadow-blue-500/20',
    teal: 'bg-teal-500 shadow-teal-500/20',
    emerald: 'bg-emerald-500 shadow-emerald-500/20',
    purple: 'bg-purple-500 shadow-purple-500/20',
    red: 'bg-red-500 shadow-red-500/20',
    slate: 'bg-slate-900 shadow-slate-900/20',
  };

  const handleClick = () => {
    hapticTap();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex-shrink-0 flex items-center gap-3 text-white px-5 py-4 rounded-2xl
        shadow-lg active:scale-95 transition-transform min-h-[56px]
        ${colorClasses[color]}
      `}
    >
      {icon}
      <span className="font-black text-sm uppercase tracking-wide whitespace-nowrap">{label}</span>
    </button>
  );
};
