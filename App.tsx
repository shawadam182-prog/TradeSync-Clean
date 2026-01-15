import React, { useState, useMemo, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { JobPackList } from './components/JobPackList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useData } from './src/contexts/DataContext';
import { useAuth } from './src/contexts/AuthContext';
import { useToast } from './src/contexts/ToastContext';
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

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
  </div>
);

const App: React.FC = () => {
  const { signOut } = useAuth();
  const toast = useToast();
  const {
    customers, quotes, projects, schedule, settings,
    setCustomers, setSettings, updateSettings,
    addCustomer, deleteCustomer, saveQuote, updateQuote, updateQuoteStatus, deleteQuote,
    addProject, saveProject, deleteProject,
    addScheduleEntry, updateScheduleEntry, deleteScheduleEntry,
  } = useData();

  const [activeTab, setActiveTab] = useState<'home' | 'jobpacks' | 'quotes' | 'invoices' | 'customers' | 'settings' | 'view' | 'jobpack_detail' | 'quote_edit' | 'schedule' | 'expenses' | 'bank' | 'reconcile' | 'vat' | 'payables' | 'files' | 'materials'>('home');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleCreateQuote = (projectId?: string) => {
    setEditingQuoteId(null);
    setActiveProjectId(projectId || null);
    setActiveTab('quote_edit');
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

  const handleAddCustomer = async (customer: Customer) => {
    try { await addCustomer(customer); } catch (error) { console.error('Failed:', error); }
  };

  const handleUpdateQuoteStatus = async (id: string, status: Quote['status']) => {
    try { await updateQuoteStatus(id, status); } catch (error) { console.error('Failed:', error); }
  };

  const handleConvertToInvoice = async () => {
    if (!viewingQuoteId) return;
    const quote = quotes.find(q => q.id === viewingQuoteId);
    if (!quote) return;

    try {
      const invoiceQuote: Quote = {
        ...quote,
        id: '', // Will be generated
        type: 'invoice',
        status: 'draft',
        referenceNumber: undefined, // Will be auto-assigned
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveQuote(invoiceQuote);
      // Update original quote status to invoiced
      await updateQuoteStatus(viewingQuoteId, 'invoiced');
      setViewingQuoteId(saved.id);
      toast.success('Invoice Created', 'Quote converted to invoice');
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
        onNavigateToSchedule={() => setActiveTab('schedule')}
        onCreateJob={() => setActiveTab('jobpacks')}
        onCreateQuote={() => handleCreateQuote()}
        onLogExpense={() => setActiveTab('expenses')}
        onAddCustomer={() => setActiveTab('customers')}
      />}
      {activeTab === 'jobpacks' && <JobPackList projects={[...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} onOpenProject={openProject} onAddProject={handleAddProject} onAddCustomer={handleAddCustomer} />}

      <Suspense fallback={<PageLoader />}>
        {activeTab === 'schedule' && <ScheduleCalendar entries={schedule} projects={projects} customers={customers} onAddCustomer={handleAddCustomer} onAddEntry={addScheduleEntry} onUpdateEntry={updateScheduleEntry} onDeleteEntry={deleteScheduleEntry} />}
        {activeTab === 'jobpack_detail' && activeProjectId && (activeProject ? <JobPackView project={activeProject} customers={customers} quotes={quotes.filter(q => q.projectId === activeProjectId)} onSaveProject={handleSaveProject} onViewQuote={handleViewQuote} onCreateQuote={() => handleCreateQuote(activeProjectId)} onBack={() => setActiveTab('jobpacks')} onDeleteProject={deleteProject} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><AlertCircle size={48} className="text-amber-500 mb-4" /><p>Job Pack Not Found</p><button onClick={() => setActiveTab('jobpacks')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
        {activeTab === 'quotes' && <QuotesList quotes={[...quotes].filter(q => q.type === 'estimate' || q.type === 'quotation').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onEditQuote={handleEditQuote} onCreateQuote={() => handleCreateQuote()} onDeleteQuote={deleteQuote} />}
        {activeTab === 'invoices' && <InvoicesList quotes={[...quotes].filter(q => q.type === 'invoice').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onCreateInvoice={() => handleCreateQuote()} onDeleteInvoice={deleteQuote} />}
        {activeTab === 'expenses' && <ExpensesPage projects={projects} />}
        {activeTab === 'bank' && <BankImportPage />}
        {activeTab === 'reconcile' && <ReconciliationPage />}
        {activeTab === 'vat' && <VATSummaryPage />}
        {activeTab === 'payables' && <PayablesPage />}
        {activeTab === 'files' && <FilingCabinetPage />}
        {activeTab === 'materials' && <MaterialsLibrary onBack={() => setActiveTab('home')} />}
        {activeTab === 'customers' && <CustomerManager customers={customers} setCustomers={setCustomers} deleteCustomer={deleteCustomer} />}
        {activeTab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} onSave={updateSettings} />}
        {activeTab === 'quote_edit' && <QuoteCreator existingQuote={quotes.find(q => q.id === editingQuoteId)} projectId={activeProjectId || undefined} customers={customers} settings={settings} onSave={handleSaveQuote} onAddCustomer={handleAddCustomer} onCancel={() => activeProjectId ? setActiveTab('jobpack_detail') : setActiveTab('quotes')} />}
        {activeTab === 'view' && viewingQuoteId && (activeViewQuote ? <QuoteView quote={activeViewQuote} customer={activeViewCustomer || { id: 'unknown', name: 'Unassigned Client', email: '', phone: '', address: 'N/A' }} settings={settings} onEdit={() => handleEditQuote(viewingQuoteId)} onBack={() => activeProjectId ? setActiveTab('jobpack_detail') : (activeViewQuote.type === 'invoice' ? setActiveTab('invoices') : setActiveTab('quotes'))} onUpdateStatus={(status) => handleUpdateQuoteStatus(viewingQuoteId, status)} onUpdateQuote={handleUpdateQuote} onConvertToInvoice={handleConvertToInvoice} onDuplicate={handleDuplicateQuote} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><FileWarning size={48} className="text-amber-500 mb-4" /><p>Document Not Found</p><button onClick={() => setActiveTab('quotes')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
      </Suspense>
    </Layout>
  );
};

export default App;
