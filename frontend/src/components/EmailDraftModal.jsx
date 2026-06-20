import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Paperclip, Send, Loader2, Trash2, Plus } from 'lucide-react';
import API_BASE from '../api';

export default function EmailDraftModal({ isOpen, onClose, templateEndpoint, defaultPayload = {}, onSent }) {
  const [loading, setLoading] = useState(false);
  const [fetchingTemplate, setFetchingTemplate] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [clientName, setClientName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (templateEndpoint) {
        fetchTemplate();
      } else {
        // Fallback or customized custom message
        setClientName(defaultPayload.client_name || '');
        setRecipient(defaultPayload.recipient || '');
        setCc(defaultPayload.cc || '');
        setSubject(defaultPayload.subject || '');
        setBody(defaultPayload.body || '');
        setAttachments(defaultPayload.attachments || []);
      }
    }
  }, [isOpen, templateEndpoint, defaultPayload]);

  const fetchTemplate = async () => {
    setFetchingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}${templateEndpoint}`);
      if (res.ok) {
        const data = await res.json();
        setClientName(data.client_name || '');
        setRecipient(data.recipient || '');
        setCc(data.cc || '');
        setSubject(data.subject || '');
        setBody(data.body || '');
        setAttachments(data.attachments || []);
      } else {
        setErrorMsg("Failed to retrieve draft template from API.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to connect to template API.");
    } finally {
      setFetchingTemplate(false);
    }
  };

  const handleAddAttachments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/email/select-attachments`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.attachments && data.attachments.length > 0) {
          // Append and filter duplicates
          setAttachments(prev => {
            const current = [...prev];
            data.attachments.forEach(path => {
              if (!current.includes(path)) {
                current.push(path);
              }
            });
            return current;
          });
        }
      }
    } catch (err) {
      console.error("Failed to select attachments", err);
      alert("Error opening file picker.");
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipient) {
      alert("Recipient email is required.");
      return;
    }
    if (!subject) {
      alert("Email subject is required.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        client_name: clientName,
        recipient: recipient,
        cc: cc,
        subject: subject,
        body: body,
        attachments: attachments,
        email_type: defaultPayload.email_type || 'custom',
        item_id: defaultPayload.item_id || null
      };

      const res = await fetch(`${API_BASE}/api/email/send-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (onSent) onSent();
        onClose();
      } else {
        const txt = await res.text();
        setErrorMsg(`Failed to send email: ${txt}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`Sending error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-lowest/90 backdrop-blur-xl border border-outline-variant/20 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] glass-panel transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Email Dispatch Console</h3>
            <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider mt-0.5">
              Client: {clientName || 'Custom Recipient'}
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
        {fetchingTemplate ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-on-surface-variant">Generating pre-populated draft templates...</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {errorMsg && (
                <div className="p-3.5 bg-error-container/10 border border-error-container/20 text-error rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* To / CC Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Recipient (To)</label>
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    required
                    placeholder="client@example.com"
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Copy (CC)</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com, management@example.com"
                    className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all font-sans"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  placeholder="Portfolio Performance Report & GST Invoice"
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all font-sans font-semibold"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Message Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Dear client, ..."
                  className="w-full bg-surface-container-lowest border border-[#232d3f]/40 rounded-lg px-3.5 py-3 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all font-sans leading-relaxed resize-none scrollbar-thin"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Attachments ({attachments.length})</label>
                  <button
                    type="button"
                    onClick={handleAddAttachments}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-fixed bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Local File</span>
                  </button>
                </div>

                {attachments.length > 0 ? (
                  <div className="bg-surface-container-lowest/60 border border-outline-variant/10 rounded-lg p-2 max-h-[140px] overflow-y-auto scrollbar-thin space-y-1.5">
                    {attachments.map((path, idx) => {
                      const fname = path.split('\\').pop().split('/').pop();
                      return (
                        <div key={idx} className="flex items-center justify-between bg-surface-lowest border border-outline-variant/10 rounded px-2.5 py-1.5 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Paperclip className="h-3.5 w-3.5 text-on-surface-variant/60 flex-shrink-0" />
                            <span className="truncate text-on-surface font-semibold" title={path}>{fname}</span>
                            <span className="text-[9px] text-on-surface-variant font-mono truncate hidden sm:inline" title={path}>({path})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 hover:bg-surface-container-high rounded text-error hover:text-error transition-colors ml-2 flex-shrink-0 cursor-pointer"
                            title="Remove attachment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-outline-variant/20 rounded-lg p-4 text-center text-on-surface-variant/40 text-[11px] font-semibold">
                    No files attached.
                  </div>
                )}
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
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
