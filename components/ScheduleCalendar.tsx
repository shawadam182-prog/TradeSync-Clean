
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ScheduleEntry, JobPack, Customer } from '../types';
import {
  ChevronLeft, ChevronRight, Plus, Mic, Sparkles,
  Trash2, MapPin, Clock, Loader2,
  AlertCircle, X, Calendar as CalendarIcon,
  ChevronDown, MicOff,
  LayoutGrid, List,
  Pencil, CheckCircle2, CalendarRange, ArrowRight,
  UserPlus, User, Mail, Phone, Hammer, MapPinned, LocateFixed,
  Briefcase, Link2
} from 'lucide-react';
import { parseScheduleVoiceInput, parseCustomerVoiceInput, formatAddressAI, reverseGeocode } from '../src/services/geminiService';
import { hapticTap } from '../src/hooks/useHaptic';

interface ScheduleCalendarProps {
  entries: ScheduleEntry[];
  projects: JobPack[];
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onAddEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<ScheduleEntry>;
  onUpdateEntry: (id: string, updates: Partial<ScheduleEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  entries,
  projects,
  customers,
  onAddCustomer,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ScheduleEntry>>({});

  // Customer Quick Add States
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});
  const [isListeningCustomer, setIsListeningCustomer] = useState(false);
  const [isProcessingCustomer, setIsProcessingCustomer] = useState(false);
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Schedule entry location and linking
  const [isLocatingEntry, setIsLocatingEntry] = useState(false);
  const [linkType, setLinkType] = useState<'none' | 'job' | 'customer'>('none');

  const recognitionRef = useRef<any>(null);
  const customerRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-GB';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = async (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          handleVoiceBooking(event.results[0][0].transcript);
        }
      };
      recognitionRef.current = recognition;

      // Customer Recognition
      const custRec = new SpeechRecognition();
      custRec.continuous = false;
      custRec.lang = 'en-GB';
      custRec.onstart = () => setIsListeningCustomer(true);
      custRec.onend = () => setIsListeningCustomer(false);
      custRec.onerror = () => setIsListeningCustomer(false);
      custRec.onresult = async (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          handleVoiceCustomer(event.results[0][0].transcript);
        }
      };
      customerRecognitionRef.current = custRec;
    }
    return () => {
      recognitionRef.current?.abort();
      customerRecognitionRef.current?.abort();
    };
  }, []);

  const handleVoiceBooking = async (transcript: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const parsed = await parseScheduleVoiceInput(transcript);
      setDraft(parsed);
      setIsReviewingAI(true);
    } catch (err) {
      setError("AI was unable to interpret that. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceCustomer = async (transcript: string) => {
    setIsProcessingCustomer(true);
    setCustomerError(null);
    try {
      const details = await parseCustomerVoiceInput(transcript);
      setNewCustomer(prev => ({ ...prev, ...details }));
    } catch (err) {
      setCustomerError("Magic fill failed to parse client info.");
    } finally {
      setIsProcessingCustomer(false);
    }
  };

  const handleVerifyAddress = async () => {
    if (!newCustomer.address) return;
    setIsVerifyingAddress(true);
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

  const saveQuickCustomer = () => {
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
    setDraft(prev => ({ ...prev, customerId: customer.id }));
    setIsAddingCustomer(false);
    setNewCustomer({});
    setCustomerError(null);
  };

  // Get current location for schedule entry
  const handleUseLocationForEntry = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocatingEntry(true);
    setError(null);
    hapticTap();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            setDraft(prev => ({ ...prev, location: address }));
          } else {
            setError("Could not determine address from your location.");
          }
        } catch (err) {
          setError("Failed to geocode your location.");
        } finally {
          setIsLocatingEntry(false);
        }
      },
      (err) => {
        setIsLocatingEntry(false);
        setError("Location access denied or unavailable.");
      }
    );
  };

  // Handle linking to job pack
  const handleLinkToJob = (jobId: string) => {
    const job = projects.find(p => p.id === jobId);
    if (job) {
      setDraft(prev => ({
        ...prev,
        projectId: jobId,
        customerId: job.customerId,
        title: prev.title || job.title,
        location: prev.location || job.siteAddress || customers.find(c => c.id === job.customerId)?.address || '',
      }));
      setLinkType('job');
    }
  };

  const handleEdit = (entry: ScheduleEntry) => {
    setDraft(entry);
    setEditingId(entry.id);
    setIsAddingManual(true);
    // Set link type based on existing entry data
    if ((entry as any).projectId) {
      setLinkType('job');
    } else if (entry.customerId) {
      setLinkType('customer');
    } else {
      setLinkType('none');
    }
  };

  const saveEntry = async () => {
    if (!draft.title || !draft.start) {
      setError("Title and start date are required.");
      return;
    }

    const entryData = {
      title: draft.title,
      start: draft.start,
      end: draft.end || new Date(new Date(draft.start).getTime() + 3600000).toISOString(),
      location: draft.location,
      customerId: draft.customerId,
      projectId: (draft as any).projectId,
      description: draft.description
    };

    try {
      if (editingId) {
        await onUpdateEntry(editingId, entryData);
      } else {
        await onAddEntry(entryData);
      }

      setIsReviewingAI(false);
      setIsAddingManual(false);
      setEditingId(null);
      setDraft({});
      setError(null);
      setLinkType('none');

      setSelectedDay(new Date(entryData.start));
      setViewType('day');
    } catch (err) {
      setError("Failed to save entry. Please try again.");
    }
  };

  const getDayEntries = (date: Date) => 
    entries.filter(e => new Date(e.start).toDateString() === date.toDateString())
           .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMo = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    for (let i = 0; i < offset; i++) days.push(null);
    for (let i = 1; i <= daysInMo; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [currentDate]);

  const daysInWeek = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(curr); startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewType === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewType === 'week') d.setDate(d.getDate() - 7);
    else {
      d.setDate(d.getDate() - 1);
      setSelectedDay(new Date(d));
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewType === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewType === 'week') d.setDate(d.getDate() + 7);
    else {
      d.setDate(d.getDate() + 1);
      setSelectedDay(new Date(d));
    }
    setCurrentDate(d);
  };

  const selectedCustomer = customers.find(c => c.id === draft.customerId);

  return (
    <div className="space-y-6 max-w-full mx-auto pb-12 px-2 md:px-6">
      {/* Streamlined Pro Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Site Diary</h2>
          <p className="text-slate-500 font-medium italic mt-3">Professional resource and project site allocation.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 p-1.5 rounded-2xl flex shadow-xl">
            {[
              { id: 'month', icon: LayoutGrid, label: 'Month' },
              { id: 'week', icon: CalendarRange, label: 'Week' },
              { id: 'day', icon: List, label: 'Today' }
            ].map((view) => (
              <button 
                key={view.id}
                onClick={() => {
                  if (view.id === 'day') {
                    setSelectedDay(new Date());
                    setCurrentDate(new Date());
                  }
                  setViewType(view.id as any);
                }}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewType === view.id ? 'bg-amber-500 text-slate-900 shadow-xl scale-105' : 'text-slate-400 hover:text-white'}`}
              >
                <view.icon size={14} /> {view.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => { setDraft({ start: new Date().toISOString() }); setIsAddingManual(true); }}
            className="h-12 px-6 rounded-2xl flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:border-amber-400 transition-all shadow-sm"
          >
            <Plus size={18} /> Book Site
          </button>

          <button 
            onClick={() => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start()}
            disabled={isProcessing}
            className={`h-12 px-6 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${
              isListening ? 'bg-red-500 text-white animate-pulse' : isProcessing ? 'bg-amber-500 text-white' : 'bg-slate-100 text-amber-600 hover:bg-white border-2 border-transparent hover:border-amber-400'
            }`}
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            {isProcessing ? 'Analysing' : isListening ? 'Listening' : 'Voice'}
          </button>
        </div>
      </div>

      {/* Main Container - Space Savvy UI */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-[700px] relative">
        
        {/* Navigation Bar */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/30 gap-6">
          <div className="flex items-center gap-6">
            <div className="flex gap-2">
              <button onClick={handlePrev} className="h-12 w-12 flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95"><ChevronLeft size={24} className="text-slate-900" /></button>
              <button onClick={handleNext} className="h-12 w-12 flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95"><ChevronRight size={24} className="text-slate-900" /></button>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                {viewType === 'month' && currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                {viewType === 'week' && `Week of ${daysInWeek[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                {viewType === 'day' && selectedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mt-1 leading-none">Site Grid Overview</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-6 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Logged</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-100"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unallocated</span>
            </div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {viewType === 'month' && (
            <div className="h-full flex flex-col animate-in fade-in duration-500">
              <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] py-4">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100">
                {daysInMonth.map((date, idx) => {
                  const isToday = date?.toDateString() === new Date().toDateString();
                  const isSelected = date?.toDateString() === selectedDay.toDateString();
                  const dayEntries = date ? getDayEntries(date) : [];
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => { if(date) { setSelectedDay(date); setViewType('day'); } }}
                      className={`min-h-[140px] md:min-h-[160px] p-3 transition-all cursor-pointer relative group flex flex-col bg-white ${
                        !date ? 'opacity-20 pointer-events-none' : isSelected ? 'bg-amber-50/30' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {date && (
                        <>
                          <div className={`flex items-center justify-center h-8 w-8 rounded-xl font-black text-xs mb-3 transition-all ${
                            isToday ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-300 group-hover:text-slate-900 group-hover:bg-slate-100'
                          }`}>
                            {date.getDate()}
                          </div>
                          
                          <div className="space-y-1.5 overflow-hidden">
                            {dayEntries.slice(0, 4).map(e => (
                              <div 
                                key={e.id} 
                                onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}
                                className="bg-slate-900 text-amber-500 text-[9px] font-black px-2.5 py-1.5 rounded-lg truncate border-l-4 border-amber-500 shadow-sm hover:bg-black hover:translate-x-1 transition-all flex items-center justify-between group/item"
                              >
                                <span className="truncate">{e.title}</span>
                              </div>
                            ))}
                            {dayEntries.length > 4 && (
                              <p className="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest mt-1">
                                +{dayEntries.length - 4} Tasks
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewType === 'week' && (
            <div className="flex flex-col gap-2 p-4 md:p-8 animate-in slide-in-from-right-4 duration-500">
              {daysInWeek.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const dayEntries = getDayEntries(date);
                const isEmpty = dayEntries.length === 0;

                return (
                  <div 
                    key={idx}
                    onClick={() => { setSelectedDay(date); setViewType('day'); }}
                    className={`group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:px-8 rounded-[28px] border-2 transition-all cursor-pointer ${
                      isToday ? 'bg-amber-50 border-amber-200 shadow-lg' : 'bg-white border-slate-50 hover:border-slate-200 hover:shadow-md'
                    } ${isEmpty ? 'py-3' : 'py-5'}`}
                  >
                    <div className="flex items-center gap-6 md:min-w-[140px]">
                      <div className={`h-12 w-12 rounded-2xl flex flex-col items-center justify-center font-black ${isToday ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'} transition-colors`}>
                        <span className="text-xs leading-none">{date.getDate()}</span>
                        <span className="text-[8px] uppercase tracking-tighter mt-0.5">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      </div>
                      {isToday && <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest italic animate-pulse hidden sm:block">Today</span>}
                    </div>
                    
                    <div className="flex-1">
                      {isEmpty ? (
                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest italic">No Site Visits Scheduled</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dayEntries.map(e => (
                            <div 
                              key={e.id} 
                              onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}
                              className="bg-slate-900 text-white pl-3 pr-4 py-2 rounded-xl flex items-center gap-3 shadow-lg hover:bg-black transition-all group/item"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                              <span className="text-[10px] font-black uppercase tracking-tight">{e.title}</span>
                              <span className="text-[9px] font-black text-slate-500 italic ml-2">{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <Pencil size={12} className="text-amber-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-slate-300 group-hover:text-amber-500 transition-colors">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black uppercase tracking-widest">Status</p>
                        <p className={`text-[11px] font-bold italic ${isEmpty ? 'text-slate-200' : 'text-amber-600'}`}>
                          {isEmpty ? 'Available' : `${dayEntries.length} Job${dayEntries.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewType === 'day' && (
            <div className="max-w-4xl mx-auto space-y-6 p-6 md:p-12 animate-in slide-in-from-bottom-8 duration-500">
              {getDayEntries(selectedDay).length === 0 ? (
                <div className="py-40 text-center bg-slate-50 rounded-[64px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center">
                  <div className="h-24 w-24 bg-white rounded-3xl flex items-center justify-center text-slate-100 shadow-inner mb-6">
                    <CalendarIcon size={56} />
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm italic">Nothing on the agenda for today</p>
                  <button 
                    onClick={() => { setDraft({ start: selectedDay.toISOString() }); setIsAddingManual(true); }}
                    className="mt-10 bg-slate-900 text-amber-500 px-12 py-5 rounded-[28px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-2xl active:scale-95"
                  >
                    + Log New Site Booking
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {getDayEntries(selectedDay).map(entry => {
                    const customer = customers.find(c => c.id === entry.customerId);
                    return (
                      <div key={entry.id} className="bg-white rounded-[40px] border-2 border-slate-50 p-10 hover:border-amber-400 transition-all shadow-md hover:shadow-2xl group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-3 h-full bg-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
                          <div className="space-y-6 flex-1">
                            <div className="flex flex-wrap items-center gap-5">
                              <div className="flex items-center gap-2 bg-amber-500 text-slate-900 px-5 py-2.5 rounded-xl text-xs font-black shadow-xl">
                                <Clock size={16} />
                                {new Date(entry.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="h-px w-8 bg-slate-100"></div>
                              <div className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black">
                                {new Date(entry.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-4 group-hover:text-amber-600 transition-colors">
                                {entry.title}
                              </h4>
                              <div className="flex flex-wrap gap-6">
                                {customer && (
                                  <div className="flex items-center gap-3 text-slate-500 font-bold text-base italic">
                                    <div className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center text-amber-500 font-black not-italic text-sm shadow-sm">
                                      {customer.name.charAt(0)}
                                    </div>
                                    {customer.name}
                                  </div>
                                )}
                                {entry.location && (
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.location)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 text-amber-600 font-black text-sm uppercase tracking-widest hover:underline"
                                  >
                                    <MapPin size={20} /> {entry.location}
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            {entry.description && (
                              <p className="text-lg text-slate-500 italic font-medium bg-slate-50/50 p-8 rounded-[36px] border border-slate-100/50 leading-relaxed">
                                {entry.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex flex-row md:flex-col gap-3 shrink-0">
                            <button 
                              onClick={() => handleEdit(entry)}
                              className="p-6 bg-slate-50 text-slate-400 rounded-[28px] hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                            >
                              <Pencil size={24}/>
                            </button>
                            <button
                              onClick={() => confirm('Cancel site booking?') && onDeleteEntry(entry.id)}
                              className="p-6 bg-red-50 text-red-300 rounded-[28px] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            >
                              <Trash2 size={24}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unified Edit/Add Modal */}
      {(isAddingManual || isReviewingAI) && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[72px] p-10 md:p-20 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-400 overflow-y-auto max-h-[95vh] no-scrollbar">
            {isAddingCustomer ? (
              <div className="space-y-12 animate-in slide-in-from-right-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-8">
                    <div className="h-20 w-20 bg-amber-500 text-slate-900 rounded-[36px] flex items-center justify-center shadow-2xl">
                      <UserPlus size={40} />
                    </div>
                    <div>
                      <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Register Client</h3>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic mt-2.5 leading-none">Site Logistics Profile</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddingCustomer(false)} className="p-4 hover:bg-slate-100 rounded-full text-slate-300 transition-all hover:text-slate-900"><X size={40}/></button>
                </div>

                <button 
                  onClick={() => isListeningCustomer ? customerRecognitionRef.current?.stop() : customerRecognitionRef.current?.start()}
                  disabled={isProcessingCustomer}
                  className={`w-full flex items-center justify-center gap-6 p-10 rounded-[48px] border-4 font-black uppercase text-sm tracking-[0.2em] transition-all ${
                    isListeningCustomer ? 'bg-red-500 text-white border-red-600 animate-pulse' : isProcessingCustomer ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                  }`}
                >
                  {isProcessingCustomer ? <Loader2 size={32} className="animate-spin" /> : <Sparkles size={32} />}
                  {isProcessingCustomer ? 'Analysing' : isListeningCustomer ? 'Listening' : 'Magic Fill (Voice)'}
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic flex items-center gap-2"><User size={14}/> Full Name *</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-[36px] p-7 font-bold text-xl text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner" value={newCustomer.name || ''} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="e.g. John Smith" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic flex items-center gap-2"><Hammer size={14}/> Company</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-[36px] p-7 font-bold text-xl text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner" value={newCustomer.company || ''} onChange={e => setNewCustomer({...newCustomer, company: e.target.value})} placeholder="Optional" />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><MapPin size={14}/> Site Address</label>
                      <div className="flex gap-4">
                        <button onClick={handleUseCurrentLocation} disabled={isLocating} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-2 disabled:opacity-30">
                          {isLocating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={14} />} Locate
                        </button>
                        <button onClick={handleVerifyAddress} disabled={!newCustomer.address || isVerifyingAddress} className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 flex items-center gap-2 disabled:opacity-30">
                          {isVerifyingAddress ? <Loader2 size={12} className="animate-spin" /> : <MapPinned size={14} />} AI Verify
                        </button>
                      </div>
                    </div>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-[36px] p-8 font-bold text-xl text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all min-h-[140px] shadow-inner" value={newCustomer.address || ''} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="Location..." />
                  </div>
                </div>

                {customerError && (
                  <div className="bg-red-50 text-red-600 p-8 rounded-[36px] text-xs font-black uppercase tracking-widest flex items-center gap-4">
                    <AlertCircle size={24}/> {customerError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-6 pt-6">
                  <button onClick={saveQuickCustomer} className="flex-1 bg-slate-900 text-white font-black py-8 rounded-[40px] flex items-center justify-center gap-6 uppercase text-sm tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95">
                    Save & Assign
                  </button>
                  <button onClick={() => setIsAddingCustomer(false)} className="px-14 bg-slate-50 text-slate-500 font-black py-8 rounded-[40px] hover:bg-slate-100 transition-all uppercase text-[12px] tracking-widest">Back</button>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-8">
                    <div className={`h-20 w-20 rounded-[36px] flex items-center justify-center shadow-2xl ${isReviewingAI ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-amber-500'}`}>
                      {isReviewingAI ? <Sparkles size={40} /> : <CalendarIcon size={40} />}
                    </div>
                    <div>
                      <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                        {isReviewingAI ? 'Review Entry' : editingId ? 'Edit Visit' : 'Manual Entry'}
                      </h3>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic mt-2.5 leading-none">
                        {isReviewingAI ? 'AI Analysis Ready' : 'Project Site Logistics'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => { setIsAddingManual(false); setIsReviewingAI(false); setEditingId(null); setDraft({}); }} className="p-4 hover:bg-slate-100 rounded-full text-slate-300 transition-all hover:text-slate-900"><X size={40}/></button>
                </div>

                <div className="space-y-10">
                  <div className="space-y-3">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Booking Reference *</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-[36px] p-7 font-black text-3xl text-slate-950 outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner" value={draft.title || ''} onChange={e => setDraft({...draft, title: e.target.value})} placeholder="e.g. Groundworks" />
                  </div>

                  {/* Link to Job or Customer */}
                  <div className="space-y-3">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic flex items-center gap-2">
                      <Link2 size={14} /> Link To
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => { hapticTap(); setLinkType('none'); setDraft(prev => ({ ...prev, projectId: undefined })); }}
                        className={`p-4 rounded-2xl font-black text-sm uppercase tracking-wide flex flex-col items-center gap-2 min-h-[80px] justify-center transition-all ${
                          linkType === 'none' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <CalendarIcon size={20} />
                        <span className="text-[10px]">Standalone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { hapticTap(); setLinkType('job'); }}
                        className={`p-4 rounded-2xl font-black text-sm uppercase tracking-wide flex flex-col items-center gap-2 min-h-[80px] justify-center transition-all ${
                          linkType === 'job' ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <Briefcase size={20} />
                        <span className="text-[10px]">Job Pack</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { hapticTap(); setLinkType('customer'); }}
                        className={`p-4 rounded-2xl font-black text-sm uppercase tracking-wide flex flex-col items-center gap-2 min-h-[80px] justify-center transition-all ${
                          linkType === 'customer' ? 'bg-purple-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <User size={20} />
                        <span className="text-[10px]">Customer</span>
                      </button>
                    </div>
                  </div>

                  {/* Job Pack Selection */}
                  {linkType === 'job' && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic flex items-center gap-2">
                        <Briefcase size={14} /> Select Job Pack
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-blue-50 border-2 border-blue-200 rounded-[36px] p-7 font-bold text-xl text-slate-950 outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none cursor-pointer"
                          value={(draft as any).projectId || ''}
                          onChange={e => handleLinkToJob(e.target.value)}
                        >
                          <option value="">Select Job Pack...</option>
                          {projects.map(p => {
                            const customer = customers.find(c => c.id === p.customerId);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.title} {customer ? `- ${customer.name}` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown className="absolute right-10 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" size={32} />
                      </div>
                    </div>
                  )}

                  {/* Customer Selection */}
                  {linkType === 'customer' && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Assign Client</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            className="w-full bg-purple-50 border-2 border-purple-200 rounded-[36px] p-7 font-bold text-xl text-slate-950 outline-none focus:border-purple-400 focus:bg-white transition-all appearance-none cursor-pointer"
                            value={draft.customerId || ''}
                            onChange={e => {
                              const cust = customers.find(c => c.id === e.target.value);
                              setDraft({
                                ...draft,
                                customerId: e.target.value,
                                location: draft.location || cust?.address || ''
                              });
                            }}
                          >
                            <option value="">Select Client...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
                          </select>
                          <ChevronDown className="absolute right-10 top-1/2 -translate-y-1/2 text-purple-300 pointer-events-none" size={32} />
                        </div>
                        <button
                          onClick={() => { hapticTap(); setIsAddingCustomer(true); }}
                          className="p-7 bg-slate-900 text-amber-500 rounded-[36px] hover:bg-black transition-all shadow-lg active:scale-95"
                        >
                          <UserPlus size={32} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Location Input with Current Location Button */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap justify-between items-center px-1 gap-2">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest italic">Project Site Address</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleUseLocationForEntry}
                          disabled={isLocatingEntry}
                          className="min-h-[44px] px-4 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-2 disabled:opacity-30 bg-blue-50 rounded-xl active:scale-95"
                        >
                          {isLocatingEntry ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={16} />}
                          <span className="hidden sm:inline">Current Location</span>
                          <span className="sm:hidden">Locate</span>
                        </button>
                        {selectedCustomer?.address && (
                          <button
                            type="button"
                            onClick={() => { hapticTap(); setDraft({ ...draft, location: selectedCustomer.address }); }}
                            className="min-h-[44px] px-4 text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 flex items-center gap-2 bg-amber-50 rounded-xl active:scale-95"
                          >
                            <MapPinned size={16} />
                            <span className="hidden sm:inline">Client Address</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[36px] px-8 focus-within:border-amber-400 focus-within:bg-white transition-all shadow-inner">
                      <MapPin className="text-slate-300 mr-5" size={24} />
                      <input className="w-full bg-transparent border-none py-8 font-bold text-xl text-slate-950 outline-none" value={draft.location || ''} onChange={e => setDraft({...draft, location: e.target.value})} placeholder="Location..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 rounded-[52px] bg-slate-50 border-2 border-slate-100">
                    <div className="space-y-3">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Arrival At</label>
                      <input 
                        type="datetime-local" 
                        className="w-full bg-white border-2 border-slate-100 rounded-3xl p-6 font-black text-lg text-slate-950 outline-none focus:border-amber-400 transition-all" 
                        value={draft.start ? new Date(draft.start).toISOString().slice(0, 16) : ''} 
                        onChange={e => setDraft({...draft, start: new Date(e.target.value).toISOString()})} 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Departure At</label>
                      <input 
                        type="datetime-local" 
                        className="w-full bg-white border-2 border-slate-100 rounded-3xl p-6 font-black text-lg text-slate-950 outline-none focus:border-amber-400 transition-all" 
                        value={draft.end ? new Date(draft.end).toISOString().slice(0, 16) : ''} 
                        onChange={e => setDraft({...draft, end: new Date(e.target.value).toISOString()})} 
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-10 rounded-[40px] text-[12px] font-black uppercase tracking-[0.3em] flex items-center gap-5 border border-red-100">
                    <AlertCircle size={28} /> {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-6 pt-6">
                  <button onClick={saveEntry} className="flex-1 bg-slate-900 text-white font-black py-8 rounded-[40px] flex items-center justify-center gap-6 uppercase text-sm tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95">
                    <CheckCircle2 size={32}/> {editingId ? 'Update Log' : 'Save Booking'}
                  </button>
                  <button onClick={() => { setIsAddingManual(false); setIsReviewingAI(false); setEditingId(null); setDraft({}); }} className="px-14 bg-slate-50 text-slate-500 font-black py-8 rounded-[40px] hover:bg-slate-100 transition-all uppercase text-[12px] tracking-widest">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
