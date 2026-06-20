import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import API_BASE from '../api';

export default function InvoiceEditModal({ isOpen, onClose, invoice, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fields state
  const [clientName, setClientName] = useState('');
  const [valuation, setValuation] = useState(0);
  const [clientType, setClientType] = useState('Type 1');
  const [state, setState] = useState('Maharashtra');
  const [email, setEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // New fields
  const [portfolioPdfPath, setPortfolioPdfPath] = useState('');
  const [invoicePdfPath, setInvoicePdfPath] = useState('');
  const [overrideCalculations, setOverrideCalculations] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (isOpen && invoice) {
      setErrorMsg('');
      setClientName(invoice.client_name || '');
      setValuation(invoice.valuation || 0);
      setClientType(invoice.client_type || 'Type 1');
      setState(invoice.state || 'Maharashtra');
      setEmail(invoice.email || '');
      setCcEmail(invoice.cc_email || '');
      setAddress(invoice.address || '');
      setGstin(invoice.gstin || '');
      setInvoiceNumber(invoice.invoice_number || '');
      setCustomMessage(invoice.custom_message || '');

      setPortfolioPdfPath(invoice.portfolio_pdf_path || '');
      setInvoicePdfPath(invoice.invoice_pdf_path || '');
      setOverrideCalculations(false);
      setFeeAmount(invoice.fee_amount || 0);
      setCgst(invoice.cgst || 0);
      setSgst(invoice.sgst || 0);
      setIgst(invoice.igst || 0);
      setTotalAmount(invoice.total_amount || 0);

      // Try fetching recent client info if email/address are missing
      fetchClientDetails(invoice.client_name);
    }
  }, [isOpen, invoice]);

  const fetchClientDetails = async (name) => {
    if (!name) return;
    try {
      const res = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        // Only update fields if they were blank in the invoice
        if (data.email) setEmail(prev => prev || data.email);
        if (data.cc_email) setCcEmail(prev => prev || data.cc_email);
        if (data.address) setAddress(prev => prev || data.address);
        if (data.gstin) setGstin(prev => prev || data.gstin);
        if (data.client_type) setClientType(prev => prev === 'Type 1' ? data.client_type : prev);
        if (data.state) setState(prev => prev === 'Maharashtra' ? data.state : prev);
      }
    } catch (err) {
      console.warn("Could not retrieve details for autocomplete:", err);
    }
  };

  const handleBrowseFile = async (target) => {
    try {
      const res = await fetch(`${API_BASE}/api/files/select-pdf`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.file_path) {
          if (target === 'portfolio') {
            setPortfolioPdfPath(data.file_path);
          } else if (target === 'invoice') {
            setInvoicePdfPath(data.file_path);
          }
        }
      } else {
        alert("Failed to open file picker: " + await res.text());
      }
    } catch (err) {
      console.error(err);
      alert("Error picking file: " + err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!clientName) {
      alert("Client name is required.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        client_name: clientName.trim(),
        client_type: clientType,
        state: state.trim(),
        email: email.trim(),
        cc_email: ccEmail.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        valuation: parseFloat(valuation) || 0.0,
        is_regular: invoice.status !== 'Skipped (Not Billable)',
        custom_message: customMessage.trim(),
        invoice_number: invoiceNumber.trim(),
        portfolio_pdf_path: portfolioPdfPath.trim(),
        invoice_pdf_path: invoicePdfPath.trim(),
        override_calculations: overrideCalculations,
        fee_amount: parseFloat(feeAmount) || 0.0,
        cgst: parseFloat(cgst) || 0.0,
        sgst: parseFloat(sgst) || 0.0,
        igst: parseFloat(igst) || 0.0,
        total_amount: parseFloat(totalAmount) || 0.0
      };

      const res = await fetch(`${API_BASE}/api/invoices/${invoice.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (onSaved) onSaved();
        onClose();
      } else {
        const txt = await res.text();
        setErrorMsg("Failed to save changes: " + txt);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error contacting server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-lowest/90 backdrop-blur-xl border border-outline-variant/20 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] glass-panel transition-all text-left">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Edit Invoice Details</h3>
            <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider mt-0.5 font-mono">
              Invoice ID: #I-{invoice.id} {invoiceNumber ? `(${invoiceNumber})` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-high/40 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
            {errorMsg && (
              <div className="p-3.5 bg-error-container/10 border border-error-container/20 text-error rounded-lg text-xs font-semibold flex items-start gap-2 animate-fade-in">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Client Name & Valuation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Portfolio Valuation (INR)</label>
                <input
                  type="number"
                  step="any"
                  value={valuation}
                  onChange={(e) => setValuation(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                />
              </div>
            </div>

            {/* Client Type & State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Client Type</label>
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Type 1">Type 1 (Regular)</option>
                  <option value="Type 2">Type 2 (RI Equity)</option>
                  <option value="Type 3">Type 3 (RI MF)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Place of Supply (State)</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  placeholder="e.g. Maharashtra or Karnataka"
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans"
                />
              </div>
            </div>

            {/* Email & CC Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">CC Email Address</label>
                <input
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="Comma-separated emails"
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Billing Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans leading-relaxed resize-none scrollbar-none"
              />
            </div>

            {/* GSTIN & Invoice Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Client GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAAAA0000A1Z0"
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-0000"
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                />
              </div>
            </div>

            {/* PDF File Attachments */}
            <div className="space-y-3 pt-3 border-t border-outline-variant/15">
              <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                📄 File Attachments
              </h4>
              
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Portfolio PDF Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={portfolioPdfPath}
                      onChange={(e) => setPortfolioPdfPath(e.target.value)}
                      placeholder="No portfolio PDF attached"
                      className="flex-1 bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleBrowseFile('portfolio')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-outline-variant/35 rounded-lg text-xs font-bold bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Browse
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Invoice PDF Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={invoicePdfPath}
                      onChange={(e) => setInvoicePdfPath(e.target.value)}
                      placeholder="No invoice PDF generated yet"
                      className="flex-1 bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleBrowseFile('invoice')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-outline-variant/35 rounded-lg text-xs font-bold bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Browse
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Override Calculations & Amounts */}
            <div className="space-y-3 pt-3 border-t border-outline-variant/15">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="override_calc"
                  checked={overrideCalculations}
                  onChange={(e) => setOverrideCalculations(e.target.checked)}
                  className="rounded border-[#232d3f]/40 text-primary bg-surface-container-lowest focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="override_calc" className="text-xs font-bold text-on-surface cursor-pointer select-none">
                  Override Calculated Amounts Manually
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Fee Amount (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={feeAmount}
                    disabled={!overrideCalculations}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-1.5 text-xs text-on-surface font-mono disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">CGST (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={cgst}
                    disabled={!overrideCalculations}
                    onChange={(e) => setCgst(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-1.5 text-xs text-on-surface font-mono disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">SGST (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={sgst}
                    disabled={!overrideCalculations}
                    onChange={(e) => setSgst(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-1.5 text-xs text-on-surface font-mono disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">IGST (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={igst}
                    disabled={!overrideCalculations}
                    onChange={(e) => setIgst(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-1.5 text-xs text-on-surface font-mono disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Amount (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={totalAmount}
                    disabled={!overrideCalculations}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-1.5 text-xs text-on-surface font-mono disabled:opacity-50 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Custom Email Message */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Custom Note (Appended in Email)</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={2}
                placeholder="E.g. Please note: we have adjusted values due to split stock options."
                className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-sans leading-relaxed resize-none scrollbar-thin"
              />
            </div>

            {/* Note on Recalculations */}
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-[10px] font-medium text-on-surface-variant/80">
              ⚡ **Notice**: Saving changes will automatically update the database registry. Recalculation runs unless manual override is toggled.
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline-variant/15 flex items-center justify-end gap-3 bg-surface-lowest/40">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-outline-variant/30 hover:bg-surface-container-high/40 rounded-lg text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
