import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Download, Monitor, FileText, Loader2, AlertCircle } from 'lucide-react';
import API_BASE from '../api';

export default function PdfViewerModal({ isOpen, onClose, pdfPath, title = "Document Preview" }) {
  const [loading, setLoading] = useState(true);
  const [systemLaunching, setSystemLaunching] = useState(false);
  const [systemMsg, setSystemMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSystemMsg('');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, pdfPath]);

  if (!isOpen || !pdfPath) return null;

  const viewUrl = `${API_BASE}/api/pdf/view?path=${encodeURIComponent(pdfPath)}`;
  const downloadUrl = `${API_BASE}/api/pdf/download?path=${encodeURIComponent(pdfPath)}`;
  const filename = pdfPath.split(/[\/\\]/).pop() || 'document.pdf';

  const handleOpenNewTab = () => {
    window.open(viewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenSystemApp = async () => {
    setSystemLaunching(true);
    setSystemMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/pdf/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pdfPath })
      });
      if (res.ok) {
        setSystemMsg('Launched in system PDF reader.');
      } else {
        const txt = await res.text();
        setSystemMsg('System launcher: ' + txt);
      }
    } catch (err) {
      setSystemMsg('Could not launch system reader: ' + err.message);
    } finally {
      setSystemLaunching(false);
      setTimeout(() => setSystemMsg(''), 4000);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-5xl h-[92vh] flex flex-col bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface-lowest/90 border-b border-outline-variant/20 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-on-surface truncate">
                {title}
              </h3>
              <p className="text-[11px] font-mono text-on-surface-variant/70 truncate" title={pdfPath}>
                {filename}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {systemMsg && (
              <span className="text-[11px] text-secondary font-medium px-2 py-1 rounded bg-secondary/10 border border-secondary/20 animate-fade-in hidden sm:inline-block">
                {systemMsg}
              </span>
            )}

            <button
              onClick={handleOpenSystemApp}
              disabled={systemLaunching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container/60 hover:bg-surface-container-high border border-outline-variant/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Launch in Desktop PDF Reader (Acrobat/Edge)"
            >
              <Monitor className="h-3.5 w-3.5 text-secondary" />
              <span className="hidden md:inline">Desktop App</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container/60 hover:bg-surface-container-high border border-outline-variant/30 transition-all cursor-pointer active:scale-95"
              title="Open in Full Browser Tab"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <a
              href={downloadUrl}
              download={filename}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-on-primary bg-primary hover:bg-primary/90 transition-all shadow-md shadow-primary/10 cursor-pointer active:scale-95"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <div className="h-5 w-px bg-outline-variant/30 mx-1 hidden sm:block" />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/80 transition-colors cursor-pointer"
              title="Close Preview (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Embedded PDF View */}
        <div className="flex-1 relative bg-surface-lowest flex flex-col overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-lowest text-on-surface-variant">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <span className="text-xs font-medium">Loading document...</span>
            </div>
          )}

          <iframe
            src={viewUrl}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            className="w-full h-full border-0 rounded-b-2xl"
            title={title}
          />

          <noscript>
            <div className="p-8 text-center text-on-surface-variant">
              <AlertCircle className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-semibold">Your browser does not support inline iframes.</p>
              <a href={downloadUrl} className="mt-3 inline-block text-primary underline text-xs font-bold">
                Download PDF ({filename})
              </a>
            </div>
          </noscript>
        </div>
      </div>
    </div>,
    document.body
  );
}
