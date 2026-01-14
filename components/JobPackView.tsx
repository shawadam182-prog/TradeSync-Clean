
import React, { useState, useRef, useEffect } from 'react';
import { JobPack, Customer, Quote, SiteNote, SitePhoto, SiteDocument } from '../types';
import {
  ArrowLeft, Camera, Mic, FileText, Plus, Trash2,
  Clock, CheckCircle2, Image as ImageIcon,
  MessageSquare, History, FileDown, Paperclip, Loader2, Send,
  FileCheck, ReceiptText, FolderOpen, Sparkles, PackageSearch, Navigation,
  StickyNote, Eraser, MicOff, Ruler, X, RotateCw, Pencil, Check
} from 'lucide-react';
import { MaterialsTracker } from './MaterialsTracker';
import { hapticTap } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';

interface JobPackViewProps {
  project: JobPack;
  customers: Customer[];
  quotes: Quote[];
  onSaveProject: (project: JobPack) => void;
  onViewQuote: (id: string) => void;
  onCreateQuote: () => void;
  onBack: () => void;
  onDeleteProject?: (id: string) => Promise<void>;
}

export const JobPackView: React.FC<JobPackViewProps> = ({
  project, customers, quotes, onSaveProject, onViewQuote, onCreateQuote, onBack, onDeleteProject
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'photos' | 'drawings' | 'materials' | 'finance'>('log');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionInstance = useRef<any>(null);
  const toast = useToast();

  const [notepadContent, setNotepadContent] = useState(project.notepad || '');

  // Modal states
  const [selectedImage, setSelectedImage] = useState<{item: SitePhoto, type: 'photo' | 'drawing'} | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [tempCaption, setTempCaption] = useState('');

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(project.title);

  // Delete entire job pack
  const handleDeleteProject = async () => {
    hapticTap();
    if (window.confirm(`Delete job pack "${project.title}"? This will remove all photos, drawings, notes, and materials. This cannot be undone.`)) {
      try {
        await onDeleteProject?.(project.id);
        toast.success('Job Pack Deleted', `"${project.title}" has been removed`);
        onBack();
      } catch (err) {
        toast.error('Delete Failed', 'Could not delete job pack');
      }
    }
  };

  // Keep internal notepad state in sync with project prop when it changes externally
  useEffect(() => {
    setNotepadContent(project.notepad || '');
  }, [project.notepad]);

  // Sync temp title when project changes
  useEffect(() => {
    setTempTitle(project.title);
  }, [project.title]);

  const customer = customers.find(c => c.id === project.customerId);

  const handleSaveNotepad = (content: string) => {
    onSaveProject({
      ...project,
      notepad: content,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveTitle = () => {
    if (!tempTitle.trim()) {
      setTempTitle(project.title);
      setIsEditingTitle(false);
      return;
    }
    onSaveProject({
      ...project,
      title: tempTitle.trim(),
      updatedAt: new Date().toISOString()
    });
    setIsEditingTitle(false);
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    if (isRecording) {
      recognitionInstance.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-GB';

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognition.onresult = (event: any) => {
      if (event.results?.[0]?.[0]?.transcript) {
        const transcript = event.results[0][0].transcript;
        const updated = notepadContent ? `${notepadContent}\n${transcript}` : transcript;
        setNotepadContent(updated);
        handleSaveNotepad(updated);
      }
    };
    recognition.onerror = () => setIsRecording(false);

    recognitionInstance.current = recognition;
    recognition.start();
  };

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const photo: SitePhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: ev.target?.result as string,
            caption: 'New Site Photo',
            timestamp: new Date().toISOString(),
            tags: ['site']
          };
          onSaveProject({
            ...project,
            photos: [photo, ...project.photos],
            updatedAt: new Date().toISOString()
          });
        };
        reader.onerror = () => {
          console.error('Failed to read photo file');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleAddDrawing = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const drawing: SitePhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: ev.target?.result as string,
            caption: 'Technical Drawing',
            timestamp: new Date().toISOString(),
            tags: ['drawing']
          };
          onSaveProject({
            ...project,
            drawings: [drawing, ...(project.drawings || [])],
            updatedAt: new Date().toISOString()
          });
        };
        reader.onerror = () => {
          console.error('Failed to read drawing file');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const openImageViewer = (item: SitePhoto, type: 'photo' | 'drawing') => {
    setSelectedImage({ item, type });
    setRotation(0);
    setTempCaption(item.caption || '');
    setIsEditingCaption(false);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const saveAnnotation = () => {
    if (!selectedImage) return;

    const listKey = selectedImage.type === 'photo' ? 'photos' : 'drawings';
    const updatedList = (project[listKey] || []).map(p => 
      p.id === selectedImage.item.id ? { ...p, caption: tempCaption } : p
    );

    onSaveProject({
      ...project,
      [listKey]: updatedList,
      updatedAt: new Date().toISOString()
    });
    
    setSelectedImage({ 
      ...selectedImage, 
      item: { ...selectedImage.item, caption: tempCaption } 
    });
    setIsEditingCaption(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Large View Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          {/* Header Controls */}
          <div className="flex items-center justify-between p-6 bg-slate-900/50 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl text-white">
                {selectedImage.type === 'photo' ? <ImageIcon size={24} /> : <Ruler size={24} />}
              </div>
              <div className="text-left">
                <h3 className="text-white font-black text-lg leading-none uppercase tracking-tight">
                  {selectedImage.type === 'photo' ? 'Site Photo' : 'Technical Drawing'}
                </h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  Captured: {new Date(selectedImage.item.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRotate}
                className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                title="Rotate 90°"
              >
                <RotateCw size={24} />
              </button>
              <button 
                onClick={closeImageViewer}
                className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Main Viewport */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-8 overflow-hidden">
            <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden bg-slate-950/50 rounded-[40px] border border-white/5">
              <img 
                src={selectedImage.item.url} 
                className="max-w-full max-h-full object-contain transition-transform duration-300" 
                style={{ transform: `rotate(${rotation}deg)` }}
                alt="Large View"
              />
            </div>

            {/* Annotation Sidebar */}
            <div className="w-full md:w-80 bg-white/5 p-8 rounded-[40px] border border-white/10 flex flex-col gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Annotations</h4>
                  <button 
                    onClick={() => setIsEditingCaption(!isEditingCaption)}
                    className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                  >
                    <Pencil size={18} />
                  </button>
                </div>
                
                {isEditingCaption ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white font-medium text-sm outline-none focus:border-amber-500 transition-all min-h-[120px]"
                      value={tempCaption}
                      onChange={(e) => setTempCaption(e.target.value)}
                      placeholder="Enter notes/caption..."
                    />
                    <button 
                      onClick={saveAnnotation}
                      className="w-full bg-amber-500 text-slate-900 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20"
                    >
                      Save Annotation
                    </button>
                  </div>
                ) : (
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                    <p className="text-white font-bold italic leading-relaxed text-sm">
                      {selectedImage.item.caption || "No annotations added yet."}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>File Reference</span>
                  <span className="text-slate-300">{selectedImage.item.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedImage.item.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-tighter italic">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all border border-slate-200 shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          {onDeleteProject && (
            <button
              onClick={handleDeleteProject}
              className="p-3 bg-white hover:bg-red-50 rounded-2xl text-slate-300 hover:text-red-500 transition-all border border-slate-200 hover:border-red-200 shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Delete job pack"
            >
              <Trash2 size={18} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 group/title">
              <FolderOpen className="text-amber-500 shrink-0" size={18}/>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    className="text-2xl font-black text-slate-900 tracking-tight bg-slate-50 border-b-2 border-amber-500 outline-none px-1"
                    value={tempTitle}
                    onChange={e => setTempTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') { setTempTitle(project.title); setIsEditingTitle(false); }
                    }}
                  />
                  <button onClick={handleSaveTitle} className="p-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm">
                    <Check size={16} />
                  </button>
                  <button onClick={() => { setTempTitle(project.title); setIsEditingTitle(false); }} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-all shadow-sm">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight hover:text-amber-600 transition-colors">{project.title}</h2>
                  <Pencil size={14} className="text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{customer?.name} • {customer?.company || 'Private Client'}</p>
              {customer?.address && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-md hover:bg-amber-100 transition-all group/nav"
                >
                  <Navigation size={10} className="group-hover/nav:animate-pulse" /> Map Site
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAddPhoto} className="p-3 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:border-amber-400 transition-all shadow-sm">
            <Camera size={24} />
          </button>
          <button onClick={toggleRecording} className={`p-3 rounded-2xl transition-all shadow-md ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white hover:bg-black'}`}>
            <Mic size={24} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-1 md:gap-8 px-2">
        {[
          { id: 'log', label: 'Notepad', icon: StickyNote },
          { id: 'photos', label: 'Photos', icon: ImageIcon },
          { id: 'drawings', label: 'Drawings', icon: Ruler },
          { id: 'materials', label: 'Materials', icon: PackageSearch },
          { id: 'finance', label: 'Finances', icon: ReceiptText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 md:gap-2 pb-4 px-2 md:px-0 text-[10px] md:text-xs font-black uppercase tracking-tight md:tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={14} className="md:w-4 md:h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'log' && (
        <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center px-2">
             <div className="flex items-center gap-2">
               <StickyNote className="text-amber-500" size={16}/>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Site Notes & Daily Log</h3>
             </div>
             <div className="flex gap-2">
               <button 
                 onClick={() => { if(confirm('Clear notepad?')) { setNotepadContent(''); handleSaveNotepad(''); } }} 
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase hover:bg-red-50 hover:text-red-500 transition-all"
               >
                 <Eraser size={12}/> Clear Pad
               </button>
               <button 
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-amber-500 text-white shadow-lg shadow-amber-200'}`}
               >
                {isRecording ? <MicOff size={12}/> : <Mic size={12}/>}
                {isRecording ? 'Listening' : 'Dictate'}
               </button>
             </div>
          </div>

          <div className="bg-[#fffdf2] rounded-[32px] border-2 border-amber-100 shadow-xl relative min-h-[500px] overflow-hidden flex flex-col">
            {/* Notepad lines decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px)', backgroundSize: '100% 2.5rem' }}></div>
            
            <textarea 
              className="w-full flex-1 bg-transparent p-10 text-lg font-medium text-slate-800 outline-none resize-none leading-[2.5rem] relative z-10 placeholder:text-amber-200 placeholder:italic"
              placeholder="Start typing your site notes here, or use the mic to dictate..."
              value={notepadContent}
              onChange={(e) => {
                setNotepadContent(e.target.value);
                handleSaveNotepad(e.target.value);
              }}
            />
            
            <div className="p-4 border-t border-amber-50 bg-[#fffef7] flex justify-between items-center text-[9px] font-black text-amber-300 uppercase tracking-widest italic relative z-10 px-10">
              <span>Job Pack Ref: {project.id}</span>
              <span>Last Synchronized: {new Date(project.updatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-6 py-3 bg-amber-50 rounded-2xl border border-amber-100 text-[10px] font-bold text-amber-700 italic">
             <Sparkles size={12} className="shrink-0" />
             Notes are automatically saved to the Job Pack as you type. Use dictation for hands-free site updates.
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in">
          <button onClick={handleAddPhoto} className="aspect-square border-4 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-all bg-white"><Plus size={40} /><span className="text-[10px] font-black uppercase mt-2">Add Photo</span></button>
          {project.photos.map(photo => (
            <div 
              key={photo.id} 
              onClick={() => openImageViewer(photo, 'photo')}
              className="aspect-square relative group overflow-hidden rounded-3xl border-2 border-slate-100 cursor-pointer"
            >
              <img src={photo.url} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" alt="Site" />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <Plus className="text-white" size={32} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onSaveProject({...project, photos: project.photos.filter(p => p.id !== photo.id)}); }} 
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'drawings' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in">
          <button onClick={handleAddDrawing} className="aspect-square border-4 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-all bg-white"><Plus size={40} /><span className="text-[10px] font-black uppercase mt-2">Add Drawing</span></button>
          {(project.drawings || []).map(drawing => (
            <div 
              key={drawing.id} 
              onClick={() => openImageViewer(drawing, 'drawing')}
              className="aspect-square relative group overflow-hidden rounded-3xl border-2 border-slate-100 cursor-pointer"
            >
              <img src={drawing.url} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" alt="Drawing" />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <Plus className="text-white" size={32} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onSaveProject({...project, drawings: (project.drawings || []).filter(p => p.id !== drawing.id)}); }} 
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'materials' && (
        <MaterialsTracker project={project} quotes={quotes} onSaveProject={onSaveProject} />
      )}

      {activeTab === 'finance' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Financials</h3>
            <button onClick={onCreateQuote} className="bg-amber-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase shadow-lg">+ New Doc</button>
          </div>
          <div className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Document</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td className="px-6 py-4"><p className="text-sm font-black text-slate-900">{q.title}</p></td>
                    <td className="px-6 py-4 text-right"><button onClick={() => onViewQuote(q.id)} className="text-amber-500 font-black text-xs uppercase">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
