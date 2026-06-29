import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API_BASE from '../api';
import { 
  Search, 
  User, 
  FileText, 
  Mail, 
  Calendar, 
  ChevronRight, 
  Save, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  Paperclip,
  Activity,
  Edit,
  Eye
} from 'lucide-react';
import EmailDraftModal from './EmailDraftModal';

export default function ClientDatabase() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clientHistory, setClientHistory] = useState({ profile: null, billing: [], emails: [] });
  const [activeSubTab, setActiveSubTab] = useState('billing'); // 'billing' or 'emails'
  
  // Profile edit fields
  const [clientType, setClientType] = useState('Type 1');
  const [state, setState] = useState('Maharashtra');
  const [email, setEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Email draft compose state
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftPayload, setDraftPayload] = useState({});

  // Email view modal
  const [selectedEmailLog, setSelectedEmailLog] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/clients/all`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        if (data.length > 0 && !selectedClient) {
          handleSelectClient(data[0].client_name);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = async (clientName) => {
    setSelectedClient(clientName);
    setHistoryLoading(true);
    setProfileSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(clientName)}/history`);
      if (res.ok) {
        const data = await res.json();
        setClientHistory(data);
        
        // Populate edit profile states
        setClientType(data.profile.client_type || 'Type 1');
        setState(data.profile.state || 'Maharashtra');
        setEmail(data.profile.email || '');
        setCcEmail(data.profile.cc_email || '');
        setAddress(data.profile.address || '');
        setGstin(data.profile.gstin || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      const payload = {
        client_name: selectedClient,
        client_type: clientType,
        state: state,
        email: email,
        cc_email: ccEmail,
        address: address,
        gstin: gstin
      };

      const res = await fetch(`${API_BASE}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setProfileSuccess(true);
        fetchClients();
        setTimeout(() => setProfileSuccess(false), 3000);
      } else {
        alert("Failed to save client profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting API server.");
    } finally {
      setProfileSaving(false);
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

  const handleComposeCustomEmail = () => {
    setDraftPayload({
      client_name: selectedClient,
      recipient: email,
      cc: ccEmail,
      subject: `Advisory Portfolio Update - ${selectedClient}`,
      body: `Dear ${selectedClient},\n\nHope you are doing well.\n\n[Please enter message content here]\n\nBest Regards,\nAntigravity Wealth Management`,
      attachments: [],
      email_type: 'custom',
      item_id: null
    });
    setIsDraftOpen(true);
  };

  const filteredClients = Array.isArray(clients) ? clients.filter(c => 
    c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="space-y-8 animate-fade-in relative z-10">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Client Registry Database</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Central client registry dashboard containing contact data registries, historical invoice listings, and mail dispatch timelines.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Panel: Clients List */}
        <div className="lg:col-span-4 flex flex-col glass-panel rounded-xl overflow-hidden h-[700px] border border-outline-variant/10">
          <div className="p-4 border-b border-outline-variant/10 bg-surface-lowest/40 space-y-3">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Search Clients</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant/40" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-[#232d3f]/10">
            {loading ? (
              <div className="p-8 text-center text-xs text-on-surface-variant font-medium">Loading registry...</div>
            ) : filteredClients.length > 0 ? (
              filteredClients.map(c => {
                const isSelected = c.client_name === selectedClient;
                return (
                  <button
                    key={c.client_name}
                    onClick={() => handleSelectClient(c.client_name)}
                    className={`w-full flex items-center justify-between p-4 text-left border-l-4 transition-all duration-150 cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/5 text-primary border-primary font-bold' 
                        : 'hover:bg-surface-container-high/20 border-transparent text-on-surface-variant/95'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate font-semibold">{c.client_name}</p>
                      <span className="block text-[9px] text-on-surface-variant font-mono mt-0.5 uppercase tracking-wide opacity-70">
                        {c.invoice_count || 0} Invoices {c.latest_activity ? `| Active: ${c.latest_activity.split(' ')[0]}` : ''}
                      </span>
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 opacity-40 ${isSelected ? 'text-primary opacity-100' : ''}`} />
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-on-surface-variant/50">No clients matched search query.</div>
            )}
          </div>
        </div>

        {/* Right Panel: Client Profile & Histories */}
        <div className="lg:col-span-8 flex flex-col h-[700px] gap-6">
          {historyLoading ? (
            <div className="glass-panel rounded-xl flex-1 flex flex-col items-center justify-center text-on-surface-variant/60 gap-3 border border-outline-variant/10">
              <svg className="animate-spin h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xs font-semibold">Pulling histories from local database...</p>
            </div>
          ) : selectedClient && clientHistory.profile ? (
            <>
              {/* Profile Card & Info Edit */}
              <div className="glass-panel border border-outline-variant/10 rounded-xl p-6 bg-surface-container/25 relative">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary">
                      <User className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="text-base font-bold text-on-surface">{selectedClient}</h4>
                        {clientHistory.available_credit > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25">
                            Credit: ₹{Number(clientHistory.available_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Metadata Registry Card</p>
                    </div>
                  </div>

                  <button
                    onClick={handleComposeCustomEmail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Send Custom Email</span>
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">Classification</label>
                    <select
                      value={clientType}
                      onChange={(e) => setClientType(e.target.value)}
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none cursor-pointer"
                    >
                      <option value="Type 1">Type 1 (Regular)</option>
                      <option value="Type 2">Type 2 (RI Equity)</option>
                      <option value="Type 3">Type 3 (RI MF)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">Supply State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">GSTIN</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="27AAAAA0000A1Z0"
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">To Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none font-sans"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">CC Email Address</label>
                    <input
                      type="text"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none font-sans"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-bold text-on-surface-variant/75 uppercase tracking-wider block">Billing Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-surface-lowest border border-[#232d3f]/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none font-sans"
                    />
                  </div>
                  <div className="flex items-end justify-end md:col-span-1">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-md shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {profileSaving ? 'Saving...' : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {profileSuccess && (
                  <div className="absolute top-4 right-4 bg-secondary/15 border border-secondary/30 text-secondary px-3 py-1 rounded-md text-[10px] font-bold animate-fade-in">
                    Profile successfully updated.
                  </div>
                )}
              </div>

              {/* Sub-Tabs: Invoices vs Emails */}
              <div className="flex-1 glass-panel border border-outline-variant/10 rounded-xl flex flex-col overflow-hidden">
                {/* Switcher Bar */}
                <div className="flex border-b border-outline-variant/10 bg-surface-lowest/40 px-4">
                  <button
                    onClick={() => setActiveSubTab('billing')}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'billing' 
                        ? 'border-primary text-primary font-bold' 
                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Billing Ledger History ({clientHistory.billing.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('emails')}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeSubTab === 'emails' 
                        ? 'border-primary text-primary font-bold' 
                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Email Dispatch History ({clientHistory.emails.length})
                  </button>
                </div>

                {/* Switcher Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
                  {activeSubTab === 'billing' ? (
                    clientHistory.billing.length > 0 ? (
                      <div className="space-y-4">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#232d3f]/25 text-[9px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                              <th className="py-2 px-2">Invoice No</th>
                              <th className="py-2 px-2">Date</th>
                              <th className="py-2 px-2">Valuation</th>
                              <th className="py-2 px-2">Total Amount</th>
                              <th className="py-2 px-2 text-center">Status</th>
                              <th className="py-2 px-2 text-center">Payment</th>
                              <th className="py-2 px-2 text-right">PDFs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#232d3f]/10 text-xs text-on-surface">
                            {clientHistory.billing.map(inv => (
                              <tr key={inv.id} className="hover:bg-surface-container-high/10">
                                <td className="py-3 px-2 font-mono font-bold text-primary">#{inv.invoice_number || `I-${inv.id}`}</td>
                                <td className="py-3 px-2 text-on-surface-variant">{inv.batch_date ? inv.batch_date.split('T')[0] : '-'}</td>
                                <td className="py-3 px-2 font-mono text-on-surface-variant">₹{Number(inv.valuation ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="py-3 px-2 font-mono font-bold">₹{Number(inv.total_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                    inv.status === 'Completed' ? 'bg-secondary/10 text-secondary' : 'bg-error-container/10 text-error'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center">
                                   {inv.is_paid === 1 ? (
                                     <div className="flex flex-col items-center">
                                       <span className="inline-flex items-center gap-0.5 text-secondary text-[10px] font-bold"><CheckCircle className="h-3 w-3" /> Paid</span>
                                       {inv.credit_applied > 0 && <span className="text-[8px] text-secondary font-medium font-mono">Credit: ₹{Number(inv.credit_applied).toLocaleString('en-IN')}</span>}
                                     </div>
                                   ) : inv.is_paid === 2 ? (
                                     <div className="flex flex-col items-center">
                                       <span className="inline-flex items-center gap-0.5 text-amber-400 text-[10px] font-bold"><Clock className="h-3 w-3 animate-pulse" /> Partial</span>
                                       {inv.credit_applied > 0 && <span className="text-[8px] text-secondary font-medium font-mono">Credit: ₹{Number(inv.credit_applied).toLocaleString('en-IN')}</span>}
                                     </div>
                                   ) : (
                                     <span className="inline-flex items-center gap-0.5 text-error text-[10px] font-bold"><Clock className="h-3 w-3" /> Due</span>
                                   )}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {inv.invoice_pdf_path && (
                                      <button
                                        onClick={() => handleOpenPDF(inv.invoice_pdf_path)}
                                        className="p-1 hover:bg-surface-container-high text-primary hover:text-primary rounded"
                                        title="Invoice PDF"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    {inv.portfolio_pdf_path && (
                                      <button
                                        onClick={() => handleOpenPDF(inv.portfolio_pdf_path)}
                                        className="p-1 hover:bg-surface-container-high text-secondary hover:text-secondary rounded"
                                        title="Portfolio PDF"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-on-surface-variant/40 text-xs">No billing records logged for this client.</div>
                    )
                  ) : (
                    clientHistory.emails.length > 0 ? (
                      <div className="space-y-4">
                        {clientHistory.emails.map(log => {
                          const attaches = log.attachments ? JSON.parse(log.attachments) : [];
                          return (
                            <div key={log.id} className="p-3 bg-surface-container-lowest/60 border border-outline-variant/10 rounded-lg space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider mr-2 ${
                                    log.status === 'Sent' ? 'bg-secondary/15 text-secondary' : 'bg-error-container/15 text-error'
                                  }`}>
                                    {log.status}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant font-mono font-bold">{log.sent_at}</span>
                                </div>
                                <button
                                  onClick={() => setSelectedEmailLog(log)}
                                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary-fixed bg-primary/10 px-2 py-0.5 rounded border border-primary/20 cursor-pointer"
                                >
                                  <span>View Message</span>
                                </button>
                              </div>
                              <p className="text-xs text-on-surface font-semibold truncate leading-tight">Subject: {log.subject}</p>
                              <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2">{log.body}</p>
                              {attaches.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {attaches.map((path, pIdx) => {
                                    const fname = path.split('\\').pop().split('/').pop();
                                    return (
                                      <div key={pIdx} className="inline-flex items-center gap-1 bg-surface-lowest border border-outline-variant/10 rounded px-1.5 py-0.5 text-[9px] cursor-pointer"
                                           onClick={() => handleOpenPDF(path)}
                                      >
                                        <Paperclip className="h-2.5 w-2.5 text-on-surface-variant" />
                                        <span className="text-on-surface truncate max-w-[120px]" title={path}>{fname}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-on-surface-variant/40 text-xs">No email dispatch logs registered for this client.</div>
                    )
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel rounded-xl flex-1 flex flex-col items-center justify-center text-on-surface-variant/30 gap-2 border border-outline-variant/10">
              <Activity className="h-10 w-10 text-outline" />
              <p className="text-sm font-semibold">Select a client from the registry list to load details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Draft Popup Modal */}
      <EmailDraftModal
        isOpen={isDraftOpen}
        onClose={() => setIsDraftOpen(false)}
        defaultPayload={draftPayload}
        onSent={() => {
          if (selectedClient) handleSelectClient(selectedClient);
        }}
      />

      {/* Email Body Review Modal */}
      {selectedEmailLog && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-surface-lowest border border-outline-variant/20 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] glass-panel">
            <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Email Contents Review</h3>
                <span className="text-[9px] text-on-surface-variant font-mono">{selectedEmailLog.sent_at}</span>
              </div>
              <button
                onClick={() => setSelectedEmailLog(null)}
                className="p-1 rounded-lg hover:bg-surface-container-high/40 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4 scrollbar-thin">
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Recipient</span>
                <p className="font-semibold text-on-surface">{selectedEmailLog.recipient_email} {selectedEmailLog.cc_email ? `(CC: ${selectedEmailLog.cc_email})` : ''}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Subject</span>
                <p className="font-semibold text-primary">{selectedEmailLog.subject}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Message Body</span>
                <p className="bg-surface-container-lowest/80 border border-outline-variant/10 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{selectedEmailLog.body}</p>
              </div>
              {selectedEmailLog.error_msg && (
                <div className="p-3 bg-error-container/10 border border-error-container/20 text-error rounded-lg font-sans">
                  <span className="font-bold text-[9px] uppercase block mb-0.5">Delivery Error Log</span>
                  <p className="font-mono">{selectedEmailLog.error_msg}</p>
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

function X({ className, ...props }) {
  return (
    <svg className={className} {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
