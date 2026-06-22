'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  FileText,
  FileCheck,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface BookItem {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  price: number;
  interior_pdf_url: string;
  cover_pdf_url: string;
  pod_package_id: string;
  is_active: boolean;
  created_at: string;
}

export default function BooksCatalog() {
  const params = useParams();
  const clientSlug = params['client-slug'] as string;

  const [clientId, setClientId] = useState<string | null>(null);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // validation drawer state
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form states
  const presets = [
    { label: 'US Trade (6"x9") - B&W Standard, Cream Paper, Matte Cover', value: '0600X0900.BW.STD.PB.060UC444.MXX' },
    { label: 'US Trade (6"x9") - B&W Standard, White Paper, Matte Cover', value: '0600X0900.BW.STD.PB.060UW444.MXX' },
    { label: 'US Trade (6"x9") - Full Color Standard, White Paper, Matte Cover', value: '0600X0900.FC.STD.PB.060UW444.MXX' },
    { label: 'Digest (5.5"x8.5") - B&W Standard, Cream Paper, Matte Cover', value: '0550X0850.BW.STD.PB.060UC444.MXX' },
    { label: 'Digest (5.5"x8.5") - B&W Standard, White Paper, Matte Cover', value: '0550X0850.BW.STD.PB.060UW444.MXX' },
    { label: 'Custom / Manual SKU Entry', value: 'custom' }
  ];

  const [selectedPreset, setSelectedPreset] = useState('0600X0900.BW.STD.PB.060UC444.MXX');
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [interiorFile, setInteriorFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [podPackageId, setPodPackageId] = useState('0600X0900.BW.STD.PB.060UC444.MXX');
  const [submitting, setSubmitting] = useState(false);

  const loadBooksData = async () => {
    setLoading(true);
    try {
      const { data: clientData } = await supabaseClient
        .from('tenants')
        .select('id')
        .eq('slug', clientSlug)
        .single();

      if (clientData) {
        setClientId(clientData.id);
        
        const { data: booksData } = await supabaseClient
          .from('books')
          .select('*')
          .eq('tenant_id', clientData.id)
          .order('title');

        if (booksData) {
          setBooks(booksData);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load book catalog data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientSlug) {
      loadBooksData();
    }
  }, [clientSlug]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    if (!interiorFile || !coverFile) {
      toast.error('Please select both Interior and Cover PDF files.');
      return;
    }
    setSubmitting(true);

    try {
      // 1. Upload Interior PDF
      setUploadStatus('Uploading interior...');
      const interiorPath = `${clientSlug}/${Date.now()}-interior-${interiorFile.name.replace(/\s+/g, '_')}`;
      const { error: intError } = await supabaseClient.storage
        .from('books')
        .upload(interiorPath, interiorFile, { cacheControl: '3600', upsert: false });

      if (intError) throw new Error(`Interior PDF upload failed: ${intError.message}`);

      // 2. Upload Cover PDF
      setUploadStatus('Uploading cover...');
      const coverPath = `${clientSlug}/${Date.now()}-cover-${coverFile.name.replace(/\s+/g, '_')}`;
      const { error: covError } = await supabaseClient.storage
        .from('books')
        .upload(coverPath, coverFile, { cacheControl: '3600', upsert: false });

      if (covError) throw new Error(`Cover PDF upload failed: ${covError.message}`);

      // 3. Get Public URLs
      const { data: { publicUrl: finalInteriorUrl } } = supabaseClient.storage
        .from('books')
        .getPublicUrl(interiorPath);

      const { data: { publicUrl: finalCoverUrl } } = supabaseClient.storage
        .from('books')
        .getPublicUrl(coverPath);

      // 4. Save Book to Database
      setUploadStatus('Publishing book...');
      const { error } = await supabaseClient
        .from('books')
        .insert({
          tenant_id: clientId,
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          interior_pdf_url: finalInteriorUrl,
          cover_pdf_url: finalCoverUrl,
          pod_package_id: podPackageId.trim(),
          is_active: true
        });

      if (error) throw error;

      setShowAddForm(false);
      setTitle('');
      setDescription('');
      setPrice('');
      setInteriorFile(null);
      setCoverFile(null);
      setPodPackageId('');
      toast.success('Book published successfully');
      await loadBooksData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish book entry.');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!window.confirm('Delete this book from the catalog permanently?')) return;
    try {
      const { error } = await supabaseClient
        .from('books')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Book deleted successfully');
      await loadBooksData();
      if (selectedBook?.id === id) {
        setDrawerOpen(false);
        setSelectedBook(null);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete book');
    }
  };

  const handleOpenDrawer = (book: BookItem) => {
    setSelectedBook(book);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Book Catalog</h2>
          <p className="text-xs text-muted-foreground">
            Manage manuscripts, printing templates, and pricing structures.
          </p>
        </div>
        
        <button
          onClick={() => {
            setSelectedPreset('0600X0900.BW.STD.PB.060UC444.MXX');
            setPodPackageId('0600X0900.BW.STD.PB.060UC444.MXX');
            setTitle('');
            setDescription('');
            setPrice('');
            setInteriorFile(null);
            setCoverFile(null);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-md transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Book</span>
        </button>
      </div>

      {/* Add Book Dialog Overlay */}
      <AnimatePresence>
        {showAddForm && (
          <div 
            onClick={() => setShowAddForm(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground w-full max-w-lg rounded-lg border shadow-lg p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm uppercase tracking-wider">Publish New Title</h3>
                <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBook} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Book Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Injustices of Life"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Retail Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="19.99"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Book Format Preset</label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPreset(val);
                        if (val !== 'custom') {
                          setPodPackageId(val);
                        } else {
                          setPodPackageId('');
                        }
                      }}
                      className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                    >
                      {presets.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Lulu SKU / Package ID</label>
                  <input
                    type="text"
                    required
                    disabled={selectedPreset !== 'custom'}
                    placeholder="e.g. 0600X0900.BW.STD.PB.060UC444.MXX"
                    value={podPackageId}
                    onChange={(e) => setPodPackageId(e.target.value)}
                    className={`w-full h-10 px-3 rounded-md border text-sm outline-none focus:ring-1 focus:ring-ring font-mono ${
                      selectedPreset !== 'custom' ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                    }`}
                  />
                  {selectedPreset === 'custom' && (
                    <div className="bg-muted/40 border rounded-md p-3 space-y-2 mt-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[9px] text-muted-foreground uppercase tracking-wide">SKU Lookup Resources</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Lulu package IDs follow a dotted format: <code className="font-mono text-foreground font-semibold">Trim.Ink.Quality.Binding.Paper.Finish</code>.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
                        <a 
                          href="https://www.lulu.com/pricing" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center justify-center gap-1 p-1.5 rounded border bg-background hover:bg-muted text-primary hover:underline transition-colors font-medium text-center"
                        >
                          🌐 Pricing Calculator ↗
                        </a>
                        <a 
                          href="https://assets.lulu.com/media/specs/lulu-print-api-spec-sheet.xlsx" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center justify-center gap-1 p-1.5 rounded border bg-background hover:bg-muted text-primary hover:underline transition-colors font-medium text-center"
                        >
                          📊 Excel Spec Sheet ↗
                        </a>
                      </div>
                      
                      <details className="text-[10px] text-muted-foreground pt-1.5 border-t">
                        <summary className="cursor-pointer font-semibold text-foreground hover:underline select-none">
                          View Code Structure Guide
                        </summary>
                        <div className="mt-2 space-y-1.5 font-mono text-[9px] bg-background p-2 rounded border leading-normal">
                          <p><strong className="text-foreground">Trim:</strong> 0600X0900 (6x9&quot;), 0550X0850 (5.5x8.5&quot;)</p>
                          <p><strong className="text-foreground">Ink:</strong> BW (B&W), FC (Full Color)</p>
                          <p><strong className="text-foreground">Quality:</strong> STD (Standard Standard), PRE (Premium)</p>
                          <p><strong className="text-foreground">Binding:</strong> PB (Paperback), HC (Hardcover)</p>
                          <p><strong className="text-foreground">Paper:</strong> 060UC444 (60# Cream), 060UW444 (60# White)</p>
                          <p><strong className="text-foreground">Finish:</strong> MXX (Matte), GXX (Gloss)</p>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <textarea
                    placeholder="Summary of the book content..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-20 p-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Interior PDF Manuscript</label>
                    <div className="relative border border-dashed rounded-md bg-background hover:bg-muted/40 transition-colors h-24 flex flex-col items-center justify-center p-3 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        required
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setInteriorFile(file);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileText className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] font-medium text-foreground truncate max-w-full px-2">
                        {interiorFile ? interiorFile.name : 'Choose Interior PDF'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {interiorFile ? `${(interiorFile.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF format only'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Cover PDF Wrap</label>
                    <div className="relative border border-dashed rounded-md bg-background hover:bg-muted/40 transition-colors h-24 flex flex-col items-center justify-center p-3 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        required
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setCoverFile(file);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileText className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] font-medium text-foreground truncate max-w-full px-2">
                        {coverFile ? coverFile.name : 'Choose Cover PDF'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {coverFile ? `${(coverFile.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF format only'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-md flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] text-xs"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      <span>{uploadStatus}</span>
                    </>
                  ) : (
                    'Publish Title'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Catalog Listing */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-lg bg-card p-5 space-y-4 shadow-sm animate-pulse">
              <div className="flex items-start gap-4">
                <div className="h-14 w-11 shrink-0 rounded bg-muted shadow-sm" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="border rounded-lg bg-card text-card-foreground p-12 text-center shadow-sm">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-bold text-sm">Empty Catalog</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            There are no books uploaded for this client yet. Start by publishing a title.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {books.map((book) => (
            <div
              key={book.id}
              onClick={() => handleOpenDrawer(book)}
              className="border rounded-lg bg-card text-card-foreground p-5 flex flex-col justify-between space-y-4 cursor-pointer hover:shadow transition-all group shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="h-14 w-11 shrink-0 rounded border bg-muted flex items-center justify-center text-muted-foreground shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="font-bold text-sm leading-tight truncate">{book.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{book.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="font-bold text-sm">
                  ${Number(book.price).toFixed(2)}
                </span>
                
                <button
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground group-hover:translate-x-1 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDrawer(book);
                  }}
                >
                  <span>PDF Validation</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-out Drawer Panel for validation */}
      <AnimatePresence>
        {drawerOpen && selectedBook && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            />

            {/* Panel (shadcn Sheet style) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card text-card-foreground border-l shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-xs uppercase tracking-wider">POD Asset Validation</h3>
                  </div>
                  
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Book Summary */}
                <div className="space-y-1">
                  <h4 className="font-bold text-base leading-tight">{selectedBook.title}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground">ID: {selectedBook.id}</span>
                </div>

                {/* Validation Checks */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase block">Validation Checklist</span>
                  
                  <div className="p-3 rounded-lg border bg-muted/30 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold">PDF Dimension Boundaries</p>
                      <p className="text-[10px] text-muted-foreground">Trim size matches 6.0&quot; x 9.0&quot; standard</p>
                    </div>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold">Page Count Format</p>
                      <p className="text-[10px] text-muted-foreground">Multiple of 4 pages (Lulu print requirement)</p>
                    </div>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold">Color Profiles & Gamuts</p>
                      <p className="text-[10px] text-muted-foreground">RGB/CMYK levels calibrated for matte finish</p>
                    </div>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold">Lulu Package Linkage</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{selectedBook.pod_package_id}</p>
                    </div>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                  </div>
                </div>

                {/* Storage Links */}
                <div className="space-y-2 pt-4 border-t text-xs">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase block mb-1">Asset File Links</span>
                  <div className="space-y-1 text-primary">
                    <a href={selectedBook.interior_pdf_url} target="_blank" rel="noopener noreferrer" className="block truncate hover:underline">
                      📄 Interior PDF Manuscript
                    </a>
                    <a href={selectedBook.cover_pdf_url} target="_blank" rel="noopener noreferrer" className="block truncate hover:underline">
                      🎨 Cover Wrap PDF
                    </a>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <button
                  onClick={() => handleDeleteBook(selectedBook.id)}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-destructive/20 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-all active:scale-[0.98]"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Unpublish Book</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
