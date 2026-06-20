import { useState, useEffect } from 'react';
import { X, CheckCircle, Calendar, CreditCard } from 'lucide-react';
import API_BASE from '../api';

export default function PaymentRecordModal({ isOpen, onClose, invoice, onSaved }) {
  const [paymentDate, setPaymentDate] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoice) {
      setPaymentDate(invoice.payment_date || new Date().toISOString().split('T')[0]);
      // If payment has already been recorded, default to that amount. Otherwise default to total_amount
      const initialAmt = invoice.amount_paid > 0 ? invoice.amount_paid : (invoice.total_amount || 0);
      setAmountPaid(initialAmt);
      setIsFullPayment(Math.abs(initialAmt - (invoice.total_amount || 0)) < 0.01);
      setError('');
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const handleFullPaymentToggle = (checked) => {
    setIsFullPayment(checked);
    if (checked) {
      setAmountPaid(invoice.total_amount || 0);
    }
  };

  const handleAmountChange = (val) => {
    const num = parseFloat(val) || 0;
    setAmountPaid(num);
    setIsFullPayment(Math.abs(num - (invoice.total_amount || 0)) < 0.01);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/invoices/${invoice.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_paid: isFullPayment ? 1 : (amountPaid > 0 ? 2 : 0),
          payment_date: paymentDate,
          amount_paid: amountPaid
        })
      });

      if (res.ok) {
        onSaved(invoice.id, paymentDate, amountPaid);
        onClose();
      } else {
        const txt = await res.text();
        setError(txt || "Failed to record payment.");
      }
    } catch (err) {
      setError(err.message || "Failed to contact server.");
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = Math.max(0, (invoice.total_amount || 0) - amountPaid);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in text-left">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#10131a] glass-panel border border-[#232d3f]/80 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container/20 border-b border-[#232d3f]/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 uppercase tracking-wider">
            <CreditCard className="h-4.5 w-4.5 text-primary animate-pulse" />
            Record Client Payment
          </h3>
          <button 
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface rounded-lg p-1 hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Client summary */}
          <div className="bg-surface-lowest/50 border border-outline-variant/20 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Client Name</p>
                <p className="text-sm font-bold text-on-surface">{invoice.client_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Invoice No</p>
                <p className="text-xs font-mono font-bold text-primary">{invoice.invoice_number || `#I-${invoice.id}`}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-outline-variant/10 flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">Total Invoice Value:</span>
              <span className="text-sm font-bold font-mono text-on-surface">₹{Number(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error-container/10 border border-error-container/20 rounded-lg text-[11px] text-error font-medium">
              {error}
            </div>
          )}

          {/* Payment Date */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Date of Payment
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Amount Paid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-primary font-bold font-mono">₹</span>
                Amount Received (INR)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="full_payment_checkbox"
                  checked={isFullPayment}
                  onChange={(e) => handleFullPaymentToggle(e.target.checked)}
                  className="rounded border-outline-variant/60 text-primary bg-surface-lowest focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="full_payment_checkbox" className="text-[10px] font-bold text-secondary cursor-pointer select-none">
                  Paid in Full
                </label>
              </div>
            </div>
            <input
              type="number"
              step="any"
              value={amountPaid === 0 ? '' : amountPaid}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={isFullPayment}
              required
              placeholder="Enter amount paid"
              className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary transition-all disabled:opacity-50"
            />
          </div>

          {/* Outstanding details */}
          <div className="bg-surface-lowest/30 rounded-lg p-3 text-xs space-y-1.5 border border-outline-variant/10">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Remaining Balance:</span>
              <span className={`font-mono font-bold ${remainingBalance > 0 ? 'text-amber-400' : 'text-secondary'}`}>
                ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {remainingBalance > 0 ? (
              <p className="text-[10px] text-amber-500/80 leading-normal">
                * This will mark the invoice status as <strong>Partially Received</strong>.
              </p>
            ) : (
              <p className="text-[10px] text-secondary/80 leading-normal">
                * This will mark the invoice status as <strong>Received (Full)</strong>.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-xs bg-surface-lowest hover:bg-surface-container-high text-on-surface-variant font-bold transition-colors cursor-pointer disabled:opacity-50 border border-outline-variant/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-xs bg-primary hover:bg-primary/95 text-on-primary font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-primary/10"
            >
              {loading ? 'Saving...' : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
