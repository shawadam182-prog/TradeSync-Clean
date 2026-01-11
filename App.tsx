import React, { useState, useMemo } from 'react';
import { Layout } from './components/Layout';
import { CustomerManager } from './components/CustomerManager';
import { QuoteCreator } from './components/QuoteCreator';
import { SettingsPage } from './components/SettingsPage';
import { QuoteView } from './components/QuoteView';
import { JobPackList } from './components/JobPackList';
import { JobPackView } from './components/JobPackView';
import { QuotesList } from './components/QuotesList';
import { InvoicesList } from './components/InvoicesList';
import { ScheduleCalendar } from './components/ScheduleCalendar';
import { Home } from './components/Home';
import { ExpensesPage } from './components/ExpensesPage';
import { BankImportPage } from './components/BankImportPage';
import { ReconciliationPage } from './components/ReconciliationPage';
import { VATSummaryPage } from './components/VATSummaryPage';
import { PayablesPage } from './components/PayablesPage';
import { FilingCabinetPage } from './components/FilingCabinetPage';
import { useData } from './src/contexts/DataContext';
import { useAuth } from './src/contexts/AuthContext';
import { Quote, JobPack, Customer } from './types';
import { AlertCircle, ArrowLeft, FileWarning } from 'lucide-react';

const App: React.FC = () => {
  const { signOut } = useAuth();
  const {
    customers, quotes, projects, schedule, settings,
    setCustomers, setScheduleEntries, setSettings, updateSettings,
    addCustomer, saveQuote, updateQuote, updateQuoteStatus,
    addProject, saveProject,
  } = useData();

  const [activeTab, setActiveTab] = useState<'home' | 'jobpacks' | 'quotes' | 'invoices' | 'customers' | 'settings' | 'view' | 'jobpack_detail' | 'quote_edit' | 'schedule' | 'expenses' | 'bank' | 'reconcile' | 'vat' | 'payables' | 'files'>('home');
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
    } catch (error) {
      console.error('Failed to save quote:', error);
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
    } catch (error) {
      console.error('Failed to convert to invoice:', error);
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
    } catch (error) {
      console.error('Failed to duplicate quote:', error);
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
      {activeTab === 'home' && <Home schedule={schedule} customers={customers} projects={projects} onNavigateToSchedule={() => setActiveTab('schedule')} />}
      {activeTab === 'jobpacks' && <JobPackList projects={[...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} onOpenProject={openProject} onAddProject={handleAddProject} onAddCustomer={handleAddCustomer} />}
      {activeTab === 'schedule' && <ScheduleCalendar entries={schedule} setEntries={setScheduleEntries} projects={projects} customers={customers} onAddCustomer={handleAddCustomer} />}
      {activeTab === 'jobpack_detail' && activeProjectId && (activeProject ? <JobPackView project={activeProject} customers={customers} quotes={quotes.filter(q => q.projectId === activeProjectId)} onSaveProject={handleSaveProject} onViewQuote={handleViewQuote} onCreateQuote={() => handleCreateQuote(activeProjectId)} onBack={() => setActiveTab('jobpacks')} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><AlertCircle size={48} className="text-amber-500 mb-4" /><p>Job Pack Not Found</p><button onClick={() => setActiveTab('jobpacks')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
      {activeTab === 'quotes' && <QuotesList quotes={[...quotes].filter(q => q.type === 'estimate' || q.type === 'quotation').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onEditQuote={handleEditQuote} onCreateQuote={() => handleCreateQuote()} />}
      {activeTab === 'invoices' && <InvoicesList quotes={[...quotes].filter(q => q.type === 'invoice').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())} customers={customers} settings={settings} onViewQuote={handleViewQuote} onCreateInvoice={() => handleCreateQuote()} />}
      {activeTab === 'expenses' && <ExpensesPage projects={projects} />}
      {activeTab === 'bank' && <BankImportPage />}
      {activeTab === 'reconcile' && <ReconciliationPage />}
      {activeTab === 'vat' && <VATSummaryPage />}
      {activeTab === 'payables' && <PayablesPage />}
      {activeTab === 'files' && <FilingCabinetPage />}
      {activeTab === 'customers' && <CustomerManager customers={customers} setCustomers={setCustomers} />}
      {activeTab === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} onSave={updateSettings} />}
      {activeTab === 'quote_edit' && <QuoteCreator existingQuote={quotes.find(q => q.id === editingQuoteId)} projectId={activeProjectId || undefined} customers={customers} settings={settings} onSave={handleSaveQuote} onAddCustomer={handleAddCustomer} onCancel={() => activeProjectId ? setActiveTab('jobpack_detail') : setActiveTab('quotes')} />}
      {activeTab === 'view' && viewingQuoteId && (activeViewQuote ? <QuoteView quote={activeViewQuote} customer={activeViewCustomer || { id: 'unknown', name: 'Unassigned Client', email: '', phone: '', address: 'N/A' }} settings={settings} onEdit={() => handleEditQuote(viewingQuoteId)} onBack={() => activeProjectId ? setActiveTab('jobpack_detail') : (activeViewQuote.type === 'invoice' ? setActiveTab('invoices') : setActiveTab('quotes'))} onUpdateStatus={(status) => handleUpdateQuoteStatus(viewingQuoteId, status)} onUpdateQuote={handleUpdateQuote} onConvertToInvoice={handleConvertToInvoice} onDuplicate={handleDuplicateQuote} /> : <div className="flex flex-col items-center justify-center py-20 text-slate-400"><FileWarning size={48} className="text-amber-500 mb-4" /><p>Document Not Found</p><button onClick={() => setActiveTab('quotes')} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded">Back</button></div>)}
    </Layout>
  );
};

export default App;
