
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JobPack, Customer } from '../types';
import { 
  FolderPlus, Search, Calendar, User, ArrowRight, Clock, 
  CheckCircle2, AlertCircle, Loader2, UserPlus, X, Mic, 
  MicOff, Sparkles, MapPinned, Mail, Phone, MapPin, Hammer, LocateFixed
} from 'lucide-react';
import { parseCustomerVoiceInput, formatAddressAI, reverseGeocode } from '../src/services/geminiService';

interface JobPackListProps {
  projects: JobPack[];
  customers: Customer[];
  onOpenProject: (id: string) => void;
  onAddProject: (project: JobPack) => void;
  onAddCustomer: (customer: Customer) => void;
}

export const JobPackList: React.FC<JobPackListProps> = ({ 
  projects, customers, onOpenProject, onAddProject, onAddCustomer 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  // Quick Customer State
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [isListeningField, setIsListeningField] = useState<string | null>(null);
  const activeFieldVoiceRef = useRef<string | null>(null);

  // Autocomplete
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressSearchTerm, setAddressSearchTerm] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-GB';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        setIsListeningField(null);
        activeFieldVoiceRef.current = null;
      };
      recognition.onerror = () => {
        setIsListening(false);
        setIsListeningField(null);
        activeFieldVoiceRef.current = null;
      };

      recognition.onresult = async (event: any) => {
        if (!event.results?.[0]?.[0]?.transcript) return;
        const transcript = event.results[0][0].transcript;
        const targetField = activeFieldVoiceRef.current;

        if (targetField) {
          setNewCustomer(prev => ({ ...prev, [targetField]: transcript }));
        } else {
          setIsProcessing(true);
          setCustomerError(null);
          try {
            const details = await parseCustomerVoiceInput(transcript);
            setNewCustomer(prev => ({ ...prev, ...details }));
          } catch (err) {
            setCustomerError("Magic fill failed to parse your voice input.");
          } finally {
            setIsProcessing(false);
          }
        }
      };

      recognitionRef.current = recognition;
    }
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const filtered = projects.filter(project => {
    const customer = customers.find(c => c.id === project.customerId);
    const searchLower = searchTerm.toLowerCase();
    return (
      project.title.toLowerCase().includes(searchLower) ||
      (customer?.name?.toLowerCase().includes(searchLower) ?? false) ||
      (customer?.company?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const startListening = (fieldName?: string) => {
    setIsListeningField(fieldName || null);
    activeFieldVoiceRef.current = fieldName || null;
    try { recognitionRef.current?.start(); } catch (e) { setIsListening(false); }
  };

  const handleVerifyAddress = async () => {
    if (!newCustomer.address) return;
    setIsVerifyingAddress(true);
    setCustomerError(null);
    try {
      const formatted = await formatAddressAI(newCustomer.address);
      setNewCustomer(prev => ({ ...prev, address: formatted }));
    } catch (err) {
      setCustomerError("Address verification failed.");
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCustomerError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setCustomerError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            setNewCustomer(prev => ({ ...prev, address }));
            setAddressSearchTerm(address);
          } else {
            setCustomerError("Could not determine address from your location.");
          }
        } catch (err) {
          setCustomerError("Failed to geocode your location.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setCustomerError("Location access denied or unavailable.");
      }
    );
  };

  const handleQuickAddCustomer = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setCustomerError(null);

    if (!newCustomer.name?.trim()) {
      setCustomerError("Client name is required.");
      return;
    }

    const customer: Customer = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCustomer.name.trim(),
      email: newCustomer.email || '',
      phone: newCustomer.phone || '',
      address: newCustomer.address || '',
      company: newCustomer.company || '',
    };
    
    onAddCustomer(customer);
    setSelectedCustomer(customer.id);
    setIsAddingCustomer(false);
    setNewCustomer({});
    setCustomerError(null);
  };

  const handleCreateProject = () => {
    if (!selectedCustomer) return;
    setIsCreating(true);
    
    // Auto-generate title if none provided
    const finalTitle = newTitle.trim() || `Job Pack - ${new Date().toLocaleDateString('en-GB')}`;
    
    const project: JobPack = {
      id: Math.random().toString(36).substr(2, 9),
      title: finalTitle,
      customerId: selectedCustomer,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      photos: [],
      drawings: [],
      documents: []
    };
    onAddProject(project);
    setIsCreating(false);
    setIsAdding(false);
    setNewTitle('');
    setSelectedCustomer('');
  };

  const filteredAddresses = useMemo(() => {
    if (!addressSearchTerm || addressSearchTerm.length < 2) return [];
    const search = addressSearchTerm.toLowerCase();
    const allAddresses = Array.from(new Set(customers.map(c => c.address).filter(Boolean))) as string[];
    return allAddresses.filter(addr => addr.toLowerCase().includes(search)).slice(0, 5);
  }, [customers, addressSearchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Job Packs</h2>
          <p className="text-slate-500 font-medium text-sm italic">Organize site documentation by project.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-amber-600 transition-all flex items-center gap-2"><FolderPlus size={18} /> New Job Pack</button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 pb-28 md:pb-4 overflow-y-auto">
          <div className="bg-white rounded-[48px] p-8 md:p-12 max-w-2xl w-full shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95 duration-300">
            {isAddingCustomer ? (
              <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Register Client</h3>
                  </div>
                  <button onClick={() => { setIsAddingCustomer(false); setCustomerError(null); }} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                </div>

                <button 
                  type="button"
                  onClick={() => startListening()}
                  disabled={isProcessing}
                  className={`w-full flex items-center justify-center gap-3 p-5 rounded-3xl border-2 font-black uppercase text-xs tracking-widest transition-all ${
                    isListening && !activeFieldVoiceRef.current ? 'bg-red-500 text-white border-red-600 animate-pulse' : isProcessing ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                  }`}
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isProcessing ? 'Analyzing...' : isListening && !activeFieldVoiceRef.current ? 'Listening...' : 'Magic Fill (Voice)'}
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { id: 'name', label: 'Full Name *', icon: User, placeholder: 'e.g. John Smith' },
                    { id: 'company', label: 'Company', icon: Hammer, placeholder: 'Optional' },
                    { id: 'email', label: 'Email Address', icon: Mail, placeholder: 'john@example.com' },
                    { id: 'phone', label: 'Phone Number', icon: Phone, placeholder: '07123 456789' }
                  ].map(field => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 italic"><field.icon size={12}/> {field.label}</label>
                        <button type="button" onClick={() => startListening(field.id)} className={`p-1 rounded-md border transition-colors ${isListeningField === field.id ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-amber-500'}`}><Mic size={10}/></button>
                      </div>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner" value={(newCustomer as any)[field.id] || ''} onChange={e => setNewCustomer({...newCustomer, [field.id]: e.target.value})} placeholder={field.placeholder} />
                    </div>
                  ))}
                  <div className="md:col-span-2 space-y-1 relative">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 italic"><MapPin size={12}/> Site Address</label>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={handleUseCurrentLocation}
                          disabled={isLocating}
                          className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-30"
                        >
                          {isLocating ? <Loader2 size={10} className="animate-spin" /> : <LocateFixed size={12} />} Use Location
                        </button>
                        <button type="button" onClick={handleVerifyAddress} disabled={!newCustomer.address || isVerifyingAddress} className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-30">
                          {isVerifyingAddress ? <Loader2 size={10} className="animate-spin" /> : <MapPinned size={12} />} AI Verify
                        </button>
                      </div>
                    </div>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all min-h-[100px] shadow-inner" 
                      value={newCustomer.address || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewCustomer({...newCustomer, address: val});
                        setAddressSearchTerm(val);
                        setShowAddressSuggestions(true);
                      }} 
                      onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                      placeholder="Project location address..." 
                    />
                    {showAddressSuggestions && filteredAddresses.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-2 bg-white border-2 border-slate-100 rounded-[24px] shadow-2xl animate-in slide-in-from-top-2 overflow-hidden">
                        {filteredAddresses.map((addr, i) => (
                          <button 
                            key={i} 
                            type="button"
                            onClick={() => {
                              setNewCustomer(prev => ({ ...prev, address: addr }));
                              setShowAddressSuggestions(false);
                              setAddressSearchTerm('');
                            }}
                            className="w-full text-left p-4 hover:bg-amber-50 text-sm font-bold text-slate-900 border-b border-slate-50 last:border-0 flex items-center gap-3 transition-colors"
                          >
                            <MapPin size={14} className="text-amber-500" />
                            <span className="truncate">{addr}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {customerError && (
                  <div className="flex items-center gap-3 p-5 bg-red-50 text-red-600 rounded-3xl border border-red-100 animate-in slide-in-from-top-2">
                    <AlertCircle size={20} />
                    <p className="text-xs font-black uppercase tracking-widest italic">{customerError}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button onClick={(e) => handleQuickAddCustomer(e)} className="flex-1 bg-slate-900 text-white font-black py-6 rounded-[32px] shadow-xl hover:bg-black transition-all uppercase tracking-widest text-xs">Register Client</button>
                  <button onClick={() => { setIsAddingCustomer(false); setCustomerError(null); }} className="px-10 bg-slate-50 text-slate-500 font-black py-6 rounded-[32px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Back</button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Project Setup</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Project Title (Optional)</label>
                    <input className="w-full border-2 border-slate-100 bg-slate-50 rounded-[24px] p-5 font-bold text-slate-950 focus:border-amber-400 focus:bg-white outline-none transition-all shadow-inner" placeholder="e.g. Miller - Extension" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Assign To Client *</label>
                    <div className="flex gap-2">
                      <select className="flex-1 border-2 border-slate-100 bg-slate-50 rounded-[24px] p-5 font-bold text-slate-950 focus:border-amber-400 focus:bg-white outline-none appearance-none cursor-pointer shadow-inner" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                        <option value="">Select a client...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
                      </select>
                      <button onClick={() => { setIsAddingCustomer(true); setCustomerError(null); }} className="p-5 bg-slate-900 text-amber-500 rounded-[24px] hover:bg-black transition-all shadow-lg border-b-4 border-slate-950 active:translate-y-1 active:border-b-0"><UserPlus size={24} /></button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-4">
                    <button onClick={handleCreateProject} disabled={!selectedCustomer || isCreating} className="w-full bg-amber-500 text-white font-black py-6 rounded-[32px] hover:bg-amber-600 shadow-2xl shadow-amber-500/30 disabled:opacity-30 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                      {isCreating ? <Loader2 className="animate-spin" size={20}/> : <FolderPlus size={20}/>}
                      Start Job Pack
                    </button>
                    <button onClick={() => { setIsAdding(false); setNewTitle(''); setSelectedCustomer(''); }} className="w-full bg-slate-50 text-slate-400 font-black py-6 rounded-[32px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Search active projects..." className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-amber-200 outline-none shadow-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(project => (
          <div key={project.id} onClick={() => onOpenProject(project.id)} className="bg-white rounded-[32px] border-2 border-slate-100 p-7 hover:border-amber-500 transition-all group cursor-pointer shadow-sm hover:shadow-2xl relative overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-6"><div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{project.status}</div><div className="p-2 bg-slate-50 rounded-xl group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors"><ArrowRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" /></div></div>
            <h3 className="text-xl font-black text-slate-900 group-hover:text-amber-600 transition-colors mb-2 leading-tight">{project.title}</h3>
            <div className="space-y-3 mb-8"><div className="flex items-center gap-2 text-slate-500 text-xs font-bold italic"><User size={14} className="text-slate-400" /> <span className="truncate">{customers.find(c => c.id === project.customerId)?.name || 'Unknown Client'}</span></div><div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-tight"><Clock size={14} className="text-slate-400" /> Updated {new Date(project.updatedAt).toLocaleDateString()}</div></div>
            <div className="grid grid-cols-3 gap-3 mt-auto pt-6 border-t border-slate-50 text-center"><div className="bg-slate-50 rounded-2xl p-3"><p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Photos</p><p className="text-sm font-black text-slate-900">{project.photos.length}</p></div><div className="bg-slate-50 rounded-2xl p-3"><p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Notes</p><p className="text-sm font-black text-slate-900">{project.notes.length}</p></div><div className="bg-slate-50 rounded-2xl p-3"><p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Docs</p><p className="text-sm font-black text-slate-900">{project.documents.length}</p></div></div>
          </div>
        ))}
      </div>
    </div>
  );
};
