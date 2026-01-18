import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Check, ChevronRight, Star, Shield, Zap, Clock,
  FileText, Camera, Calendar, Receipt, PoundSterling, Users,
  Smartphone, Wifi, WifiOff, Cloud, Calculator, FolderOpen,
  TrendingUp, MessageSquare, Play, Menu, X, Sparkles
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onSignUp: () => void;
}

// Animated counter hook
const useCountUp = (end: number, duration: number = 2000, start: number = 0) => {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration, start]);

  return { count, ref };
};

// Feature showcase data
const features = [
  {
    icon: FileText,
    title: 'Professional Quotes & Invoices',
    description: 'Create beautiful, branded documents in seconds. Auto-calculate VAT, CIS deductions, and markup.',
    color: 'teal',
    details: ['Section-based quotes', 'Auto-numbering', 'PDF export', 'Quote → Invoice conversion']
  },
  {
    icon: Camera,
    title: 'Job Pack Management',
    description: 'Keep all site photos, notes, documents, and materials in one organised place per job.',
    color: 'blue',
    details: ['Site photos with tags', 'Voice notes', 'Document storage', 'Materials tracking']
  },
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Visual calendar to manage your diary. Link jobs to customers and see your week at a glance.',
    color: 'purple',
    details: ['Drag & drop calendar', 'Job linking', 'Location tracking', 'Reminder alerts']
  },
  {
    icon: Receipt,
    title: 'Expense Tracking',
    description: 'Snap receipts, categorise expenses, and track spending by job. Receipt OCR built in.',
    color: 'orange',
    details: ['Receipt scanning', 'AI categorisation', 'VAT extraction', 'Job allocation']
  },
  {
    icon: PoundSterling,
    title: 'Bank Reconciliation',
    description: 'Import bank statements and match transactions to expenses and invoices automatically.',
    color: 'emerald',
    details: ['CSV import', 'Auto-matching', 'VAT summary', 'Quarterly reports']
  },
  {
    icon: FolderOpen,
    title: 'Materials Library',
    description: 'Import price lists from wholesalers. Quick-add materials to quotes with accurate pricing.',
    color: 'pink',
    details: ['Wholesaler CSV import', 'Price updates', 'Favourites', 'Category organisation']
  },
];

// Competitor comparison
const comparisons = [
  { feature: 'Built specifically for UK trades', tradesync: true, others: false },
  { feature: 'VAT & CIS calculations', tradesync: true, others: 'partial' },
  { feature: 'Offline-first mobile app', tradesync: true, others: false },
  { feature: 'Receipt OCR with AI', tradesync: true, others: 'paid' },
  { feature: 'Bank reconciliation', tradesync: true, others: 'paid' },
  { feature: 'Wholesaler price imports', tradesync: true, others: false },
  { feature: 'Job pack organisation', tradesync: true, others: false },
  { feature: 'No per-invoice fees', tradesync: true, others: false },
];

// Testimonials
const testimonials = [
  {
    name: 'Dave M.',
    role: 'Electrician, London',
    quote: 'Finally an app that understands how UK sparkies work. The CIS deductions alone save me hours.',
    rating: 5
  },
  {
    name: 'Sarah K.',
    role: 'Plumber, Manchester',
    quote: 'Being able to work offline on site then sync when I have signal is a game changer.',
    rating: 5
  },
  {
    name: 'Mike T.',
    role: 'Builder, Birmingham',
    quote: 'My quotes look professional now. Customers comment on it. Won more work because of it.',
    rating: 5
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSignUp }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  // Stats counters
  const quotesCreated = useCountUp(12500, 2000);
  const hourssSaved = useCountUp(8400, 2000);
  const activeUsers = useCountUp(850, 2000);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scroll effect for header
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/tradesync-logo.png" alt="TradeSync" className="h-10 md:h-12 rounded-lg" />
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">Features</a>
              <a href="#comparison" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">Why TradeSync</a>
              <a href="#testimonials" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">Reviews</a>
              <a href="#pricing" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">Pricing</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={onLogin}
                className="text-slate-700 font-semibold hover:text-teal-600 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onSignUp}
                className="bg-gradient-to-r from-teal-600 to-teal-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-teal-700 hover:to-teal-600 transition-all shadow-lg shadow-teal-500/25"
              >
                Start Free Trial
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block py-2 text-slate-700 font-medium">Features</a>
              <a href="#comparison" className="block py-2 text-slate-700 font-medium">Why TradeSync</a>
              <a href="#testimonials" className="block py-2 text-slate-700 font-medium">Reviews</a>
              <a href="#pricing" className="block py-2 text-slate-700 font-medium">Pricing</a>
              <hr className="border-slate-200" />
              <button onClick={onLogin} className="block w-full text-left py-2 text-slate-700 font-medium">Sign In</button>
              <button
                onClick={onSignUp}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-500 text-white py-3 rounded-xl font-semibold"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-teal-50/30 to-white" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-teal-100/40 to-transparent" />

        {/* Animated shapes */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <Sparkles size={16} />
                Built for UK Tradespeople
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
                Run Your Trade Business{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400">
                  Like a Pro
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0">
                Quotes, invoices, job packs, expenses, and scheduling — all in one app that works offline.
                Purpose-built for UK electricians, plumbers, builders, and every trade in between.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <button
                  onClick={onSignUp}
                  className="group bg-gradient-to-r from-teal-600 to-teal-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-teal-700 hover:to-teal-600 transition-all shadow-xl shadow-teal-500/30 flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
                <button className="group bg-white text-slate-700 px-8 py-4 rounded-2xl font-bold text-lg border-2 border-slate-200 hover:border-teal-300 transition-all flex items-center justify-center gap-2">
                  <Play size={20} className="text-teal-600" />
                  Watch Demo
                </button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center justify-center lg:justify-start gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Check className="text-teal-500" size={18} />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <Check className="text-teal-500" size={18} />
                  No card required
                </div>
                <div className="flex items-center gap-2">
                  <Check className="text-teal-500" size={18} />
                  Cancel anytime
                </div>
              </div>
            </div>

            {/* Hero Image / App Preview */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-3 shadow-2xl transform lg:rotate-1 hover:rotate-0 transition-transform duration-500">
                {/* Phone mockup */}
                <div className="bg-slate-950 rounded-[2rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
                    <span className="text-white/80 text-xs">9:41</span>
                    <div className="flex items-center gap-1">
                      <Wifi size={14} className="text-white/80" />
                      <div className="w-6 h-3 border border-white/80 rounded-sm">
                        <div className="w-4 h-full bg-teal-500 rounded-sm" />
                      </div>
                    </div>
                  </div>

                  {/* App content preview */}
                  <div className="bg-slate-50 p-4 min-h-[400px]">
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xs text-slate-500">This Week</p>
                        <p className="text-lg font-bold text-slate-900">£4,250</p>
                        <p className="text-xs text-emerald-500">+12%</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Quotes</p>
                        <p className="text-lg font-bold text-slate-900">8</p>
                        <p className="text-xs text-amber-500">3 pending</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Jobs</p>
                        <p className="text-lg font-bold text-slate-900">5</p>
                        <p className="text-xs text-teal-500">2 today</p>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { icon: FileText, label: 'Quote', color: 'teal' },
                          { icon: Camera, label: 'Photo', color: 'blue' },
                          { icon: Receipt, label: 'Expense', color: 'orange' },
                          { icon: Calendar, label: 'Schedule', color: 'purple' },
                        ].map((action, i) => (
                          <button key={i} className="flex flex-col items-center gap-1">
                            <div className={`w-10 h-10 rounded-xl bg-${action.color}-100 flex items-center justify-center`}>
                              <action.icon size={18} className={`text-${action.color}-600`} />
                            </div>
                            <span className="text-xs text-slate-600">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Today's schedule preview */}
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Today</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                          <div className="text-xs">
                            <p className="font-semibold text-slate-900">Kitchen Rewire</p>
                            <p className="text-slate-500">9:00 AM - Mrs. Johnson</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                          <div className="text-xs">
                            <p className="font-semibold text-slate-900">Bathroom Install</p>
                            <p className="text-slate-500">2:00 PM - Mr. Smith</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-4 top-1/4 bg-white rounded-2xl shadow-xl p-4 transform -rotate-6 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Revenue Up</p>
                    <p className="font-bold text-slate-900">+32%</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 bottom-1/4 bg-white rounded-2xl shadow-xl p-4 transform rotate-6 animate-float" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                    <WifiOff className="text-teal-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Works</p>
                    <p className="font-bold text-slate-900">Offline</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div ref={quotesCreated.ref}>
              <p className="text-4xl md:text-5xl font-black text-white mb-2">
                {quotesCreated.count.toLocaleString()}+
              </p>
              <p className="text-slate-400 font-medium">Quotes Created</p>
            </div>
            <div ref={hourssSaved.ref}>
              <p className="text-4xl md:text-5xl font-black text-white mb-2">
                {hourssSaved.count.toLocaleString()}+
              </p>
              <p className="text-slate-400 font-medium">Hours Saved</p>
            </div>
            <div ref={activeUsers.ref}>
              <p className="text-4xl md:text-5xl font-black text-white mb-2">
                {activeUsers.count.toLocaleString()}+
              </p>
              <p className="text-slate-400 font-medium">Active Tradespeople</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Everything You Need to Run Your Trade
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From quote to payment, TradeSync handles it all. Built by tradespeople, for tradespeople.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Feature list */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <button
                  key={index}
                  onClick={() => setActiveFeature(index)}
                  className={`w-full text-left p-6 rounded-2xl transition-all duration-300 ${
                    activeFeature === index
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-xl shadow-teal-500/25 scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      activeFeature === index ? 'bg-white/20' : 'bg-teal-100'
                    }`}>
                      <feature.icon size={24} className={activeFeature === index ? 'text-white' : 'text-teal-600'} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg mb-1 ${activeFeature === index ? 'text-white' : 'text-slate-900'}`}>
                        {feature.title}
                      </h3>
                      <p className={`text-sm ${activeFeature === index ? 'text-white/80' : 'text-slate-600'}`}>
                        {feature.description}
                      </p>
                    </div>
                    <ChevronRight className={`shrink-0 transition-transform ${
                      activeFeature === index ? 'text-white rotate-90' : 'text-slate-400'
                    }`} />
                  </div>
                </button>
              ))}
            </div>

            {/* Feature detail */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white">
              <div className="mb-6">
                {React.createElement(features[activeFeature].icon, { size: 48, className: 'text-teal-400 mb-4' })}
                <h3 className="text-2xl font-bold mb-3">{features[activeFeature].title}</h3>
                <p className="text-slate-300">{features[activeFeature].description}</p>
              </div>

              <div className="space-y-3">
                {features[activeFeature].details.map((detail, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <Check size={14} className="text-teal-400" />
                    </div>
                    <span className="text-slate-200">{detail}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={onSignUp}
                className="mt-8 w-full bg-gradient-to-r from-teal-500 to-teal-400 text-white py-4 rounded-xl font-bold hover:from-teal-600 hover:to-teal-500 transition-all"
              >
                Try It Free
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-20 md:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Why Tradespeople Choose TradeSync
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              We're not a generic invoicing app. We're built from the ground up for UK trades.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-100 p-4 font-semibold text-slate-700">
              <div>Feature</div>
              <div className="text-center">
                <img src="/tradesync-logo.png" alt="TradeSync" className="h-8 mx-auto rounded" />
              </div>
              <div className="text-center text-slate-500">Others</div>
            </div>

            {comparisons.map((item, index) => (
              <div key={index} className={`grid grid-cols-3 p-4 items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="font-medium text-slate-700">{item.feature}</div>
                <div className="text-center">
                  {item.tradesync && (
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-teal-100 rounded-full">
                      <Check className="text-teal-600" size={18} />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  {item.others === true ? (
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-full">
                      <Check className="text-emerald-600" size={18} />
                    </div>
                  ) : item.others === 'partial' ? (
                    <span className="text-amber-600 text-sm font-medium">Partial</span>
                  ) : item.others === 'paid' ? (
                    <span className="text-orange-600 text-sm font-medium">Paid Add-on</span>
                  ) : (
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full">
                      <X className="text-slate-400" size={18} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Loved by Tradespeople Across the UK
            </h2>
            <p className="text-lg text-slate-600">Real reviews from real trades</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="text-amber-400 fill-amber-400" size={20} />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Simple, Honest Pricing
            </h2>
            <p className="text-lg text-slate-400">No hidden fees. No per-invoice charges. Just one fair price.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
              <p className="text-slate-400 mb-4">Get started for free</p>
              <p className="text-3xl font-black text-white mb-1">FREE</p>
              <p className="text-slate-400 text-sm mb-6">or £9/month for more</p>
              <ul className="space-y-2 mb-6">
                {['Basic job management', 'Up to 5 jobs/month', 'Quotes & invoices', 'Mobile app access'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check size={16} className="text-teal-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className="w-full bg-slate-700 text-white py-3 rounded-xl font-semibold hover:bg-slate-600 transition-colors"
              >
                Start Free
              </button>
            </div>

            {/* Professional */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-2">Professional</h3>
              <p className="text-slate-400 mb-4">For solo tradespeople</p>
              <p className="text-3xl font-black text-white mb-1">£19<span className="text-lg font-normal">/month</span></p>
              <p className="text-slate-400 text-sm mb-6">Billed monthly</p>
              <ul className="space-y-2 mb-6">
                {['Unlimited jobs', 'Unlimited quotes & invoices', 'Materials library', 'Full job pack management', 'Priority support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check size={16} className="text-teal-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className="w-full bg-slate-700 text-white py-3 rounded-xl font-semibold hover:bg-slate-600 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Business - Highlighted */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-6 transform lg:scale-105 shadow-2xl shadow-teal-500/30 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Star size={12} className="fill-amber-900" />
                RECOMMENDED
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Business</h3>
              <p className="text-teal-100 mb-4">Full power features</p>
              <p className="text-3xl font-black text-white mb-1">£29<span className="text-lg font-normal">/month</span></p>
              <p className="text-teal-200 text-sm mb-6">Best value for pros</p>
              <ul className="space-y-2 mb-6">
                {['Everything in Professional', 'AI receipt scanning', 'Bank statement import', 'Auto reconciliation', 'VAT tracking & reports'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-white text-sm">
                    <Check size={16} className="text-white shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className="w-full bg-white text-teal-600 py-3 rounded-xl font-bold hover:bg-teal-50 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
              <p className="text-slate-400 mb-4">For teams & agencies</p>
              <p className="text-3xl font-black text-white mb-1">£45<span className="text-lg font-normal">/month</span></p>
              <p className="text-slate-400 text-sm mb-6">3 users included</p>
              <ul className="space-y-2 mb-6">
                {['Everything in Business', 'Team collaboration (3 users)', 'Multi-business support', 'Advanced reporting', 'Dedicated support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check size={16} className="text-teal-400 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignUp}
                className="w-full bg-slate-700 text-white py-3 rounded-xl font-semibold hover:bg-slate-600 transition-colors"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">
            Ready to Sync Your Trade Business?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Join hundreds of UK tradespeople who've already made the switch.
            Start your free trial today — no card required.
          </p>
          <button
            onClick={onSignUp}
            className="group bg-gradient-to-r from-teal-600 to-teal-500 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:from-teal-700 hover:to-teal-600 transition-all shadow-xl shadow-teal-500/30 inline-flex items-center gap-3"
          >
            Start Your Free Trial
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/tradesync-logo.png" alt="TradeSync" className="h-10 rounded-lg" />
              <span className="text-slate-400 text-sm">© 2026 TradeSync. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rotation, 0deg)); }
          50% { transform: translateY(-10px) rotate(var(--rotation, 0deg)); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
