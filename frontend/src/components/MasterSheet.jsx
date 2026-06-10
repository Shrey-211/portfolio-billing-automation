import { useState, useEffect } from 'react';
import API_BASE from '../api';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Download, 
  RefreshCw, 
  Clock, 
  ArrowUpRight, 
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Layers,
  Edit3
} from 'lucide-react';

export default function MasterSheet({ folderPath }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'paid', 'unpaid'
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  // Inline edit state
  const [editingCell, setEditingCell] = useState(null); // { itemId, field }
  const [editCellValue, setEditCellValue] = useState('');
  const [cellLoading, setCellLoading] = useState(null); // itemId

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleStartEditCell = (itemId, field, initialValue) => {
    setEditingCell({ itemId, field });
    setEditCellValue(initialValue);
  };

  const handleKeyDownEditCell = (e, item) => {
    if (e.key === 'Enter') {
      handleSaveEditCell(item);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleSaveEditCell = async (item) => {
    if (!editingCell) return;
    const { itemId, field } = editingCell;
    const value = editCellValue;
    setEditingCell(null);

    // If value didn't change, do nothing
    if (field === 'client_name' && value.trim() === item.client_name) return;
    if (field === 'valuation' && parseFloat(value) === item.valuation) return;

    setCellLoading(itemId);
    try {
      let clientData = {
        client_type: 'Type 1',
        state: 'Maharashtra',
        email: '',
        cc_email: '',
        address: '',
        gstin: ''
      };
      
      const clientRes = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(item.client_name)}`);
      if (clientRes.ok) {
        const data = await clientRes.json();
        clientData = {
          client_type: data.client_type || 'Type 1',
          state: data.state || 'Maharashtra',
          email: data.email || '',
          cc_email: data.cc_email || '',
          address: data.address || '',
          gstin: data.gstin || ''
        };
      }

      const newValuation = field === 'valuation' ? (parseFloat(value) || 0.0) : (item.valuation || 0.0);
      const newClientName = field === 'client_name' ? value.trim() : item.client_name;

      if (field === 'client_name' && !newClientName) {
        showFeedback("Client name cannot be empty.", "error");
        setCellLoading(null);
        return;
      }

      const payload = {
        client_name: newClientName,
        client_type: clientData.client_type,
        state: clientData.state,
        email: clientData.email,
        cc_email: clientData.cc_email,
        address: clientData.address,
        gstin: clientData.gstin,
        valuation: newValuation,
        is_regular: item.status !== 'Skipped (Not Billable)',
        custom_message: item.custom_message || ''
      };

      const res = await fetch(`${API_BASE}/api/invoices/${itemId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchInvoices();
        showFeedback("Invoice record successfully updated.");
      } else {
        showFeedback("Failed to update invoice: " + await res.text(), "error");
      }
    } catch (err) {
      console.error("Error saving inline edit", err);
      showFeedback("Error saving update: " + err.message, "error");
    } finally {
      setCellLoading(null);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/invoices/all`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      } else {
        showFeedback("Failed to retrieve master ledger records.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      showFeedback("Failed connecting to API server.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg({ text: '', type: '' });
    }, 4000);
  };

  const handleMarkPaid = async (id, useDate = null) => {
    const pDate = useDate || new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`${API_BASE}/api/invoices/${id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_paid: 1,
          payment_date: pDate
        })
      });

      if (res.ok) {
        setInvoices(prev => prev.map(inv => {
          if (inv.id === id) {
            return { ...inv, is_paid: 1, payment_date: pDate };
          }
          return inv;
        }));
        setEditPaymentId(null);
        setCustomDate('');
        showFeedback("Invoice payment successfully recorded.");
      } else {
        showFeedback("Failed to update payment status.", "error");
      }
    } catch (err) {
      console.error("Payment update failed:", err);
      showFeedback("Error reaching server.", "error");
    }
  };

  const handleMarkUnpaid = async (id) => {
    if (!window.confirm("Are you sure you want to mark this invoice as unpaid?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/invoices/${id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_paid: 0,
          payment_date: null
        })
      });

      if (res.ok) {
        setInvoices(prev => prev.map(inv => {
          if (inv.id === id) {
            return { ...inv, is_paid: 0, payment_date: null };
          }
          return inv;
        }));
        showFeedback("Invoice marked as unpaid.");
      } else {
        showFeedback("Failed to reset payment status.", "error");
      }
    } catch (err) {
      console.error("Payment reset failed:", err);
      showFeedback("Error reaching server.", "error");
    }
  };

  const handleExportLedger = async () => {
    if (!folderPath) {
      alert("Please select a workspace or folder first on the Dashboard tab.");
      return;
    }
    
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/invoices/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath })
      });

      if (res.ok) {
        const data = await res.json();
        showFeedback(`Ledger exported successfully to ${data.file_path.split('\\').pop()}`);
        
        // Try to open folder or file automatically
        await fetch(`${API_BASE}/api/pdf/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: data.file_path })
        });
      } else {
        const txt = await res.text();
        showFeedback("Export failed: " + txt, "error");
      }
    } catch (err) {
      console.error("Ledger export failed:", err);
      showFeedback("Export request failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = inv.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (inv.filename && inv.filename.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (statusFilter === 'paid') {
      return matchSearch && inv.is_paid === 1;
    }
    if (statusFilter === 'unpaid') {
      return matchSearch && inv.is_paid !== 1;
    }
    return matchSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Master Billing Ledger</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Consolidated records of all client invoices, email dispatches, and collection payment schedules.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoices}
            className="p-2.5 bg-surface-lowest hover:bg-surface-container-high border border-outline-variant/30 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleExportLedger}
            disabled={exporting || invoices.length === 0}
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Feedback Alert banner */}
      {feedbackMsg.text && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 animate-fade-in ${
          feedbackMsg.type === 'error' 
            ? 'bg-error-container/10 border-error-container/20 text-error' 
            : 'bg-secondary/10 border-secondary/20 text-secondary'
        }`}>
          {feedbackMsg.type === 'error' ? <AlertCircle className="h-4.5 w-4.5" /> : <CheckCircle className="h-4.5 w-4.5" />}
          <p className="text-xs font-semibold">{feedbackMsg.text}</p>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-container/25 border border-outline-variant/10 rounded-xl p-4 glass-panel">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant/50" />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {['all', 'paid', 'unpaid'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent cursor-pointer ${
                statusFilter === status 
                  ? 'bg-primary/10 text-primary border-primary/20' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/30'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List Ledger */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        {loading && invoices.length === 0 ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs text-on-surface-variant mt-3 font-medium">Loading ledger logs...</p>
          </div>
        ) : filteredInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/70 border-b border-[#232d3f]/40">
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider w-20 min-w-[80px]">Inv ID</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[240px]">Client Name</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[160px]">Valuation</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[140px]">Fee (INR)</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[140px]">Total + GST</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center min-w-[120px]">Billing</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider min-w-[160px]">Email Dispatch</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center min-w-[160px]">Payment Status</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center min-w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs text-on-surface divide-y divide-[#232d3f]/20">
                {filteredInvoices.map((inv) => {
                  const hasCustomMsg = !!inv.custom_message;
                  return (
                    <tr key={inv.id} className="hover:bg-surface-container-highest/20 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-primary">#I-{inv.id}</td>
                      <td className="py-4 px-6 font-semibold text-on-surface cursor-pointer group hover:bg-surface-container-high/40 transition-colors"
                          onDoubleClick={() => handleStartEditCell(inv.id, 'client_name', inv.client_name)}
                          title="Double-click to edit client name"
                      >
                        {editingCell?.itemId === inv.id && editingCell?.field === 'client_name' ? (
                          <input
                            type="text"
                            value={editCellValue}
                            onChange={(e) => setEditCellValue(e.target.value)}
                            onBlur={() => handleSaveEditCell(inv)}
                            onKeyDown={(e) => handleKeyDownEditCell(e, inv)}
                            autoFocus
                            className="bg-surface-lowest border border-primary rounded px-2.5 py-1 text-xs text-on-surface w-full focus:outline-none focus:ring-1 focus:ring-primary font-sans"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 justify-between">
                            <div>
                              <span>{inv.client_name}</span>
                              <span className="block text-[9px] text-on-surface-variant font-mono mt-0.5" title={inv.filename}>
                                {inv.filename ? inv.filename.split('\\').pop() : '-'}
                              </span>
                            </div>
                            <Edit3 className="h-3.5 w-3.5 text-on-surface-variant/0 group-hover:text-on-surface-variant/70 transition-all ml-2 flex-shrink-0" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-on-surface-variant cursor-pointer group hover:bg-surface-container-high/40 transition-colors"
                          onDoubleClick={() => handleStartEditCell(inv.id, 'valuation', inv.valuation)}
                          title="Double-click to edit valuation"
                      >
                        {editingCell?.itemId === inv.id && editingCell?.field === 'valuation' ? (
                          <input
                            type="number"
                            step="any"
                            value={editCellValue}
                            onChange={(e) => setEditCellValue(e.target.value)}
                            onBlur={() => handleSaveEditCell(inv)}
                            onKeyDown={(e) => handleKeyDownEditCell(e, inv)}
                            autoFocus
                            className="bg-surface-lowest border border-primary rounded px-2.5 py-1 text-xs text-on-surface font-mono w-full focus:outline-none focus:ring-1 focus:ring-primary"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1.5">
                            <span>₹{inv.valuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            <Edit3 className="h-3.5 w-3.5 text-on-surface-variant/0 group-hover:text-on-surface-variant/70 transition-all ml-2 flex-shrink-0" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-on-surface-variant">
                        ₹{inv.fee_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-on-surface">
                        ₹{inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {cellLoading === inv.id ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                            <svg className="animate-spin h-3 w-3 text-primary mr-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border ${
                            inv.status === 'Completed' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                            inv.status.startsWith('Skipped') ? 'bg-surface-container-high text-on-surface-variant/70 border-outline-variant/30' :
                            'bg-error-container/10 text-error border-error-container/20'
                          }`}>
                            {inv.status}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        <span className={`inline-flex items-center gap-1 ${
                          inv.email_status === 'Sent' ? 'text-secondary' :
                          inv.email_status.startsWith('Failed') ? 'text-error' :
                          inv.email_status === 'Skipped' ? 'text-on-surface-variant/50' : 'text-on-surface-variant'
                        }`}>
                          {inv.email_status}
                        </span>
                        {hasCustomMsg && (
                          <span className="block text-[8px] text-primary/70 font-sans tracking-wide mt-0.5 uppercase">Has Custom Note</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {inv.is_paid === 1 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25">
                              <CheckCircle className="h-3 w-3" />
                              Received
                            </span>
                            <span className="block text-[9px] text-on-surface-variant font-mono opacity-80">{inv.payment_date}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Outstanding
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {inv.is_paid === 1 ? (
                          <button
                            onClick={() => handleMarkUnpaid(inv.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-error hover:text-error-container font-semibold border border-error/20 bg-surface-lowest hover:bg-error/5 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Reset Payment
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {editPaymentId === inv.id ? (
                              <div className="flex items-center gap-1.5 bg-surface-lowest border border-outline-variant/30 rounded px-1.5 py-0.5">
                                <input
                                  type="date"
                                  value={customDate}
                                  onChange={(e) => setCustomDate(e.target.value)}
                                  className="bg-transparent text-[10px] text-on-surface outline-none py-0.5 border-none font-mono"
                                />
                                <button
                                  onClick={() => handleMarkPaid(inv.id, customDate)}
                                  className="text-[10px] text-secondary hover:text-secondary-fixed font-bold px-1"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditPaymentId(null);
                                    setCustomDate('');
                                  }}
                                  className="text-[10px] text-on-surface-variant hover:text-on-surface font-bold px-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleMarkPaid(inv.id)}
                                  className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-secondary-fixed font-bold border border-secondary/20 bg-surface-lowest hover:bg-secondary/5 px-2.5 py-1 rounded transition-colors cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                                <button
                                  onClick={() => {
                                    setEditPaymentId(inv.id);
                                    setCustomDate(new Date().toISOString().split('T')[0]);
                                  }}
                                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
                                  title="Record custom payment date"
                                >
                                  <Calendar className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-on-surface-variant space-y-3">
            <Layers className="h-10 w-10 text-outline mx-auto" />
            <div>
              <p className="text-sm font-semibold">No invoices found</p>
              <p className="text-xs opacity-75">Generate invoices by running folders or excel sheets in the dashboard.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
