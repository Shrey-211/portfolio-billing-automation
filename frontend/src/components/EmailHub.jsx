import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API_BASE from '../api';
import { 
  Search, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Paperclip, 
  Eye, 
  RefreshCw,
  PlusCircle,
  Clock,
  X,
  FileText
} from 'lucide-react';
import EmailDraftModal from './EmailDraftModal';

export default function EmailHub() {
  const [emailLogs, setEmailLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'sent', 'failed'
  const [selectedLog, setSelectedLog] = useState(null);

  // Quick compose state
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftPayload, setDraftPayload] = useState({});

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/email/history`);
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch email history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPDF = async (pdfPath) => {
    if (!pdfPath) return;
    try {
      await fetch(`${API_BASE}/api/pdf/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pdfPath })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleComposeNew = () => {
    setDraftPayload({
      client_name: '',
      recipient: '',
      cc: '',
      subject: '',
      body: `Dear Client,\n\n[Please enter message content here]\n\nBest Regards,\nAntigravity Wealth Management`,
      attachments: [],
      email_type: 'custom',
      item_id: null
    });
    setIsDraftOpen(true);
  };

  const filteredLogs = Array.isArray(emailLogs) ? emailLogs.filter(log => {
    const matchSearch = (log.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (log.recipient_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (log.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchStatus = true;
    if (statusFilter === 'sent') {
      matchStatus = log.status === 'Sent';
    } else if (statusFilter === 'failed') {
      matchStatus = log.status === 'Failed';
    }
    
    return matchSearch && matchStatus;
  }) : [];

  return (
    <div className="space-y-8 animate-fade-in relative z-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Mailing Dispatch Hub</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Central logging interface showing historical mail transmissions, failure diagnostics, and draft editors.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEmailLogs}
            className="p-2.5 bg-surface-lowest hover:bg-surface-container-high border border-outline-variant/30 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleComposeNew}
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col gap-4 bg-surface-container/25 border border-outline-variant/10 rounded-xl p-5 glass-panel">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="relative md:col-span-8 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name, email addresses, or email subject keywords..."
              className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg pl-9 pr-4 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-all font-sans"
            />
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-on-surface-variant/50" />
          </div>

          <div className="flex gap-2 md:col-span-4 justify-end w-full">
            {['all', 'sent', 'failed'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-primary/10 text-primary border-primary/25 shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/30'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid List of Logs */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {loading && emailLogs.length === 0 ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs text-on-surface-variant mt-3 font-medium">Loading transmission records...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-surface-lowest/95 backdrop-blur-md">
                <tr className="border-b border-[#232d3f]/40">
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-40">Date</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[160px]">Client</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[200px]">Recipient</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[240px]">Subject</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-28 text-center">Type</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-28 text-center">Status</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-24 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="text-xs text-on-surface divide-y divide-[#232d3f]/20">
                {filteredLogs.map(log => {
                  const attaches = log.attachments ? JSON.parse(log.attachments) : [];
                  return (
                    <tr key={log.id} className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-on-surface-variant">{log.sent_at}</td>
                      <td className="py-4 px-6 font-semibold">{log.client_name || 'Custom Dispatch'}</td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold">{log.recipient_email}</p>
                          {log.cc_email && <p className="text-[9px] text-on-surface-variant truncate">CC: {log.cc_email}</p>}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold truncate max-w-sm">{log.subject}</span>
                          {attaches.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-primary/75 font-semibold font-mono">
                              <Paperclip className="h-2.5 w-2.5" />
                              {attaches.length} attachment(s)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-surface-container-low text-on-surface-variant border border-outline-variant/20 uppercase tracking-wide">
                          {log.email_type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-[9px] font-bold border ${
                          log.status === 'Sent' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error-container/10 text-error border-error-container/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 hover:bg-surface-container-high rounded text-primary hover:text-primary transition-colors cursor-pointer"
                          title="View detailed logs"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-on-surface-variant space-y-3">
            <Mail className="h-10 w-10 text-outline mx-auto" />
            <div>
              <p className="text-sm font-semibold">No mail transmissions found</p>
              <p className="text-xs opacity-75">Sent reports, invoice notifications, and confirmations will show here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Email Compose Draft Popup */}
      <EmailDraftModal
        isOpen={isDraftOpen}
        onClose={() => setIsDraftOpen(false)}
        defaultPayload={draftPayload}
        onSent={fetchEmailLogs}
      />

      {/* Email Body Review Modal */}
      {selectedLog && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-lowest border border-outline-variant/20 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] glass-panel">
            <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Email Contents Review</h3>
                <span className="text-[9px] text-on-surface-variant font-mono">{selectedLog.sent_at}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg hover:bg-surface-container-high/40 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4 scrollbar-thin text-left">
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Recipient</span>
                <p className="font-semibold text-on-surface">{selectedLog.recipient_email} {selectedLog.cc_email ? `(CC: ${selectedLog.cc_email})` : ''}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Subject</span>
                <p className="font-semibold text-primary">{selectedLog.subject}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Message Body</span>
                <p className="bg-surface-container-lowest/80 border border-outline-variant/10 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{selectedLog.body}</p>
              </div>

              {/* Attachments list */}
              {(() => {
                const files = selectedLog.attachments ? JSON.parse(selectedLog.attachments) : [];
                if (files.length === 0) return null;
                return (
                  <div>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Attachments ({files.length})</span>
                    <div className="space-y-1">
                      {files.map((path, idx) => {
                        const fname = path.split('\\').pop().split('/').pop();
                        return (
                          <div key={idx} 
                               onClick={() => handleOpenPDF(path)}
                               className="inline-flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/10 hover:border-primary/30 rounded px-2.5 py-1 text-[10px] cursor-pointer mr-2 mb-1 select-none animate-fade-in"
                          >
                            <Paperclip className="h-3 w-3 text-on-surface-variant" />
                            <span className="text-on-surface font-semibold max-w-[150px] truncate" title={path}>{fname}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {selectedLog.error_msg && (
                <div className="p-3 bg-error-container/10 border border-error-container/20 text-error rounded-lg">
                  <span className="font-bold text-[9px] uppercase block mb-0.5">Delivery Error Log</span>
                  <p className="font-mono">{selectedLog.error_msg}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
