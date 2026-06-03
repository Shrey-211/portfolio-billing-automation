import { useEffect, useState, useRef } from 'react';
import API_BASE from '../api';
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  Folder, 
  RefreshCw, 
  ChevronDown, 
  FileText,
  AlertCircle,
  X,
  Clock
} from 'lucide-react';

export default function Results({ batchId, setBatchId }) {
  const [batchesList, setBatchesList] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Email sending status state
  const [emailProgressOpen, setEmailProgressOpen] = useState(false);
  const [emailProgress, setEmailProgress] = useState({
    running: false,
    total: 0,
    completed: 0,
    failed: 0,
    logs: []
  });
  
  const emailLogsContainerRef = useRef(null);
  let emailPollInterval = useRef(null);

  useEffect(() => {
    fetchRecentBatches();
  }, []);

  useEffect(() => {
    if (batchId) {
      fetchBatchResults(batchId);
    }
  }, [batchId]);

  useEffect(() => {
    if (emailLogsContainerRef.current) {
      emailLogsContainerRef.current.scrollTop = emailLogsContainerRef.current.scrollHeight;
    }
  }, [emailProgress.logs]);

  const fetchRecentBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/batch/recent`);
      if (res.ok) {
        const data = await res.json();
        setBatchesList(data);
        
        if (!batchId && data.length > 0) {
          setBatchId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load batches:", err);
    }
  };

  const fetchBatchResults = async (id) => {
    setLoading(true);
    try {
      const found = batchesList.find(b => b.id === id);
      if (found) {
        setActiveBatch(found);
      } else {
        const resList = await fetch(`${API_BASE}/api/batch/recent`);
        if (resList.ok) {
          const list = await resList.json();
          setBatchesList(list);
          const f = list.find(b => b.id === id);
          if (f) setActiveBatch(f);
        }
      }

      const res = await fetch(`${API_BASE}/api/batch/${id}/results`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        const defaultSelect = data
          .filter(item => item.status === 'Completed')
          .map(item => item.id);
        setSelectedIds(defaultSelect);
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPdf = async (path) => {
    try {
      const res = await fetch(`${API_BASE}/api/pdf/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (!res.ok) {
        alert("Failed to launch PDF viewer on server: " + await res.text());
      }
    } catch (err) {
      console.error("Failed to open PDF file", err);
    }
  };

  const handleOpenFolder = async () => {
    if (!activeBatch || !activeBatch.folder_path) return;
    try {
      const res = await fetch(`${API_BASE}/api/folders/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeBatch.folder_path })
      });
      if (!res.ok) {
        alert("Failed to open folder: " + await res.text());
      }
    } catch (err) {
      console.error("Failed to open directory folder", err);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const successItems = items.filter(item => item.status === 'Completed');
    if (selectedIds.length === successItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(successItems.map(item => item.id));
    }
  };

  const handleSendEmails = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmSend = window.confirm(`Trigger email distribution for ${selectedIds.length} clients?`);
    if (!confirmSend) return;

    try {
      const res = await fetch(`${API_BASE}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: selectedIds })
      });
      
      if (res.ok) {
        setEmailProgressOpen(true);
        startPollingEmailProgress();
      } else {
        alert("Email trigger failed: " + await res.text());
      }
    } catch (err) {
      console.error("Email delivery endpoint failed", err);
    }
  };

  const startPollingEmailProgress = () => {
    if (emailPollInterval.current) clearInterval(emailPollInterval.current);
    pollEmailProgress();
    emailPollInterval.current = setInterval(() => {
      pollEmailProgress();
    }, 600);
  };

  const pollEmailProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/email/progress`);
      if (res.ok) {
        const data = await res.json();
        setEmailProgress(data);
        
        if (!data.running) {
          if (emailPollInterval.current) {
            clearInterval(emailPollInterval.current);
            emailPollInterval.current = null;
          }
          if (batchId) {
            fetchBatchResults(batchId);
          }
        }
      }
    } catch (err) {
      console.error("Mailing poll error:", err);
    }
  };

  const handleCloseEmailProgress = () => {
    setEmailProgressOpen(false);
    if (emailPollInterval.current) {
      clearInterval(emailPollInterval.current);
      emailPollInterval.current = null;
    }
  };

  const isAllSelected = items.filter(i => i.status === 'Completed').length > 0 && 
    selectedIds.length === items.filter(i => i.status === 'Completed').length;

  return (
    <div className="space-y-8 animate-fade-in z-10 relative">
      {/* Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Results & Delivery</h2>
          <p className="mt-1 text-sm text-on-surface-variant font-medium">Review calculated invoices, preview generated PDF assets, and dispatch reports.</p>
        </div>

        {/* Dropdown selector */}
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Batch Run:</label>
          <div className="relative">
            <select
              value={batchId || ''}
              onChange={(e) => setBatchId(parseInt(e.target.value))}
              className="appearance-none bg-surface-lowest border border-[#232d3f]/40 rounded-lg pl-4 pr-10 py-2.5 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              {batchesList.map(b => (
                <option key={b.id} value={b.id}>
                  Run #B-{b.id} ({new Date(b.timestamp.replace(' ', 'T')).toLocaleDateString()})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-on-surface-variant pointer-events-none" />
          </div>
          
          <button
            onClick={() => batchId && fetchBatchResults(batchId)}
            className="p-2.5 bg-surface-lowest hover:bg-surface-container-high border border-outline-variant/30 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Refresh Results"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Batch Overview details */}
      {activeBatch && (
        <div className="glass-panel rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-xs text-primary uppercase font-bold tracking-wider">Active Batch Information</h3>
            <p className="text-xs text-on-surface-variant font-mono break-all">{activeBatch.folder_path}</p>
            <div className="flex flex-wrap gap-2.5 mt-2 font-mono">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                Created: {new Date(activeBatch.timestamp.replace(' ', 'T')).toLocaleString()}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25">
                Passed: {activeBatch.processed_files}
              </span>
              {activeBatch.failed_files > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error border border-error/25">
                  Failed: {activeBatch.failed_files}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleOpenFolder}
              className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-surface-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-lg text-xs font-bold transition-colors border border-outline-variant/30 cursor-pointer"
            >
              <Folder className="mr-2 h-4 w-4" />
              Open Folder
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={handleSendEmails}
                className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs text-on-surface-variant mt-3">Fetching batch results...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/70 border-b border-[#232d3f]/40">
                  <th scope="col" className="py-3 px-6 text-left w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-outline-variant/60 text-primary bg-surface-lowest focus:ring-primary h-4 w-4"
                    />
                  </th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Name</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Valuation</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fee (INR)</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">GST Distribution</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Invoice Total</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">PDFs</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Status</th>
                </tr>
              </thead>
              <tbody className="text-xs text-on-surface divide-y divide-[#232d3f]/20">
                {items.map((item) => {
                  const isSuccess = item.status === 'Completed';
                  const isSelected = selectedIds.includes(item.id);
                  const cgst_sgst = item.cgst > 0 ? (item.cgst + item.sgst) : 0.0;
                  const gstText = item.cgst > 0 
                    ? `CGST+SGST (${item.cgst.toLocaleString('en-IN', {maximumFractionDigits:1})})` 
                    : `IGST (${item.igst.toLocaleString('en-IN', {maximumFractionDigits:1})})`;
                  return (
                    <tr key={item.id} className={`hover:bg-surface-container-highest/30 transition-colors ${!isSuccess ? 'opacity-50' : ''}`}>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <input
                          type="checkbox"
                          disabled={!isSuccess}
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                          className="rounded border-outline-variant/60 text-primary bg-surface-lowest focus:ring-primary h-4 w-4 disabled:opacity-30"
                        />
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-sm font-semibold text-on-surface">
                        {item.client_name}
                        <span className="block text-[10px] text-on-surface-variant font-mono mt-0.5">{item.filename}</span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-on-surface font-mono">
                        ₹{item.valuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-on-surface font-mono">
                        ₹{item.fee_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="block font-mono text-on-surface font-semibold">
                          ₹{(cgst_sgst > 0 ? cgst_sgst : item.igst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-on-surface-variant font-medium">{gstText}</span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap font-bold text-on-surface font-mono">
                        ₹{item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isSuccess ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25">
                            Success
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error border border-error/25 cursor-pointer"
                            title={item.error_msg}
                          >
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isSuccess ? (
                          <div className="flex gap-2.5">
                            <button
                              onClick={() => handleOpenPdf(item.portfolio_pdf_path)}
                              className="text-primary hover:text-primary-container font-semibold flex items-center gap-0.5 cursor-pointer"
                              title="Open Portfolio"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Port
                            </button>
                            <span className="text-outline-variant/40">|</span>
                            <button
                              onClick={() => handleOpenPdf(item.invoice_pdf_path)}
                              className="text-primary hover:text-primary-container font-semibold flex items-center gap-0.5 cursor-pointer"
                              title="Open Invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Inv
                            </button>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/40 italic">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {item.email_status === 'Sent' ? (
                          <span className="text-secondary font-semibold flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Sent
                          </span>
                        ) : item.email_status.startsWith('Failed') ? (
                          <span className="text-error font-semibold flex items-center gap-1" title={item.email_status}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        ) : (
                          <span className="text-on-surface-variant flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-outline-variant" />
                            {item.email_status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-on-surface-variant">
            <XCircle className="h-10 w-10 text-outline mx-auto mb-3" />
            <p>No results found for this batch run.</p>
          </div>
        )}
      </div>

      {/* Bulk Email progress dialog modal */}
      {emailProgressOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          <div className="relative w-full max-w-2xl bg-[#10131a] glass-panel border border-[#232d3f]/60 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-surface-container/20 border-b border-[#232d3f]/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 uppercase tracking-wider">
                <Mail className="h-4.5 w-4.5 text-primary" />
                Mailing Calculations Dispatcher
              </h3>
              {!emailProgress.running && (
                <button 
                  onClick={handleCloseEmailProgress}
                  className="text-on-surface-variant hover:text-on-surface rounded-lg p-1 hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Content Progress */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-on-surface">
                  {emailProgress.running ? 'Dispatching reports...' : 'Delivery complete'}
                </span>
                <span className="font-mono text-on-surface-variant">
                  {emailProgress.completed} / {emailProgress.total} sent
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-full h-3.5 p-0.5">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    emailProgress.running ? 'bg-indigo-600 animate-pulse' : 'bg-secondary'
                  }`}
                  style={{ width: `${emailProgress.total > 0 ? (emailProgress.completed / emailProgress.total) * 100 : 0}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-on-surface-variant font-bold border-b border-[#232d3f]/40 pb-3">
                <span>Success: <span className="text-secondary">{emailProgress.completed - emailProgress.failed}</span></span>
                <span>Failed: <span className="text-error">{emailProgress.failed}</span></span>
              </div>

              {/* Logs */}
              <div 
                ref={emailLogsContainerRef}
                className="bg-surface-lowest rounded-lg p-4 h-[250px] overflow-y-auto font-mono text-[10px] leading-relaxed space-y-1.5 border border-[#232d3f]/30 scrollbar-thin"
              >
                {emailProgress.logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-on-surface-variant/30 select-none">&gt;</span>
                    <span className={
                      log.startsWith('Success') ? 'text-secondary font-semibold' :
                      log.startsWith('Failed') ? 'text-error font-semibold' :
                      log.startsWith('Delivery cancelled') ? 'text-amber-400 font-semibold' :
                      'text-on-surface'
                    }>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            {!emailProgress.running && (
              <div className="px-6 py-4 bg-surface-lowest/40 border-t border-[#232d3f]/60 flex items-center justify-end">
                <button
                  onClick={handleCloseEmailProgress}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Dismiss Console
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
