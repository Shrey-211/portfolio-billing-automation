import { useState } from 'react';
import API_BASE from '../api';
import { 
  FileSpreadsheet, 
  Edit3, 
  Play, 
  X, 
  AlertTriangle, 
  CheckCircle,
  Database,
  Building,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi"
];

export default function Workbench({ queue, setQueue, folderPath, setTab }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Drawer form state
  const [formState, setFormState] = useState({
    client_name: '',
    client_type: 'Type 1',
    state: 'Maharashtra',
    email: '',
    cc_email: '',
    address: '',
    gstin: '',
    valuation: 0.0
  });

  const handleEditRow = (idx) => {
    setSelectedIdx(idx);
    setFormState({ ...queue[idx] });
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedIdx(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: name === 'valuation' ? parseFloat(value) || 0.0 : value
    }));
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (selectedIdx === null) return;
    
    setLoading(true);
    try {
      const saveRes = await fetch(`${API_BASE}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: formState.client_name,
          client_type: formState.client_type,
          state: formState.state,
          email: formState.email,
          cc_email: formState.cc_email || "",
          address: formState.address || "",
          gstin: formState.gstin || ""
        })
      });

      if (!saveRes.ok) {
        throw new Error("Failed to cache client profiles in database.");
      }

      const updatedQueue = [...queue];
      updatedQueue[selectedIdx] = {
        ...updatedQueue[selectedIdx],
        ...formState
      };
      setQueue(updatedQueue);
      handleCloseDrawer();
    } catch (err) {
      alert("Error caching client data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async () => {
    if (queue.length === 0) return;

    const hasWarnings = queue.some(item => !item.email || !item.client_name || item.valuation <= 0);
    if (hasWarnings) {
      const confirmRun = window.confirm("Some records have issues (missing emails or valuation is 0). Do you want to proceed anyway?");
      if (!confirmRun) return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/batch/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath,
          items: queue.map(q => ({
            filename: q.filename,
            client_name: q.client_name,
            client_type: q.client_type,
            state: q.state,
            email: q.email,
            cc_email: q.cc_email || "",
            address: q.address || "",
            gstin: q.gstin || "",
            valuation: q.valuation
          }))
        })
      });

      if (!res.ok) {
        throw new Error(await res.text() || "Failed to start batch processing");
      }

      setTab('processing');
    } catch (err) {
      alert("Billing Trigger Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getBasename = (path) => {
    if (!path) return '';
    return path.split('\\').pop().split('/').pop();
  };

  return (
    <div className="relative space-y-8 animate-fade-in z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">Active Billing Queue</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Review, validate, and edit client billing metadata profiles before executing invoice creation.</p>
        </div>
        
        {queue.length > 0 && (
          <button
            onClick={handleStartProcess}
            disabled={loading}
            className="inline-flex items-center px-5 py-3 rounded-lg text-xs font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-95"
          >
            <Play className="mr-2 h-4 w-4 fill-current" />
            Start Billing Engine
          </button>
        )}
      </div>

      {/* Main Grid table */}
      <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-[#232d3f]/60 flex items-center justify-between bg-surface-container/20">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Scanned Records Queue
          </h3>
          <span className="text-[10px] px-2.5 py-0.5 rounded bg-surface-container-low text-primary border border-outline-variant/20 font-mono font-bold">
            {queue.length} SHEETS
          </span>
        </div>

        {queue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/70 border-b border-[#232d3f]/40">
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">File Name</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Name</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">State</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Valuation</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Validation</th>
                  <th scope="col" className="py-3 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs text-on-surface divide-y divide-[#232d3f]/20">
                {queue.map((item, idx) => {
                  const hasIssue = !item.email || !item.client_name || item.valuation <= 0;
                  return (
                    <tr key={idx} className="hover:bg-surface-container-highest/30 transition-colors">
                      <td className="py-4 px-6 font-mono text-on-surface-variant max-w-xs truncate" title={item.filename}>
                        {getBasename(item.filename)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-on-surface">{item.client_name || <span className="text-error italic">None</span>}</td>
                      <td className="py-4 px-6 text-on-surface-variant">{item.client_type}</td>
                      <td className="py-4 px-6 text-on-surface-variant">{item.state}</td>
                      <td className="py-4 px-6 font-semibold text-on-surface font-mono">
                        ₹{item.valuation ? item.valuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {hasIssue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error border border-error/25" title="Missing details or 0 valuation">
                            <AlertTriangle className="h-3 w-3" />
                            Needs Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25">
                            <CheckCircle className="h-3 w-3" />
                            Valid
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleEditRow(idx)}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary-container font-semibold border border-outline-variant/30 bg-surface-lowest hover:bg-surface-container-high px-2.5 py-1 rounded transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-4">
            <FileSpreadsheet className="h-10 w-10 text-outline mx-auto" />
            <div>
              <p className="text-sm font-semibold text-on-surface">No files in Workbench queue</p>
              <p className="text-xs text-on-surface-variant mt-1">Please select and scan a portfolio folder on the dashboard first.</p>
            </div>
            <button
              onClick={() => setTab('home')}
              className="inline-flex items-center px-4 py-2 bg-surface-lowest hover:bg-surface-container-high border border-outline-variant/30 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Side-Drawer Details Panel Overlay - Lumina Ledger Design */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={handleCloseDrawer}
          />
          
          <div className="relative w-full max-w-lg bg-[#10131a] glass-panel border-l border-outline-variant/20 shadow-2xl h-full flex flex-col z-50">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#232d3f]/60 flex items-center justify-between bg-surface-lowest/40">
              <div>
                <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Database className="h-4.5 w-4.5 text-primary" />
                  Client Metadata Profile
                </h3>
                <p className="text-[10px] text-on-surface-variant mt-1">Updates are cached to local database profile index.</p>
              </div>
              <button 
                onClick={handleCloseDrawer}
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveClient} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="p-3 bg-surface-lowest/70 rounded-lg border border-outline-variant/40 font-mono text-[9px] text-primary break-all">
                <span className="font-bold text-on-surface-variant uppercase text-[8px] tracking-wider block mb-1">Workbook Source Path:</span>
                {formState.filename}
              </div>

              {/* Client Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Client Name
                </label>
                <input
                  type="text"
                  name="client_name"
                  value={formState.client_name}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Type & State Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Client Type
                  </label>
                  <select
                    name="client_type"
                    value={formState.client_type}
                    onChange={handleInputChange}
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
                  >
                    <option value="Type 1">Type 1</option>
                    <option value="Type 2">Type 2</option>
                    <option value="Type 3">Type 3</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    State / Supply Place
                  </label>
                  <select
                    name="state"
                    value={formState.state}
                    onChange={handleInputChange}
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Emails */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    required
                    placeholder="name@company.com"
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-outline" />
                    CC Email (Optional)
                  </label>
                  <input
                    type="text"
                    name="cc_email"
                    value={formState.cc_email}
                    onChange={handleInputChange}
                    placeholder="cc@company.com (comma separated)"
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Valuation Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Portfolio Valuation (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="valuation"
                  value={formState.valuation}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Invoice specific info */}
              <div className="space-y-4 pt-4 border-t border-[#232d3f]/60">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Billing Address</label>
                  <textarea
                    name="address"
                    value={formState.address}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client GSTIN (Optional)</label>
                  <input
                    type="text"
                    name="gstin"
                    value={formState.gstin}
                    onChange={handleInputChange}
                    placeholder="27AAAAA1111A1Z0"
                    className="w-full bg-surface-lowest border border-outline-variant/40 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#232d3f]/60 flex items-center justify-end gap-3 bg-surface-lowest/40">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-4 py-2 rounded-lg text-xs bg-surface-lowest hover:bg-surface-container-high text-on-surface-variant font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClient}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs bg-primary hover:bg-primary/90 text-on-primary font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save & Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
