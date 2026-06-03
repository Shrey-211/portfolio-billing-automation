import { useState, useEffect } from 'react';
import API_BASE from '../api';
import { 
  Save, 
  Plus, 
  Trash2, 
  Check, 
  Building, 
  Percent, 
  Mail, 
  Info,
  CreditCard
} from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [feeRules, setFeeRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchFeeRules();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const fetchFeeRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/fee-rules`);
      if (res.ok) {
        setFeeRules(await res.json());
      }
    } catch (err) {
      console.error("Failed to load fee rules:", err);
    }
  };

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleRuleChange = (idx, field, val) => {
    const updated = [...feeRules];
    updated[idx][field] = parseFloat(val) || 0.0;
    setFeeRules(updated);
  };

  const handleAddRule = () => {
    const lastRule = feeRules[feeRules.length - 1];
    const nextMin = lastRule ? lastRule.max_value : 0;
    setFeeRules(prev => [
      ...prev,
      { min_value: nextMin, max_value: nextMin + 10000000, percentage: 0.1, flat_rate: 0 }
    ]);
  };

  const handleDeleteRule = (idx) => {
    setFeeRules(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus('');
    try {
      const resSettings = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      const resRules = await fetch(`${API_BASE}/api/settings/fee-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: feeRules })
      });

      if (resSettings.ok && resRules.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16 z-10 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">System Settings</h2>
          <p className="mt-1 text-sm text-on-surface-variant font-medium">Configure company profiles, GST rates, fee brackets, SMTP details, and email layouts.</p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5 bg-secondary/15 border border-secondary/25 px-4 py-2 rounded-lg animate-fade-in">
              <Check className="h-4 w-4" />
              Settings Saved Successfully!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs font-semibold text-error bg-error/15 border border-error/25 px-4 py-2 rounded-lg animate-fade-in">
              Failed to save configurations.
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL 1: Company Profile Info */}
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300">
          <div className="space-y-6">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
              <Building className="h-4.5 w-4.5 text-primary" />
              Company Billing Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company Registered Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={settings.company_name || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Registered Office Address</label>
                <input
                  type="text"
                  name="company_address"
                  value={settings.company_address || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company GSTIN</label>
                <input
                  type="text"
                  name="company_gstin"
                  value={settings.company_gstin || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Support Email</label>
                <input
                  type="email"
                  name="company_email"
                  value={settings.company_email || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-outline-variant/30 mt-8">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4.5 w-4.5 text-primary" />
              Settlement Bank Credentials
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bank Name</label>
                <input
                  type="text"
                  name="company_bank_name"
                  value={settings.company_bank_name || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Account Number</label>
                <input
                  type="text"
                  name="company_bank_account"
                  value={settings.company_bank_account || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bank IFSC Code</label>
                <input
                  type="text"
                  name="company_bank_ifsc"
                  value={settings.company_bank_ifsc || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: Fee Engine Bracket Configuration */}
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300">
          <div className="space-y-6">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
              <Percent className="h-4.5 w-4.5 text-primary" />
              Calculation Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Calculation Type</label>
                <select
                  name="fee_calculation_type"
                  value={settings.fee_calculation_type || 'flat'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-[#232d3f]/45 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-all cursor-pointer"
                >
                  <option value="flat" className="bg-[#0b0e15]">Flat Tier Rate</option>
                  <option value="slab" className="bg-[#0b0e15]">Progressive Slab Rate</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Invoice Prefix</label>
                <input
                  type="text"
                  name="invoice_prefix"
                  value={settings.invoice_prefix || ''}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">Fee Bracket Slabs</label>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors text-[10px] font-bold cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Bracket
                </button>
              </div>

              <div className="border border-[#232d3f]/50 rounded-lg overflow-hidden bg-surface-lowest/20">
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-lowest/80 border-b border-[#232d3f]/40">
                      <tr>
                        <th className="px-3 py-2.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Min Value (INR)</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Max Value (INR)</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Rate (%)</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Flat Fee (₹)</th>
                        <th className="px-3 py-2.5 text-center text-[9px] font-bold text-on-surface-variant uppercase tracking-wider w-10">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232d3f]/20 bg-slate-900/10 text-xs">
                      {feeRules.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-highest/20 transition-colors">
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={rule.min_value}
                              onChange={(e) => handleRuleChange(idx, 'min_value', e.target.value)}
                              className="w-full bg-surface-lowest/40 border border-[#232d3f]/40 rounded px-2 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={rule.max_value}
                              onChange={(e) => handleRuleChange(idx, 'max_value', e.target.value)}
                              className="w-full bg-surface-lowest/40 border border-[#232d3f]/40 rounded px-2 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.01"
                              value={rule.percentage}
                              onChange={(e) => handleRuleChange(idx, 'percentage', e.target.value)}
                              className="w-full bg-surface-lowest/40 border border-[#232d3f]/40 rounded px-2 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={rule.flat_rate}
                              onChange={(e) => handleRuleChange(idx, 'flat_rate', e.target.value)}
                              className="w-full bg-surface-lowest/40 border border-[#232d3f]/40 rounded px-2 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(idx)}
                              className="p-1 text-on-surface-variant hover:text-error rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-outline-variant/30 mt-8">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              GST Taxation Rules (%)
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CGST Rate</label>
                <input
                  type="text"
                  name="gst_rate_cgst"
                  value={settings.gst_rate_cgst || '9.0'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SGST Rate</label>
                <input
                  type="text"
                  name="gst_rate_sgst"
                  value={settings.gst_rate_sgst || '9.0'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">IGST Rate</label>
                <input
                  type="text"
                  name="gst_rate_igst"
                  value={settings.gst_rate_igst || '18.0'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3: SMTP Mail Configuration */}
        <div className="glass-panel rounded-xl p-6 space-y-6 hover:border-primary/40 transition-colors duration-300">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
            <Mail className="h-4.5 w-4.5 text-primary" />
            Distribution Server Settings
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mailing Protocol</label>
              <select
                name="email_use_outlook"
                value={settings.email_use_outlook || '0'}
                onChange={handleSettingChange}
                className="w-full bg-surface-lowest/50 border border-[#232d3f]/45 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-all cursor-pointer"
              >
                <option value="0" className="bg-[#0b0e15]">SMTP (External Host)</option>
                <option value="1" className="bg-[#0b0e15]">Microsoft Outlook Desktop (COM)</option>
              </select>
            </div>

            {settings.email_use_outlook === '1' ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2 text-on-surface-variant">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Outlook COM Protocol Active</p>
                <p className="text-[11px] leading-relaxed">
                  The application will connect to your local Microsoft Outlook desktop program. Make sure Outlook is open and running in the background before sending emails. 
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SMTP Server Address</label>
                  <input
                    type="text"
                    name="email_smtp_server"
                    placeholder="smtp.gmail.com"
                    value={settings.email_smtp_server || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SMTP Port</label>
                  <input
                    type="number"
                    name="email_smtp_port"
                    placeholder="587"
                    value={settings.email_smtp_port || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SMTP Username</label>
                  <input
                    type="text"
                    name="email_smtp_user"
                    placeholder="billing@wealth.com"
                    value={settings.email_smtp_user || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">SMTP Password</label>
                  <input
                    type="password"
                    name="email_smtp_pass"
                    value={settings.email_smtp_pass || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 4: Template Layout Settings */}
        <div className="glass-panel rounded-xl p-6 space-y-6 hover:border-primary/40 transition-colors duration-300">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
            <Info className="h-4.5 w-4.5 text-primary" />
            Email Template Layout
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Subject Line Template</label>
              <input
                type="text"
                name="email_subject_template"
                value={settings.email_subject_template || ''}
                onChange={handleSettingChange}
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Body Layout Message</label>
              <textarea
                name="email_body_template"
                value={settings.email_body_template || ''}
                onChange={handleSettingChange}
                rows="6"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans resize-none"
              />
            </div>

            <div className="p-4 bg-surface-lowest/40 rounded-lg border border-[#232d3f]/40 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Available Placeholders</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[10px] text-primary font-mono font-semibold">
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-[#232d3f]/20">{'{ClientName}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-[#232d3f]/20">{'{InvoiceNumber}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-[#232d3f]/20">{'{Valuation}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-[#232d3f]/20">{'{FeeAmount}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-[#232d3f]/20">{'{TotalAmount}'}</code></div>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
