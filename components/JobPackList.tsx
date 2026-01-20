
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JobPack, Customer, TIER_LIMITS } from '../types';
import {
  FolderPlus, Search, Calendar, User, ArrowRight, Clock,
  CheckCircle2, AlertCircle, Loader2, UserPlus, X, Mic,
  MicOff, Sparkles, MapPinned, Mail, Phone, MapPin, Hammer, LocateFixed, Trash2
} from 'lucide-react';
import { parseCustomerVoiceInput, formatAddressAI, reverseGeocode } from '../src/services/geminiService';
import { useSubscription } from '../src/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { PageHeader } from './common/PageHeader';

interface JobPackListProps {
  projects: JobPack[];
  customers: Customer[];
  onOpenProject: (id: string) => void;
  onAddProject: (project: JobPack) => void;
  onAddCustomer: (customer: Customer) => Promise<Customer>;
  onDeleteProject?: (id: string) => Promise<void>;
  onBack?: () => void;
}

export const JobPackList: React.FC<JobPackListProps> = ({
  projects, customers, onOpenProject, onAddProject, onAddCustomer, onDeleteProject, onBack
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get subscription info for limit checking
  const subscription = useSubscription();
  const limits = subscription.usageLimits || TIER_LIMITS[subscription.tier];
  const jobPackLimit = limits.jobPacks;
  const currentJobPackCount = projects.length;
  const canCreateJobPack = jobPackLimit === null || currentJobPackCount < jobPackLimit;

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

  const handleQuickAddCustomer = async (e?: React.FormEvent | React.MouseEvent) => {
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

    try {
      const createdCustomer = await onAddCustomer(customer);
      setSelectedCustomer(createdCustomer.id);
      setIsAddingCustomer(false);
      setNewCustomer({});
      setCustomerError(null);
    } catch (error) {
      setCustomerError("Failed to create customer. Please try again.");
    }
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

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!onDeleteProject) return;
    if (!confirm('Delete this job pack? This cannot be undone.')) return;
    setDeletingId(projectId);
    try {
      await onDeleteProject(projectId);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAddresses = useMemo(() => {
    if (!addressSearchTerm || addressSearchTerm.length < 2) return [];
    const search = addressSearchTerm.toLowerCase();
    const allAddresses = Array.from(new Set(customers.map(c => c.address).filter(Boolean))) as string[];
    return allAddresses.filter(addr => addr.toLowerCase().includes(search)).slice(0, 5);
  }, [customers, addressSearchTerm]);

  return (
    <div className="space-y-3 md:space-y-6">
      <PageHeader
        title="Job Packs"
        subtitle="Organize site documentation by project."
        onBack={onBack}
        actions={
          <button
            onClick={() => {
              if (canCreateJobPack) {
                setIsAdding(true);
              } else {
                setShowUpgradePrompt(true);
              }
            }}
            className="bg-teal-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-teal-600 transition-all flex items-center gap-2"
          >
            <FolderPlus size={18} /> New Job Pack
            {jobPackLimit !== null && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {currentJobPackCount}/{jobPackLimit}
              </span>
            )}
          </button>
        }
      />

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 pb-28 md:pb-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-[32px] md:rounded-[48px] p-3 sm:p-5 md:p-8 lg:p-12 max-w-2xl w-full mx-2 max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95 duration-300">
            {isAddingCustomer ? (
              <div className="space-y-2 md:space-y-6 animate-in slide-in-from-right-4">
                <div className="flex justify-between items-center mb-2 md:mb-4">
                  <h3 className="font-black text-sm md:text-xl text-slate-900 uppercase tracking-tight">Register Client</h3>
                  <button
                    type="button"
                    onClick={() => startListening()}
                    disabled={isProcessing}
                    className={`flex items-center gap-1 px-3 py-1.5 md:px-6 md:py-3 rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all border ${
                      isListening && !activeFieldVoiceRef.current
                        ? 'bg-red-500 text-white border-red-600 animate-pulse'
                        : isProcessing
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
                    }`}
                  >
                    {isProcessing ? <Loader2 size={10} className="md:w-3 md:h-3 animate-spin" /> : isListening && !activeFieldVoiceRef.current ? <MicOff size={10} className="md:w-3 md:h-3" /> : <Sparkles size={10} className="md:w-3 md:h-3" />}
                    <span className="hidden sm:inline">{isProcessing ? 'Analyzing...' : isListening && !activeFieldVoiceRef.current ? 'Stop' : 'Voice'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-6">
                  {/* Name Field */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                      <User size={10} className="md:w-3 md:h-3" /> Full Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="name"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 md:px-4 md:py-3 pr-10 md:pr-12 text-slate-950 font-bold text-sm outline-none focus:bg-white focus:border-teal-500 transition-all"
                        value={newCustomer.name || ''}
                        placeholder="e.g. John Smith"
                        onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => startListening('name')}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${isListeningField === 'name' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                      >
                        <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>

                  {/* Company Field */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                      <Hammer size={10} className="md:w-3 md:h-3" /> Company Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="organization"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                        value={newCustomer.company || ''}
                        placeholder="e.g. Smith & Co Roofing"
                        onChange={e => setNewCustomer({...newCustomer, company: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => startListening('company')}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${isListeningField === 'company' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                      >
                        <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                      <Mail size={10} className="md:w-3 md:h-3" /> Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                        value={newCustomer.email || ''}
                        placeholder="john@example.com"
                        onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => startListening('email')}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${isListeningField === 'email' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                      >
                        <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 px-0.5">
                      <Phone size={10} className="md:w-3 md:h-3" /> Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-10 md:pr-12 text-slate-950 font-bold text-sm md:text-base outline-none focus:bg-white focus:border-teal-500 transition-all"
                        value={newCustomer.phone || ''}
                        placeholder="07123 456789"
                        onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => startListening('phone')}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg transition-all ${isListeningField === 'phone' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                      >
                        <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>

                  {/* Address Field */}
                  <div className="md:col-span-2 space-y-0.5 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 italic px-1">
                      <MapPin size={10} className="md:w-3 md:h-3" /> Main Site Address
                    </label>
                    <div className="relative">
                      <textarea
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 md:px-4 md:py-4 pr-28 md:pr-32 text-slate-950 font-bold text-sm outline-none min-h-[50px] md:min-h-[100px] focus:bg-white focus:border-teal-500 transition-all"
                        placeholder="Street, Town, Postcode..."
                        value={newCustomer.address || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setNewCustomer({...newCustomer, address: val});
                          setAddressSearchTerm(val);
                          setShowAddressSuggestions(true);
                        }}
                        onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                      />
                      <div className="absolute right-1 top-1 flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => startListening('address')}
                          className={`p-1 md:p-2 rounded-lg transition-all ${isListeningField === 'address' ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-teal-500 bg-transparent'}`}
                          title="Voice input"
                        >
                          <Mic size={14} className="md:w-[18px] md:h-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          disabled={isLocating}
                          className="p-1 md:p-2 rounded-lg transition-all text-blue-500 hover:text-blue-700 disabled:opacity-30 bg-transparent"
                          title="Use current location"
                        >
                          {isLocating ? <Loader2 size={14} className="md:w-[18px] md:h-[18px] animate-spin" /> : <LocateFixed size={14} className="md:w-[18px] md:h-[18px]" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyAddress}
                          disabled={!newCustomer.address || isVerifyingAddress}
                          className="p-1 md:p-2 rounded-lg transition-all text-amber-500 hover:text-amber-700 disabled:opacity-30 bg-transparent"
                          title="AI verify address"
                        >
                          {isVerifyingAddress ? <Loader2 size={14} className="md:w-[18px] md:h-[18px] animate-spin" /> : <MapPinned size={14} className="md:w-[18px] md:h-[18px]" />}
                        </button>
                      </div>
                    </div>
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
                  <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                    <AlertCircle size={18} />
                    <p className="text-xs font-bold uppercase tracking-widest">{customerError}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button onClick={(e) => handleQuickAddCustomer(e)} className="flex-1 bg-amber-500 text-white font-black py-5 rounded-[24px] hover:bg-amber-600 transition-all shadow-xl shadow-amber-200 uppercase tracking-widest text-xs">Register Contact</button>
                  <button onClick={() => { setIsAddingCustomer(false); setCustomerError(null); }} className="px-12 bg-slate-50 text-slate-500 font-black py-5 rounded-[24px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <h3 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight">Project Setup</h3>
                <div className="space-y-3 md:space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Project Title (Optional)</label>
                    <input className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl sm:rounded-[24px] p-3 sm:p-5 font-bold text-slate-950 text-sm sm:text-base focus:border-teal-400 focus:bg-white outline-none transition-all shadow-inner" placeholder="e.g. Miller - Extension" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Assign To Client *</label>
                    <div className="flex gap-2 items-stretch">
                      <select className="flex-1 min-w-0 border-2 border-slate-100 bg-slate-50 rounded-xl sm:rounded-[24px] p-3 sm:p-5 font-bold text-slate-950 text-sm sm:text-base focus:border-teal-400 focus:bg-white outline-none appearance-none cursor-pointer shadow-inner truncate" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                        <option value="">Select a client...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
                      </select>
                      <button onClick={() => { setIsAddingCustomer(true); setCustomerError(null); }} className="p-3 sm:p-5 bg-slate-900 text-amber-500 rounded-xl sm:rounded-[24px] hover:bg-black transition-all shadow-lg border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 flex-shrink-0"><UserPlus size={20} className="sm:w-6 sm:h-6" /></button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-4">
                    <button onClick={handleCreateProject} disabled={!selectedCustomer || isCreating} className="w-full bg-teal-500 text-white font-black py-4 sm:py-6 rounded-xl sm:rounded-[32px] hover:bg-teal-600 shadow-2xl shadow-teal-500/30 disabled:opacity-30 transition-all uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-3">
                      {isCreating ? <Loader2 className="animate-spin" size={18}/> : <FolderPlus size={18}/>}
                      Start Job Pack
                    </button>
                    <button onClick={() => { setIsAdding(false); setNewTitle(''); setSelectedCustomer(''); }} className="w-full bg-slate-50 text-slate-400 font-black py-4 sm:py-6 rounded-xl sm:rounded-[32px] hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
        <input type="text" placeholder="Search active projects..." className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-4 font-bold text-slate-900 focus:border-teal-200 outline-none shadow-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(project => (
          <div key={project.id} onClick={() => onOpenProject(project.id)} className="bg-white rounded-xl border border-slate-100 p-2.5 hover:border-teal-500 transition-all group cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{project.status}</div>
              <h3 className="flex-1 text-xs font-bold text-slate-900 group-hover:text-teal-600 transition-colors truncate">{project.title}</h3>
              <div className="flex items-center gap-1">
                {onDeleteProject && (
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    disabled={deletingId === project.id}
                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    {deletingId === project.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
                <div className="p-1 bg-slate-50 rounded-md group-hover:bg-teal-50 group-hover:text-teal-500 transition-colors">
                  <ArrowRight size={14} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
              <span className="flex items-center gap-1 font-medium truncate"><User size={10} className="text-slate-400 flex-shrink-0" />{customers.find(c => c.id === project.customerId)?.name || 'Unknown'}</span>
              <span className="flex items-center gap-1 text-slate-400"><Clock size={10} />{new Date(project.updatedAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-2 ml-auto text-[9px] text-slate-400">
                <span>{project.photos.length} photos</span>
                <span>{project.notes.length} notes</span>
                <span>{project.documents.length} docs</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade Prompt for Free Tier Limit */}
      {showUpgradePrompt && jobPackLimit !== null && (
        <UpgradePrompt
          resourceName="job packs"
          currentCount={currentJobPackCount}
          limit={jobPackLimit}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  );
};
