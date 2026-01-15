
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScheduleEntry, Customer, JobPack, Quote } from '../types';
import {
  Mic, Trash2, MapPin, Clock, Navigation,
  Bell, BellRing, Play, CheckCircle2,
  Calendar, ArrowRight, Sparkles,
  Timer, Loader2, MicOff, StickyNote, Eraser,
  Briefcase, FileText, Receipt, UserPlus,
  PoundSterling, FileWarning, AlertTriangle,
  LogIn, LogOut
} from 'lucide-react';
import { parseReminderVoiceInput } from '../src/services/geminiService';
import { hapticTap, hapticSuccess } from '../src/hooks/useHaptic';

interface HomeProps {
  schedule: ScheduleEntry[];
  customers: Customer[];
  projects: JobPack[];
  quotes: Quote[];
  onNavigateToSchedule: () => void;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onLogExpense?: () => void;
  onAddCustomer?: () => void;
}

interface SiteLog {
  id: string;
  clockInTime: string;
  clockInLocation?: { lat: number; lng: number };
  clockOutTime?: string;
  clockOutLocation?: { lat: number; lng: number };
  jobTitle?: string;
}

interface SiteSession {
  currentSession: SiteLog | null;
  history: SiteLog[];
}

interface Reminder {
  id: string;
  text: string;
  time: string;
  isCompleted: boolean;
  isAlarming?: boolean;
}

export const Home: React.FC<HomeProps> = ({
  schedule,
  customers,
  projects,
  quotes,
  onNavigateToSchedule,
  onCreateJob,
  onCreateQuote,
  onLogExpense,
  onAddCustomer
}) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [isListeningReminder, setIsListeningReminder] = useState(false);
  const [isListeningNote, setIsListeningNote] = useState(false);
  const [isProcessingReminder, setIsProcessingReminder] = useState(false);
  const [siteSession, setSiteSession] = useState<SiteSession>({ currentSession: null, history: [] });
  const [elapsedTime, setElapsedTime] = useState<string>('0h 0m');

  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');

  const recognitionRef = useRef<any>(null);
  const noteRecognitionRef = useRef<any>(null);

  useEffect(() => {
    try {
    const savedReminders = localStorage.getItem('bq_home_reminders');
    const savedNotes = localStorage.getItem('bq_home_quick_notes');
    const savedSiteSession = localStorage.getItem('bq_site_log');
    if (savedReminders) setReminders(JSON.parse(savedReminders));
    if (savedNotes) setQuickNotes(savedNotes);
    if (savedSiteSession) setSiteSession(JSON.parse(savedSiteSession));
    } catch (e) { console.error("Failed to parse localStorage data:", e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('bq_home_reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem('bq_home_quick_notes', quickNotes);
  }, [quickNotes]);

  useEffect(() => {
    localStorage.setItem('bq_site_log', JSON.stringify(siteSession));
  }, [siteSession]);

  // Update elapsed time when on site
  useEffect(() => {
    if (!siteSession.currentSession) {
      setElapsedTime('0h 0m');
      return;
    }
    const updateElapsed = () => {
      const diff = Date.now() - new Date(siteSession.currentSession!.clockInTime).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedTime(`${hours}h ${minutes}m`);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [siteSession.currentSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5); 
      
      setReminders(prev => prev.map(r => {
        if (!r.isCompleted && r.time === currentTimeStr && !r.isAlarming) {
          return { ...r, isAlarming: true };
        }
        return r;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Setup for Reminders
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-GB';
      recognition.onstart = () => setIsListeningReminder(true);
      recognition.onend = () => setIsListeningReminder(false);
      recognition.onerror = () => setIsListeningReminder(false);
      recognition.onresult = async (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          handleVoiceReminder(event.results[0][0].transcript);
        }
      };
      recognitionRef.current = recognition;

      // Setup for Quick Notes
      const noteRecognition = new SpeechRecognition();
      noteRecognition.continuous = false;
      noteRecognition.lang = 'en-GB';
      noteRecognition.onstart = () => setIsListeningNote(true);
      noteRecognition.onend = () => setIsListeningNote(false);
      noteRecognition.onerror = () => setIsListeningNote(false);
      noteRecognition.onresult = (event: any) => {
        if (event.results?.[0]?.[0]?.transcript) {
          const transcript = event.results[0][0].transcript;
          setQuickNotes(prev => (prev ? `${prev}\n${transcript}` : transcript));
        }
      };
      noteRecognitionRef.current = noteRecognition;
    }
    return () => {
      recognitionRef.current?.abort();
      noteRecognitionRef.current?.abort();
    };
  }, []);

  const startVoiceReminder = () => {
    if (isListeningReminder) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.error("Mic start failed", e);
    }
  };

  const startVoiceNote = () => {
    if (isListeningNote) {
      noteRecognitionRef.current?.stop();
      return;
    }
    try {
      noteRecognitionRef.current?.start();
    } catch (e) {
      console.error("Note mic start failed", e);
    }
  };

  const handleVoiceReminder = async (transcript: string) => {
    setIsProcessingReminder(true);
    try {
      const parsed = await parseReminderVoiceInput(transcript);
      if (parsed.text && parsed.time) {
        const reminder: Reminder = {
          id: Math.random().toString(36).substr(2, 9),
          text: parsed.text,
          time: parsed.time,
          isCompleted: false
        };
        setReminders(prev => [...prev, reminder].sort((a, b) => a.time.localeCompare(b.time)));
      }
    } catch (err) {
      console.error("AI Reminder Error", err);
    } finally {
      setIsProcessingReminder(false);
    }
  };

  const addReminder = () => {
    if (!newReminderText || !newReminderTime) return;
    const reminder: Reminder = {
      id: Math.random().toString(36).substr(2, 9),
      text: newReminderText,
      time: newReminderTime,
      isCompleted: false
    };
    setReminders(prev => [...prev, reminder].sort((a, b) => a.time.localeCompare(b.time)));
    setNewReminderText('');
    setNewReminderTime('');
  };

  // Clock In/Out functions
  const clockIn = async () => {
    let location: { lat: number; lng: number } | undefined;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      location = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (e) {
      // Location optional, continue without
    }
    const newSession: SiteLog = {
      id: Math.random().toString(36).substr(2, 9),
      clockInTime: new Date().toISOString(),
      clockInLocation: location,
      jobTitle: nextJob?.title
    };
    setSiteSession(prev => ({ ...prev, currentSession: newSession }));
  };

  const clockOut = async () => {
    if (!siteSession.currentSession) return;
    let location: { lat: number; lng: number } | undefined;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      location = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (e) { console.warn('Could not get clock-out location:', e); }
    const completedSession: SiteLog = {
      ...siteSession.currentSession,
      clockOutTime: new Date().toISOString(),
      clockOutLocation: location
    };
    setSiteSession(prev => ({
      currentSession: null,
      history: [completedSession, ...prev.history].slice(0, 30)
    }));
  };

  // Calculate quote total helper
  const calculateQuoteTotal = (quote: Quote): number => {
    const sections = quote.sections || [];
    const materialsTotal = sections.reduce((sum, section) =>
      sum + (section.items || []).reduce((itemSum, item) => itemSum + (item.totalPrice || 0), 0), 0);
    const labourHoursTotal = sections.reduce((sum, section) => sum + (section.labourHours || 0), 0);
    const labourTotal = labourHoursTotal * (quote.labourRate || 0);
    const subtotal = materialsTotal + labourTotal;
    const markup = subtotal * ((quote.markupPercent || 0) / 100);
    const tax = (subtotal + markup) * ((quote.taxPercent || 0) / 100);
    return subtotal + markup + tax;
  };

  // Today's stats
  const todayStats = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Start of week (Monday)
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - diff);

    const jobsToday = schedule.filter(entry => {
      const start = new Date(entry.start);
      return start >= startOfToday && start < endOfToday;
    }).length;

    const weeklyRevenue = quotes
      .filter(q => q.type === 'invoice' && q.status === 'paid')
      .filter(q => {
        const updatedAt = new Date(q.updatedAt);
        return updatedAt >= startOfWeek && updatedAt <= today;
      })
      .reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

    const outstandingInvoices = quotes.filter(
      q => q.type === 'invoice' && q.status !== 'paid' && q.status !== 'draft'
    ).length;

    const pendingQuotes = quotes.filter(
      q => (q.type === 'estimate' || q.type === 'quotation') && q.status === 'sent'
    ).length;

    return { jobsToday, weeklyRevenue, outstandingInvoices, pendingQuotes };
  }, [schedule, quotes]);

  // Week preview
  const weekPreview = useMemo(() => {
    const days: { date: Date; dayName: string; jobCount: number }[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const jobCount = schedule.filter(entry => {
        const start = new Date(entry.start);
        return start >= startOfDay && start < endOfDay;
      }).length;

      days.push({
        date,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-GB', { weekday: 'short' }),
        jobCount
      });
    }

    return days;
  }, [schedule]);

  // Alerts
  const alerts = useMemo(() => {
    const alertList: { id: string; type: string; title: string; description: string; severity: 'warning' | 'info' }[] = [];
    const now = new Date();

    // Overdue invoices (sent/accepted > 14 days old)
    quotes
      .filter(q => q.type === 'invoice' && (q.status === 'sent' || q.status === 'accepted'))
      .forEach(invoice => {
        const invoiceDate = new Date(invoice.date);
        const dueDate = new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        if (now > dueDate) {
          const customer = customers.find(c => c.id === invoice.customerId);
          alertList.push({
            id: `overdue-${invoice.id}`,
            type: 'overdue',
            title: `Overdue: ${invoice.title}`,
            description: `${customer?.name || 'Unknown'} - Due ${dueDate.toLocaleDateString()}`,
            severity: 'warning'
          });
        }
      });

    // Pending quotes (sent > 7 days ago)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    quotes
      .filter(q => (q.type === 'estimate' || q.type === 'quotation') && q.status === 'sent')
      .filter(q => new Date(q.updatedAt) < sevenDaysAgo)
      .forEach(quote => {
        const customer = customers.find(c => c.id === quote.customerId);
        alertList.push({
          id: `pending-${quote.id}`,
          type: 'pending_quote',
          title: `Follow Up: ${quote.title}`,
          description: `Sent to ${customer?.name || 'Unknown'} - No response`,
          severity: 'info'
        });
      });

    // Upcoming jobs (within 24 hours)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    schedule
      .filter(entry => {
        const start = new Date(entry.start);
        return start > now && start < tomorrow;
      })
      .forEach(job => {
        const customer = customers.find(c => c.id === job.customerId);
        alertList.push({
          id: `upcoming-${job.id}`,
          type: 'upcoming_job',
          title: job.title,
          description: `${new Date(job.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${customer?.name || 'Site visit'}`,
          severity: 'info'
        });
      });

    return alertList.slice(0, 5);
  }, [quotes, schedule, customers]);

  const nextJob = useMemo(() => {
    const now = new Date();
    return [...schedule]
      .filter(entry => new Date(entry.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  }, [schedule]);

  const nextJobCustomer = useMemo(() => 
    nextJob ? customers.find(c => c.id === nextJob.customerId) : null
  , [nextJob, customers]);

  const getTimeUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m until start`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m until start`;
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tight">Daily Brief</h2>
          <p className="text-xs md:text-base text-slate-500 font-medium italic mt-0.5 md:mt-1">Ready for the site. Your immediate priorities at a glance.</p>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl px-3 py-1.5 md:px-5 md:py-3 shadow-sm flex items-center gap-2 md:gap-3">
          <Clock size={14} className="md:w-5 md:h-5 text-amber-500" />
          <span className="font-black text-slate-900 text-sm md:text-lg">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Quick Actions Grid - No Scrolling */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <button
          onClick={() => { hapticTap(); onCreateJob?.(); }}
          className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-blue-500 text-white p-3 md:p-6 min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-blue-500/20 hover:shadow-2xl group"
        >
          <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
            <Briefcase size={20} className="md:w-7 md:h-7" />
          </div>
          <span className="font-black text-[10px] md:text-sm uppercase tracking-wider md:tracking-widest leading-none">New Job</span>
        </button>
        <button
          onClick={() => { hapticTap(); onCreateQuote?.(); }}
          className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-amber-500 text-white p-3 md:p-6 min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-amber-500/20 hover:shadow-2xl group"
        >
          <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
            <FileText size={20} className="md:w-7 md:h-7" />
          </div>
          <span className="font-black text-[10px] md:text-sm uppercase tracking-wider md:tracking-widest leading-none">New Quote</span>
        </button>
        <button
          onClick={() => { hapticTap(); onLogExpense?.(); }}
          className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-emerald-500 text-white p-3 md:p-6 min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-emerald-500/20 hover:shadow-2xl group"
        >
          <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
            <Receipt size={20} className="md:w-7 md:h-7" />
          </div>
          <span className="font-black text-[10px] md:text-sm uppercase tracking-wider md:tracking-widest leading-none">Expense</span>
        </button>
        <button
          onClick={() => { hapticTap(); onAddCustomer?.(); }}
          className="flex flex-col items-center justify-center gap-1.5 md:gap-3 bg-purple-500 text-white p-3 md:p-6 min-h-[70px] md:min-h-[100px] rounded-2xl md:rounded-[28px] active:scale-95 transition-all shadow-lg md:shadow-xl shadow-purple-500/20 hover:shadow-2xl group"
        >
          <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl group-active:scale-90 transition-transform">
            <UserPlus size={20} className="md:w-7 md:h-7" />
          </div>
          <span className="font-black text-[10px] md:text-sm uppercase tracking-wider md:tracking-widest leading-none">Customer</span>
        </button>
      </div>

      {/* Today's Stats Card */}
      <div className="bg-white rounded-2xl md:rounded-[32px] border border-slate-200 p-3 md:p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="flex flex-col items-center justify-center gap-1.5 md:gap-3 p-2 md:p-4 bg-blue-50 rounded-xl md:rounded-2xl text-center">
            <div className="p-1.5 md:p-3 bg-blue-500 text-white rounded-lg md:rounded-xl">
              <Calendar size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.jobsToday}</p>
            <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Jobs<br/>Today</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 md:gap-3 p-2 md:p-4 bg-emerald-50 rounded-xl md:rounded-2xl text-center">
            <div className="p-1.5 md:p-3 bg-emerald-500 text-white rounded-lg md:rounded-xl">
              <PoundSterling size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-sm md:text-2xl font-black text-slate-900 leading-none">{todayStats.weeklyRevenue.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })}</p>
            <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">This<br/>Week</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 md:gap-3 p-2 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl text-center">
            <div className="p-1.5 md:p-3 bg-amber-500 text-white rounded-lg md:rounded-xl">
              <FileWarning size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.outstandingInvoices}</p>
            <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Outstanding</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 md:gap-3 p-2 md:p-4 bg-purple-50 rounded-xl md:rounded-2xl text-center">
            <div className="p-1.5 md:p-3 bg-purple-500 text-white rounded-lg md:rounded-xl">
              <Clock size={14} className="md:w-5 md:h-5" />
            </div>
            <p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{todayStats.pendingQuotes}</p>
            <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight">Pending<br/>Quotes</p>
          </div>
        </div>
      </div>

      <div className="relative group">
        {!nextJob ? (
          <div onClick={onNavigateToSchedule} className="bg-white border-4 border-dashed border-slate-100 rounded-2xl md:rounded-[48px] p-8 md:p-16 text-center cursor-pointer hover:border-amber-200 transition-all flex flex-col items-center">
            <Calendar size={40} className="md:w-[60px] md:h-[60px] text-slate-200 mb-2 md:mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs md:text-base">No upcoming jobs found</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl md:rounded-[48px] p-4 md:p-10 lg:p-12 text-white shadow-2xl overflow-hidden relative border-b-4 md:border-b-8 border-amber-600">
            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
              <Navigation size={200} />
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-10 relative z-10">
              <div className="space-y-3 md:space-y-6 flex-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="px-3 py-1 md:px-4 md:py-2 bg-amber-500 rounded-full text-slate-900 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Next Job
                  </div>
                  <div className="text-amber-500 font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1 md:gap-2">
                    <Timer size={12} className="md:w-[14px] md:h-[14px]" /> {getTimeUntil(nextJob.start)}
                  </div>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <h3 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight leading-none">{nextJob.title}</h3>
                  <div className="flex items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 font-bold text-sm md:text-lg italic">
                      <Clock size={16} className="md:w-5 md:h-5 text-amber-500" />
                      {new Date(nextJob.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(nextJob.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {nextJobCustomer && (
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                      <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 font-black">
                        {nextJobCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Client</p>
                        <p className="font-bold text-sm text-white mt-1">{nextJobCustomer.name}</p>
                      </div>
                    </div>
                  )}
                  
                  {nextJob.location && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextJob.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[200px] flex flex-col gap-2 bg-amber-500 p-5 rounded-3xl hover:bg-amber-400 transition-all text-slate-900 shadow-xl shadow-amber-500/20 group/nav"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-75">Navigate to Site</span>
                        <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center text-amber-500 shrink-0 group-hover/nav:scale-110 transition-transform">
                          <Navigation size={16} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin size={20} className="shrink-0" />
                        <span className="font-black text-sm truncate">{nextJob.location}</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              <button 
                onClick={onNavigateToSchedule}
                className="w-full md:w-auto h-auto md:h-64 bg-white/5 border border-white/10 rounded-[32px] p-8 flex flex-col justify-between hover:bg-white/10 transition-all group"
              >
                <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
                  <ArrowRight size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Full Schedule</p>
                  <p className="text-xl font-black text-white mt-1">View Week</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On Site Clock + Week Preview Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* On Site Clock */}
        <div className={`rounded-xl md:rounded-[32px] p-3 md:p-6 ${siteSession.currentSession ? 'bg-emerald-500' : 'bg-slate-900'} text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-70 mb-0.5 md:mb-1">
                {siteSession.currentSession ? 'On Site' : 'Off Site'}
              </p>
              {siteSession.currentSession ? (
                <>
                  <p className="text-xl md:text-3xl font-black">{elapsedTime}</p>
                  <p className="text-xs md:text-sm opacity-80 mt-0.5 md:mt-1">
                    Since {new Date(siteSession.currentSession.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {siteSession.currentSession.jobTitle && ` - ${siteSession.currentSession.jobTitle}`}
                  </p>
                </>
              ) : (
                <p className="text-sm md:text-lg font-bold opacity-60">Tap to clock in when you arrive</p>
              )}
            </div>
            <button
              onClick={() => {
                hapticTap();
                siteSession.currentSession ? clockOut() : clockIn();
              }}
              className={`h-12 w-12 md:h-16 md:w-16 min-w-[48px] md:min-w-[64px] rounded-xl md:rounded-[20px] flex items-center justify-center font-black text-sm active:scale-95 transition-transform ${
                siteSession.currentSession
                  ? 'bg-white text-emerald-600'
                  : 'bg-amber-500 text-slate-900'
              }`}
            >
              {siteSession.currentSession ? <LogOut size={20} className="md:w-[26px] md:h-[26px]" /> : <LogIn size={20} className="md:w-[26px] md:h-[26px]" />}
            </button>
          </div>
        </div>

        {/* Week Preview */}
        <div className="bg-white rounded-xl md:rounded-[32px] border border-slate-200 p-3 md:p-6 shadow-sm">
          <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight mb-2 md:mb-4">Week Ahead</h3>
          <div className="flex gap-1.5 md:gap-2 overflow-x-auto no-scrollbar pb-1">
            {weekPreview.map((day, idx) => (
              <button
                key={idx}
                onClick={onNavigateToSchedule}
                className={`flex-shrink-0 w-12 md:w-14 p-2 md:p-3 rounded-lg md:rounded-xl text-center transition-all ${
                  idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-[8px] md:text-[9px] font-black uppercase">{day.dayName}</p>
                <p className="text-base md:text-lg font-black">{day.date.getDate()}</p>
                <div className={`text-[9px] md:text-[10px] font-bold ${day.jobCount > 0 ? '' : 'opacity-40'}`}>
                  {day.jobCount} {day.jobCount === 1 ? 'job' : 'jobs'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Attention Needed
          </h3>
          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl flex items-center justify-between ${
                  alert.severity === 'warning' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{alert.title}</p>
                  <p className="text-xs text-slate-500 truncate">{alert.description}</p>
                </div>
                <div className={`ml-3 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                  alert.type === 'overdue' ? 'bg-amber-500 text-white' :
                  alert.type === 'pending_quote' ? 'bg-purple-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {alert.type === 'overdue' ? 'Overdue' : alert.type === 'pending_quote' ? 'Follow Up' : 'Soon'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8">
        {/* Reminders Section */}
        <div className="bg-white rounded-2xl md:rounded-[40px] border border-slate-200 p-3 md:p-8 shadow-sm flex flex-col md:min-h-[500px]">
          <div className="flex items-center justify-between mb-2 md:mb-8">
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-4 bg-blue-50 text-blue-600 rounded-lg md:rounded-3xl">
                <Bell size={16} className="md:w-7 md:h-7" />
              </div>
              <div>
                <h3 className="text-sm md:text-2xl font-black text-slate-900 uppercase tracking-tight">Reminders</h3>
                <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest italic hidden sm:block">Time-sensitive site alarms</p>
              </div>
            </div>
            <button
              onClick={startVoiceReminder}
              disabled={isProcessingReminder}
              className={`h-10 w-10 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center shadow-md md:shadow-2xl transition-all ${
                isListeningReminder
                  ? 'bg-red-500 text-white animate-pulse'
                  : isProcessingReminder
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isProcessingReminder ? <Loader2 size={16} className="md:w-6 md:h-6 animate-spin" /> : isListeningReminder ? <MicOff size={16} className="md:w-6 md:h-6" /> : <Mic size={16} className="md:w-6 md:h-6" />}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-1.5 md:gap-3 mb-2 md:mb-8">
            <input
              type="text"
              placeholder="What needs reminding?..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[24px] p-2 md:p-4 min-h-[36px] md:min-h-[52px] font-bold text-sm md:text-base text-slate-900 outline-none focus:border-blue-400 transition-all"
              value={newReminderText}
              onChange={e => setNewReminderText(e.target.value)}
            />
            <input
              type="time"
              className="w-full sm:w-28 md:sm:w-40 bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[24px] p-2 md:p-4 min-h-[36px] md:min-h-[52px] font-bold text-sm md:text-base text-slate-900 outline-none focus:border-blue-400 transition-all cursor-pointer"
              value={newReminderTime}
              onChange={e => setNewReminderTime(e.target.value)}
            />
            <button
              onClick={() => { hapticTap(); addReminder(); }}
              disabled={!newReminderText || !newReminderTime}
              className="bg-slate-900 text-white px-3 md:px-8 min-h-[36px] md:min-h-[52px] rounded-lg md:rounded-[24px] shadow-lg active:scale-95 transition-transform disabled:opacity-20 font-black uppercase text-[10px] md:text-xs tracking-widest"
            >
              Add
            </button>
          </div>

          <div className="overflow-y-auto space-y-2 md:space-y-4 no-scrollbar pr-1">
            {reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-300 opacity-30 py-4 md:py-20">
                <BellRing size={32} className="md:w-16 md:h-16 mb-1 md:mb-4" />
                <p className="text-[10px] md:text-sm font-black uppercase tracking-widest">No active alarms</p>
              </div>
            ) : (
              reminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={`p-3 md:p-6 rounded-xl md:rounded-[32px] border-2 transition-all flex items-center justify-between group ${
                    reminder.isAlarming
                      ? 'bg-amber-500 border-amber-600 text-slate-900 animate-pulse'
                      : reminder.isCompleted
                        ? 'bg-slate-50 border-transparent opacity-40'
                        : 'bg-white border-slate-100 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <button
                      onClick={() => {
                        setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, isCompleted: !r.isCompleted, isAlarming: false } : r));
                      }}
                      className={`h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-[20px] flex items-center justify-center shrink-0 transition-all ${
                        reminder.isAlarming
                          ? 'bg-slate-900 text-white shadow-2xl'
                          : reminder.isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600'
                      }`}
                    >
                      {reminder.isCompleted ? <CheckCircle2 size={18} className="md:w-6 md:h-6" /> : reminder.isAlarming ? <BellRing size={18} className="md:w-6 md:h-6 animate-bounce" /> : <Play size={16} className="md:w-[22px] md:h-[22px]" />}
                    </button>
                    <div className="truncate">
                      <p className={`font-black text-sm md:text-lg truncate ${reminder.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {reminder.text}
                      </p>
                      <p className={`text-[10px] md:text-[12px] font-black uppercase tracking-widest italic ${reminder.isAlarming ? 'text-slate-900' : 'text-slate-400'}`}>
                        {reminder.time}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReminders(prev => prev.filter(r => r.id !== reminder.id))}
                    className={`p-2 md:p-3 transition-colors ${reminder.isAlarming ? 'text-slate-900' : 'text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Trash2 size={18} className="md:w-6 md:h-6" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Notes Section */}
        <div className="bg-white rounded-2xl md:rounded-[40px] border border-slate-200 p-3 md:p-8 shadow-sm flex flex-col md:min-h-[500px]">
          <div className="flex items-center justify-between mb-2 md:mb-8">
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="p-1.5 md:p-4 bg-amber-50 text-amber-600 rounded-lg md:rounded-3xl">
                <StickyNote size={16} className="md:w-7 md:h-7" />
              </div>
              <div>
                <h3 className="text-sm md:text-2xl font-black text-slate-900 uppercase tracking-tight">Quick Notes</h3>
                <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest italic hidden sm:block">Daily site scratchpad</p>
              </div>
            </div>
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={() => setQuickNotes('')}
                className="h-9 w-9 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                title="Clear Notes"
              >
                <Eraser size={16} className="md:w-6 md:h-6" />
              </button>
              <button
                onClick={startVoiceNote}
                className={`h-9 w-9 md:h-16 md:w-16 rounded-lg md:rounded-[24px] flex items-center justify-center shadow-md md:shadow-2xl transition-all ${
                  isListeningNote
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {isListeningNote ? <MicOff size={16} className="md:w-6 md:h-6" /> : <Mic size={16} className="md:w-6 md:h-6" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 md:gap-4">
            <textarea
              className="bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-[32px] p-3 md:p-8 font-medium text-slate-900 outline-none focus:border-amber-400 transition-all shadow-inner leading-relaxed text-sm md:text-lg resize-none placeholder:text-slate-300 placeholder:italic min-h-[120px] md:min-h-[300px]"
              placeholder="Jot down site measurements, material shortages, or general notes..."
              value={quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
            />
            <div className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
              <Sparkles size={10} className="md:w-[14px] md:h-[14px] text-amber-500" />
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Tap mic to dictate and append to your notes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
