
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { JobPack, Customer, Quote, SiteNote, SitePhoto, SiteDocument } from '../types';
import {
  ArrowLeft, Camera, Mic, FileText, Plus, Trash2,
  Clock, CheckCircle2, Image as ImageIcon,
  MessageSquare, History, FileDown, Paperclip, Loader2, Send,
  FileCheck, ReceiptText, FolderOpen, Sparkles, PackageSearch, Navigation,
  StickyNote, Eraser, MicOff, Ruler, X, RotateCw, Pencil, Check,
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { MaterialsTracker } from './MaterialsTracker';
import { JobProfitSummary } from './JobProfitSummary';
import { hapticTap } from '../src/hooks/useHaptic';
import { useToast } from '../src/contexts/ToastContext';
import { sitePhotosService } from '../src/services/dataService';

interface JobPackViewProps {
  project: JobPack;
  customers: Customer[];
  quotes: Quote[];
  onSaveProject: (project: JobPack) => void;
  onViewQuote: (id: string) => void;
  onCreateQuote: () => void;
  onBack: () => void;
  onDeleteProject?: (id: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const JobPackView: React.FC<JobPackViewProps> = ({
  project, customers, quotes, onSaveProject, onViewQuote, onCreateQuote, onBack, onDeleteProject, onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'photos' | 'drawings' | 'materials' | 'finance'>('log');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const recognitionInstance = useRef<any>(null);
  const toast = useToast();

  const [notepadContent, setNotepadContent] = useState(project.notepad || '');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // File input refs to prevent navigation bugs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [selectedImage, setSelectedImage] = useState<{item: SitePhoto, type: 'photo' | 'drawing'} | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
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

  // Debounced save for notepad to prevent glitchy typing
  const handleSaveNotepad = useCallback((content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      onSaveProject({
        ...project,
        notepad: content,
        updatedAt: new Date().toISOString()
      });
    }, 500); // Save after 500ms of no typing
  }, [project, onSaveProject]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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

  // Unified photo upload handler that works with refs
  const handlePhotoUpload = async (file: File, isDrawing: boolean = false) => {
    if (!file || isUploadingPhoto) return;

    setIsUploadingPhoto(true);
    try {
      // Upload to Supabase Storage
      const dbPhoto = await sitePhotosService.upload(
        project.id,
        file,
        isDrawing ? 'Technical Drawing' : 'New Site Photo',
        isDrawing ? ['drawing'] : ['site'],
        isDrawing
      );

      // Get signed URL for display
      const signedUrl = await sitePhotosService.getUrl(dbPhoto.storage_path);

      if (signedUrl) {
        // Refresh data from database to get the updated photo list
        if (onRefresh) {
          await onRefresh();
        }

        toast.success(isDrawing ? 'Drawing Added' : 'Photo Added',
          isDrawing ? 'Technical drawing uploaded successfully' : 'Site photo uploaded successfully');
      } else {
        throw new Error('Failed to get photo URL');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload Failed', err.message || 'Could not upload file');
    } finally {
      setIsUploadingPhoto(false);
      // Reset all file inputs to prevent duplicate uploads
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (drawingInputRef.current) drawingInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, isDrawing: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file, isDrawing);
    }
  };

  const openImageViewer = (item: SitePhoto, type: 'photo' | 'drawing') => {
    setSelectedImage({ item, type });
    setRotation(0);
    setZoomLevel(1);
    setTempCaption(item.caption || '');
    setIsEditingCaption(false);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    setZoomLevel(1);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
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
    <div className="max-w-6xl mx-auto space-y-3 md:space-y-6 pb-28">
      {/* Large View Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          {/* Header Controls */}
          <div className="flex items-center justify-between p-3 md:p-6 bg-slate-900/50 border-b border-white/10">
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
            <div className="flex items-center gap-2 md:gap-3">
              {/* Zoom controls */}
              <button
                onClick={handleZoomOut}
                className="p-3 md:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl transition-all disabled:opacity-30"
                title="Zoom Out"
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut size={20} className="md:w-6 md:h-6" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-3 py-2 md:px-4 md:py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl transition-all text-xs md:text-sm font-bold min-w-[50px] md:min-w-[60px]"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-3 md:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl transition-all disabled:opacity-30"
                title="Zoom In"
                disabled={zoomLevel >= 4}
              >
                <ZoomIn size={20} className="md:w-6 md:h-6" />
              </button>
              <div className="w-px h-8 bg-white/20 mx-1 md:mx-2" />
              <button
                onClick={handleRotate}
                className="p-3 md:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl transition-all"
                title="Rotate 90°"
              >
                <RotateCw size={20} className="md:w-6 md:h-6" />
              </button>
              <button
                onClick={closeImageViewer}
                className="p-3 md:p-4 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl transition-all"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
          </div>

          {/* Main Viewport */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 md:p-8 gap-8 overflow-hidden">
            <div
              className="flex-1 w-full h-full flex items-center justify-center relative overflow-auto bg-slate-950/50 rounded-[40px] border border-white/5 cursor-grab active:cursor-grabbing"
              onDoubleClick={() => setZoomLevel(prev => prev === 1 ? 2 : 1)}
            >
              <img
                src={selectedImage.item.url}
                className="object-contain transition-transform duration-300"
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoomLevel})`,
                  maxWidth: zoomLevel > 1 ? 'none' : '100%',
                  maxHeight: zoomLevel > 1 ? 'none' : '100%'
                }}
                alt="Large View"
                draggable={false}
              />
            </div>

            {/* Annotation Sidebar */}
            <div className="w-full md:w-80 bg-white/5 p-4 md:p-8 rounded-[40px] border border-white/10 flex flex-col gap-3 md:gap-6">
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

      {/* Unified Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm -mx-4 md:mx-0 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
             {isEditingTitle ? (
               <input
                 autoFocus
                 className="text-lg font-bold text-slate-900 outline-none bg-slate-50 rounded px-2 -ml-2"
                 value={tempTitle}
                 onChange={e => setTempTitle(e.target.value)}
                 onBlur={handleSaveTitle}
               />
             ) : (
               <h1 onClick={() => setIsEditingTitle(true)} className="text-lg font-bold text-slate-900 flex items-center gap-2 cursor-text">
                 {project.title}
               </h1>
             )}
             <p className="text-xs text-slate-500">{customer?.name || 'No Client'}</p>
          </div>
        </div>
        <div className="flex gap-2">
           {customer?.address && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <Navigation size={18} />
                </a>
           )}
           {onDeleteProject && <button onClick={handleDeleteProject} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={18} /></button>}
        </div>
      </div>

      <div className="px-2 pb-4">
        <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-xl w-full">
          {[
            { id: 'log', label: 'Log', icon: StickyNote },
            { id: 'photos', label: 'Photos', icon: ImageIcon },
            { id: 'drawings', label: 'Drawings', icon: Ruler },
            { id: 'materials', label: 'Materials', icon: PackageSearch },
            { id: 'finance', label: 'Finance', icon: ReceiptText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
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
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-teal-500 text-white shadow-lg shadow-teal-200'}`}
               >
                {isRecording ? <MicOff size={12}/> : <Mic size={12}/>}
                {isRecording ? 'Listening' : 'Dictate'}
               </button>
             </div>
          </div>

          <div className="bg-[#fffdf2] rounded-[24px] border border-amber-100 shadow-xl relative min-h-[400px] overflow-hidden flex flex-col">
            {/* Notepad lines decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px)', backgroundSize: '100% 2.5rem' }}></div>
            
            <textarea 
              className="w-full flex-1 bg-transparent p-4 md:p-10 text-base md:text-lg font-medium text-slate-800 outline-none resize-none leading-[2.5rem] relative z-10 placeholder:text-amber-200 placeholder:italic"
              placeholder="Start typing your site notes here, or use the mic to dictate..."
              value={notepadContent}
              onChange={(e) => {
                setNotepadContent(e.target.value);
                handleSaveNotepad(e.target.value);
              }}
            />
            
            <div className="p-3 border-t border-amber-50 bg-[#fffef7] flex justify-between items-center text-[8px] font-black text-amber-300 uppercase tracking-widest italic relative z-10 px-4 md:px-10">
              <span>Ref: {project.id.substr(0,8)}</span>
              <span>Saved: {new Date(project.updatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100 text-[9px] font-bold text-amber-700 italic">
             <Sparkles size={10} className="shrink-0" />
             Notes saved automatically. Use dictation for hands-free updates.
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="animate-in fade-in space-y-4">
          {/* Hidden file inputs */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileInputChange(e, false)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileInputChange(e, false)}
          />

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {/* Camera button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="aspect-square border-2 border-dashed border-amber-300 rounded-xl flex flex-col items-center justify-center text-amber-500 hover:border-amber-400 hover:bg-amber-50 transition-all bg-amber-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingPhoto ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
              <span className="text-[9px] font-bold mt-1">{isUploadingPhoto ? 'Uploading...' : 'Camera'}</span>
            </button>
            {/* Add from files button */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-all bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingPhoto ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
              <span className="text-[9px] font-bold mt-1">{isUploadingPhoto ? 'Uploading...' : 'Add'}</span>
            </button>
            {(project.photos || []).map(photo => (
              <div
                key={photo.id}
                onClick={() => openImageViewer(photo, 'photo')}
                className="aspect-square relative group overflow-hidden rounded-xl border border-slate-100 cursor-pointer"
              >
                <img src={photo.url} className="w-full h-full object-cover" alt="Site" />
                <button
                  onClick={(e) => { e.stopPropagation(); onSaveProject({...project, photos: (project.photos || []).filter(p => p.id !== photo.id)}); }}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'drawings' && (
        <div className="animate-in fade-in space-y-4">
          {/* Hidden file input for drawings */}
          <input
            ref={drawingInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileInputChange(e, true)}
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <button
              onClick={() => drawingInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="aspect-square border-4 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingPhoto ? <Loader2 size={40} className="animate-spin" /> : <Plus size={40} />}
              <span className="text-[10px] font-black uppercase mt-2">{isUploadingPhoto ? 'Uploading...' : 'Add Drawing'}</span>
            </button>
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
        </div>
      )}

      {activeTab === 'materials' && (
        <MaterialsTracker project={project} quotes={quotes} onSaveProject={onSaveProject} />
      )}

      {activeTab === 'finance' && (
        <div className="space-y-3 md:space-y-6 animate-in fade-in">
          {/* Profit Summary for completed jobs */}
          {project.status === 'completed' && (
            <JobProfitSummary jobPackId={project.id} quotes={quotes} />
          )}

          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Financials</h3>
            <button onClick={onCreateQuote} className="bg-teal-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-teal-200">+ New Doc</button>
          </div>
          <div className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Document</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td className="px-4 md:px-6 py-4"><p className="text-sm font-black text-slate-900">{q.title}</p></td>
                    <td className="px-4 md:px-6 py-4 text-right"><button onClick={() => onViewQuote(q.id)} className="text-amber-500 font-black text-xs uppercase">View</button></td>
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
