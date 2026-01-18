import React, { useState, useMemo, Suspense, lazy, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { JobPackList } from './components/JobPackList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useData } from './src/contexts/DataContext';
import { useAuth } from './src/contexts/AuthContext';
import { useToast } from './src/contexts/ToastContext';
import { useHistoryNavigation } from './src/hooks/useHistoryNavigation';
import { Quote, JobPack, Customer } from './types';
import { AlertCircle, FileWarning, Loader2 } from 'lucide-react';

// Lazy loaded components for code splitting
const CustomerManager = lazy(() => import('./components/CustomerManager').then(m => ({ default: m.CustomerManager })));
const QuoteCreator = lazy(() => import('./components/QuoteCreator').then(m => ({ default: m.QuoteCreator })));
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const QuoteView = lazy(() => import('./components/QuoteView').then(m => ({ default: m.QuoteView })));
const JobPackView = lazy(() => import('./components/JobPackView').then(m => ({ default: m.JobPackView })));
const QuotesList = lazy(() => import('./components/QuotesList').then(m => ({ default: m.QuotesList })));
const InvoicesList = lazy(() => import('./components/InvoicesList').then(m => ({ default: m.InvoicesList })));
const ScheduleCalendar = lazy(() => import('./components/ScheduleCalendar').then(m => ({ default: m.ScheduleCalendar })));
const ExpensesPage = lazy(() => import('./components/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const BankImportPage = lazy(() => import('./components/BankImportPage').then(m => ({ default: m.BankImportPage })));
const ReconciliationPage = lazy(() => import('./components/ReconciliationPage').then(m => ({ default: m.ReconciliationPage })));
const VATSummaryPage = lazy(() => import('./components/VATSummaryPage').then(m => ({ default: m.VATSummaryPage })));
const PayablesPage = lazy(() => import('./components/PayablesPage').then(m => ({ default: m.PayablesPage })));
const FilingCabinetPage = lazy(() => import('./components/FilingCabinetPage').then(m => ({ default: m.FilingCabinetPage })));
const MaterialsLibrary = lazy(() => import('./components/MaterialsLibrary').then(m => ({ default: m.MaterialsLibrary })));
const WholesalerAdmin = lazy(() => import('./components/WholesalerAdmin').then(m => ({ default: m.WholesalerAdmin })));
const SupportRequestsAdmin = lazy(() => import('./components/SupportRequestsAdmin').then(m => ({ default: m.SupportRequestsAdmin })));
const FutureJobsPage = lazy(() => import('./components/FutureJobsPage').then(m => ({ default: m.FutureJobsPage })));

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
  </div>
);

// Tab type definition - matches navigation structure
type TabType =
  | 'home'
  | 'jobpacks'
  | 'quotes'
  | 'invoices'
  | 'customers'
  | 'schedule'
  | 'expenses'
  | 'materials'
  | 'files'
  | 'bank'
  | 'reconcile'
  | 'vat'
  | 'payables'
  | 'settings'
  | 'wholesalers'
  | 'support'
  | 'future_jobs'
  | 'view'
  | 'jobpack_detail'
  | 'quote_edit';

// Valid main tabs that can be restored after page reload (e.g., returning from camera)
const RESTORABLE_TABS: readonly TabType[] = ['home', 'jobpacks', 'quotes', 'invoices', 'customers', 'settings', 'schedule', 'expenses', 'bank', 'reconcile', 'vat', 'payables', 'files', 'materials', 'wholesalers', 'support', 'future_jobs'];
type RestorableTab = typeof RESTORABLE_TABS[number];

const App: React.FC = () => {
  const { signOut } = useAuth();
  const toast = useToast();
  const {
    customers, quotes, projects, schedule, settings,
    setCustomers, setSettings, updateSettings,
    addCustomer, updateCustomer, deleteCustomer, saveQuote, updateQuote, updateQuoteStatus, deleteQuote,
    addProject, saveProject, deleteProject,
    addScheduleEntry, updateScheduleEntry, deleteScheduleEntry,
    refresh,
  } = useData();

  // Restore tab from sessionStorage (handles iOS PWA state loss when camera opens)
  const getInitialTab = (): TabType => {
    try {
      const saved = sessionStorage.getItem('activeTab') as TabType | null;
      if (saved && RESTORABLE_TABS.includes(saved)) {
        return saved;
      }
    } catch (e) { /* sessionStorage not available */ }
    return 'home';
  };

  const [activeTab, setActiveTabState] = useState<TabType>(getInitialTab);

  // Wrapper to persist tab changes
  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    try {
      if (RESTORABLE_TABS.includes(tab as RestorableTab)) {
        sessionStorage.setItem('activeTab', tab);
      }
    } catch (e) { /* sessionStorage not available */ }
  };

  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [initialQuoteType, setInitialQuoteType] = useState<'estimate' | 'quotation' | 'invoice'>('estimate');

  // Handle browser back button navigation
  useHistoryNavigation({
    activeTab,
    activeProjectId,
    viewingQuoteId,
    setActiveTab: setActiveTab as (tab: string) => void,
    setActiveProjectId,
    setViewingQuoteId,
  });

  const handleCreateQuote = (projectId?: string) => {
    setEditingQuoteId(null);
    setActiveProjectId(projectId || null);
    setInitialQuoteType('estimate');
    setActiveTab('quote_edit');
  };

  const handleCreateInvoice = () => {
    setEditingQuoteId(null);
    setActiveProjectId(null);
    setInitialQuoteType('invoice');
    setActiveTab('quote_edit');
  };

  const handleTakePhoto = (jobPackId?: string) => {
    if (jobPackId) {
      // Navigate to existing job pack
      setActiveProjectId(jobPackId);
      setActiveTab('jobpack_detail');
    } else {
      // Navigate to job packs to create new one
      setActiveTab('jobpacks');
    }
  };

  const handleEditQuote = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    setEditingQuoteId(quoteId);
    setActiveProjectId(quote?.projectId || null);
    setActiveTab('quote_edit');
  };

  const handleViewQuote = (quoteId: string) => {
    setViewingQuoteId(quoteId);
    setActiveTab('view');
  };

  const handleSaveQuote = async (quote: Quote) => {
    try {
      const saved = await saveQuote(quote);
      setViewingQuoteId(saved.id);
      setActiveTab('view');
      toast.success('Quote Saved', quote.title);
    } catch (error) {
      console.error('Failed to save quote:', error);
      toast.error('Save Failed', 'Could not save quote');
    }
  };

  const handleUpdateQuote = async (updatedQuote: Quote) => {
    try { await updateQuote(updatedQuote); } catch (error) { console.error('Failed:', error); }
  };

  const handleSaveProject = async (project: JobPack) => {
    try { await saveProject(project); } catch (error) { console.error('Failed:', error); }
  };

  const handleAddCustomer = async (customer: Customer): Promise<Customer> => {
    try {
      return await addCustomer(customer);
    } catch (error) {
      console.error('Failed:', error);
      toast.error('Failed to Add', 'Could not create customer');
      throw error;
    }
  };

  const handleUpdateQuoteStatus = async (id: string, status: Quote['status']) => {
    try { await updateQuoteStatus(id, status); } catch (error) { console.error('Failed:', error); }
  };

  const handleConvertToInvoice = async () => {
    if (!viewingQuoteId) return;
    const quote = quotes.find(q => q.id === viewingQuoteId);
    if (!quote) return;

    try {
      // Calculate default due date (14 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const invoiceQuote: Quote = {
        ...quote,
        id: '', // Will be generated
        type: 'invoice',
        status: 'draft',
        referenceNumber: undefined, // Will be auto-assigned
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        parentQuoteId: quote.id, // Link back to original quote
        notes: settings.defaultInvoiceNotes || quote.notes, // Use invoice notes
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveQuote(invoiceQuote);
      // Update original quote status to invoiced
      await updateQuoteStatus(viewingQuoteId, 'invoiced');
      setViewingQuoteId(saved.id);
      toast.success('Invoice Created', 'Quote converted to invoice with 14-day payment terms');
    } catch (error) {
      console.error('Failed to convert to invoice:', error);
      toast.error('Conversion Failed', 'Could not create invoice');
    }
  };

  const handleDuplicateQuote = async () => {
    if (!viewingQuoteId) return;
    const quote = quotes.find(q => q.id === viewingQuoteId);
    if (!quote) return;

    try {
      const duplicatedQuote: Quote = {
        ...quote,
        id: '', // Will be generated
        title: `${quote.title} (Copy)`,
        status: 'draft',
        referenceNumber: undefined, // Will be auto-assigned
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveQuote(duplicatedQuote);
      setViewingQuoteId(saved.id);
      toast.info('Quote Duplicated', 'Created as new draft');
    } catch (error) {
      console.error('Failed to duplicate quote:', error);
      toast.error('Duplicate Failed', 'Could not copy quote');
    }
  };

  const openProject = (id: string) => {
    setActiveProjectId(id);
    setActiveTab('jobpack_detail');
  };

  const handleAddProject = async (project: JobPack) => {
    try {
      const created = await addProject({
        title: project.title, customerId: project.customerId, status: project.status,
        notepad: project.notepad, notes: [], photos: [], drawings: [], documents: [], materials: [],
      });
      openProject(created.id);
    } catch (error) { console.error('Failed:', error); }
  };

  const activeProject = useMemo(() => activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null, [projects, activeProjectId]);
  const activeViewQuote = useMemo(() => viewingQuoteId ? quotes.find(q => q.id === viewingQuoteId) : null, [quotes, viewingQuoteId]);
  const activeViewCustomer = useMemo(() => activeViewQuote ? customers.find(c => c.id === activeViewQuote.customerId) : null, [customers, activeViewQuote]);

  return (
    <Layout activeTab={activeTab === 'view' || activeTab === 'jobpack_detail' || activeTab === 'quote_edit' ? '' : activeTab} setActiveTab={setActiveTab} onSignOut={signOut}>
      {activeTab === 'home' && <Home
        schedule={schedule}
        customers={customers}
        projects={projects}
        quotes={quotes}
        settings={settings}
        onNavigateToSchedule={() => setActiveTab('schedule')}
        onNavigateToInvoices={() => setActiveTab('invoices')}
        onNavigateToQuotes={() => setActiveTab('quotes')}
        onNavigateToAccounting={() => setActiveTab('expenses')}
        onCreateJob={() => setActiveTab('jobpacks')}
        onCreateQuote={() => handleCreateQuote()}
        onCreateInvoice={handleCreateInvoice}
        onLogExpense={() => setActiveTab('expenses')}
        onAddCustomer={() => setActiveTab('customers')}
        onTakePhoto={handleTakePhoto}
        onViewJob={(jobId) => { setActiveProjectId(jobId); setActiveTab('jobpack_detail'); }}
        onAddProject={async (project) => {
          const created = await addProject({
            title: project.title || 'New Job',
            customerId: project.customerId,
            status: project.status || 'active',
            notepad: project.notepad || '',
            notes: [],
            photos: [],
            drawings: [],
            documents: [],
            materials: [],
          });
          return created;
        }}
        onRefresh={refresh}
        onNavigateToFutureJobs={() => setActiveTab('future_jobs')}
      />}
      {activeTab === 'jobpacks' && <JobPackList projects={[...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} onOpenProject={openProject} onAddProject={handleAddProject} onAddCustomer={handleAddCustomer} onBack={() => setActiveTab('home')} />}

      <Suspense fallback={<PageLoader />}>
        {activeTab === 'schedule' && <ScheduleCalendar entries={schedule} projects={projects} customers={customers} onAddCustomer={handleAddCustomer} onAddEntry={addScheduleEntry} onUpdateEntry={updateScheduleEntry} onDeleteEntry={deleteScheduleEntry} onBack={() => setActiveTab('home')} />}
        {activeTab === 'jobpack_detail' && activeProjectId && (activeProject ? <JobPackView key={activeProjectId} project={activeProject} customers={customers} quotes={quotes.filter(q => q.projectId === activeProjectId)} onSaveProject={handleSaveProject} onViewQuote={handleViewQuote} onCreateQuote={() => handleCreateQuote(activeProjectId)} onBack={() => setActiveTab('jobpacks')} onDeleteProject={deleteProject} onRefresh={refresh} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><AlertCircle size={48} className="text-teal-500 mb-4" /><p>Job Pack Not Found</p><button onClick={() => setActiveTab('jobpacks')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
        {activeTab === 'quotes' && <QuotesList quotes={[...quotes].filter(q => q.type === 'estimate' || q.type === 'quotation').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onEditQuote={handleEditQuote} onCreateQuote={() => handleCreateQuote()} onDeleteQuote={deleteQuote} onBack={() => setActiveTab('home')} />}
        {activeTab === 'invoices' && <InvoicesList quotes={[...quotes].filter(q => q.type === 'invoice').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onCreateInvoice={handleCreateInvoice} onDeleteInvoice={deleteQuote} onBack={() => setActiveTab('home')} />}
        {activeTab === 'expenses' && <ExpensesPage projects={projects} onBack={() => setActiveTab('home')} />}
        {activeTab === 'bank' && <BankImportPage onBack={() => setActiveTab('home')} />}
        {activeTab === 'reconcile' && <ReconciliationPage onBack={() => setActiveTab('home')} />}
        {activeTab === 'vat' && <VATSummaryPage onBack={() => setActiveTab('home')} />}
        {activeTab === 'payables' && <PayablesPage onBack={() => setActiveTab('home')} />}
        {activeTab === 'files' && <FilingCabinetPage onBack={() => setActiveTab('home')} />}
        {activeTab === 'materials' && <MaterialsLibrary onBack={() => setActiveTab('home')} />}
        {activeTab === 'wholesalers' && <WholesalerAdmin onBack={() => setActiveTab('home')} />}
        {activeTab === 'support' && <SupportRequestsAdmin onBack={() => setActiveTab('home')} />}
        {activeTab === 'future_jobs' && <FutureJobsPage onBack={() => setActiveTab('home')} onCreateJob={() => setActiveTab('jobpacks')} />}
        {activeTab === 'customers' && <CustomerManager customers={customers} addCustomer={addCustomer} updateCustomer={updateCustomer} deleteCustomer={deleteCustomer} onBack={() => setActiveTab('home')} />}
        {activeTab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} onSave={updateSettings} onBack={() => setActiveTab('home')} />}
        {activeTab === 'quote_edit' && <QuoteCreator existingQuote={quotes.find(q => q.id === editingQuoteId)} projectId={activeProjectId || undefined} initialType={initialQuoteType} customers={customers} settings={settings} onSave={handleSaveQuote} onAddCustomer={handleAddCustomer} onCancel={() => activeProjectId ? setActiveTab('jobpack_detail') : (initialQuoteType === 'invoice' ? setActiveTab('invoices') : setActiveTab('quotes'))} />}
        {activeTab === 'view' && viewingQuoteId && (activeViewQuote ? <QuoteView quote={activeViewQuote} customer={activeViewCustomer || { id: 'unknown', name: 'Unassigned Client', email: '', phone: '', address: 'N/A' }} settings={settings} onEdit={() => handleEditQuote(viewingQuoteId)} onBack={() => activeProjectId ? setActiveTab('jobpack_detail') : (activeViewQuote.type === 'invoice' ? setActiveTab('invoices') : setActiveTab('quotes'))} onUpdateStatus={(status) => handleUpdateQuoteStatus(viewingQuoteId, status)} onUpdateQuote={handleUpdateQuote} onConvertToInvoice={handleConvertToInvoice} onDuplicate={handleDuplicateQuote} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><FileWarning size={48} className="text-teal-500 mb-4" /><p>Document Not Found</p><button onClick={() => setActiveTab('quotes')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
      </Suspense>
    </Layout>
  );
};

export default App;
