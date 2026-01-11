
import React, { useState } from 'react';
import { Users, FileText, Settings, Hammer, Briefcase, ReceiptText, CalendarDays, Home, LogOut, Receipt, Landmark, Link2, Calculator, CreditCard, FolderOpen, ChevronDown, ChevronRight, Wallet, Building2, Cog, Package } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onSignOut?: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: { id: string; label: string; icon: any }[];
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onSignOut }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['work', 'money']));

  const navGroups: NavGroup[] = [
    {
      id: 'work',
      label: 'Work',
      icon: Briefcase,
      items: [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'jobpacks', label: 'Job Packs', icon: Briefcase },
        { id: 'schedule', label: 'Schedule', icon: CalendarDays },
      ]
    },
    {
      id: 'money',
      label: 'Money',
      icon: Wallet,
      items: [
        { id: 'quotes', label: 'Quotes', icon: FileText },
        { id: 'invoices', label: 'Invoices', icon: ReceiptText },
        { id: 'expenses', label: 'Expenses', icon: Receipt },
        { id: 'payables', label: 'Payables', icon: CreditCard },
      ]
    },
    {
      id: 'accounts',
      label: 'Accounts',
      icon: Building2,
      items: [
        { id: 'bank', label: 'Bank', icon: Landmark },
        { id: 'reconcile', label: 'Reconcile', icon: Link2 },
        { id: 'vat', label: 'VAT', icon: Calculator },
        { id: 'files', label: 'Files', icon: FolderOpen },
      ]
    },
    {
      id: 'setup',
      label: 'Setup',
      icon: Cog,
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'materials', label: 'Materials', icon: Package },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    },
  ];

  // Flat list for mobile nav
  const navItems = navGroups.flatMap(g => g.items);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const isActiveInGroup = (group: NavGroup) => group.items.some(item => item.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Hammer className="text-amber-500 w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight text-white">TradeMate<span className="text-amber-500">Pro</span></h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActiveInGroup(group) ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <group.icon size={16} />
                  <span className="font-bold text-xs uppercase tracking-wider">{group.label}</span>
                </div>
                {expandedGroups.has(group.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedGroups.has(group.id) && (
                <div className="mt-1 ml-2 space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === item.id
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon size={18} />
                      <span className="font-bold text-sm">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">{onSignOut && (<button onClick={onSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><LogOut size={20} /><span className="font-bold text-sm">Sign Out</span></button>)}
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-slate-900 text-xs">JS</div>
            <div className="text-sm">
              <p className="font-bold text-white">Main Contractor</p>
              <p className="text-slate-500 text-[10px] font-black uppercase">Standard Tier</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Nav - Horizontally Scrollable Fix */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] overflow-x-auto no-scrollbar shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex w-max gap-1 px-4 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-2 min-w-[72px] shrink-0 transition-all rounded-xl ${
                activeTab === item.id 
                  ? 'text-amber-600 bg-amber-50/50' 
                  : 'text-slate-400 active:bg-slate-50'
              }`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'scale-110 transition-transform' : ''} />
              <span className={`text-[9px] font-black uppercase tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-0 overflow-y-auto">
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-[50] shadow-md">
          <div className="flex items-center gap-2">
            <Hammer className="text-amber-500" size={24} />
            <span className="font-black text-lg tracking-tight">TradeMate<span className="text-amber-500">Pro</span></span>
          </div>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
