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
  CreditCard,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [feeRules, setFeeRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  
  // Custom Lock State for Auto-Imported Profile details
  const [profileLocked, setProfileLocked] = useState(true);
  const [showLegacySlabs, setShowLegacySlabs] = useState(false);

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
    if (e) e.preventDefault();
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
          <p className="mt-1 text-sm text-on-surface-variant font-medium">Manage invoice defaults, mailing protocol, and templates. Ingested profiles can be overridden below.</p>
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
        
        {/* PANEL 1: Company Profile (Read-Only by default with Manual Override option) */}
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between hover:border-primary/45 transition-colors duration-300">
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-outline-variant/30">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Building className="h-4.5 w-4.5 text-primary" />
                Company Billing Profile
              </h3>
              <button
                type="button"
                onClick={() => setProfileLocked(!profileLocked)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  profileLocked 
                    ? 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                {profileLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Auto-Linked (Excel)
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5 animate-pulse" />
                    Unlocked (Manual)
                  </>
                )}
              </button>
            </div>

            {profileLocked && (
              <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-3.5 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Inferred from Active Workbook</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                    These settings are automatically parsed from the **Invoice** sheet of your uploaded Excel file. Click the badge above to manually override.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company Registered Name</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-semibold font-sans">
                    {settings.company_name || 'No master sheet loaded yet'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_name"
                    value={settings.company_name || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Registered Office Address</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-semibold font-sans leading-relaxed">
                    {settings.company_address || 'No master sheet loaded yet'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_address"
                    value={settings.company_address || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company GSTIN</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-mono font-bold">
                    {settings.company_gstin || 'Not configured'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_gstin"
                    value={settings.company_gstin || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Support Email</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-semibold font-sans">
                    {settings.company_email || 'Not configured'}
                  </div>
                ) : (
                  <input
                    type="email"
                    name="company_email"
                    value={settings.company_email || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                )}
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
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-semibold">
                    {settings.company_bank_name || 'No bank info loaded'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_bank_name"
                    value={settings.company_bank_name || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all font-sans"
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Account Number</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-mono">
                    {settings.company_bank_account || 'Not configured'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_bank_account"
                    value={settings.company_bank_account || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bank IFSC Code</label>
                {profileLocked ? (
                  <div className="w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85 font-mono">
                    {settings.company_bank_ifsc || 'Not configured'}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="company_bank_ifsc"
                    value={settings.company_bank_ifsc || ''}
                    onChange={handleSettingChange}
                    className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: Active Calculation & Fallback Rules */}
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between hover:border-primary/45 transition-colors duration-300">
          <div className="space-y-6">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
              <Percent className="h-4.5 w-4.5 text-primary" />
              Calculation Configuration
            </h3>

            {/* Active CCPL Engine Indicator */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Excel Automation Active</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Billing fees and client allocations are calculated directly inside the Excel workbook. Overrides synced from the workbench are dynamically recalculated by Excel COM formulas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fallback Calculation Method</label>
                <select
                  name="fee_calculation_type"
                  value={settings.fee_calculation_type || 'flat'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-all cursor-pointer"
                >
                  <option value="flat" className="bg-[#0b0e15]">Flat Tier Rate</option>
                  <option value="slab" className="bg-[#0b0e15]">Progressive Slab Rate</option>
                </select>
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                  Active Fee Calculation Formula (Excel & Fallback)
                  <Info className="h-3.5 w-3.5 text-on-surface-variant/70 cursor-help" title="Defines the taxable fee formula written to Excel. Use placeholders 'Value' (Valuation) and 'Rate' (Fee %)." />
                </label>
                <input
                  type="text"
                  name="taxable_amt_formula"
                  value={settings.taxable_amt_formula || 'Value * Rate / 4'}
                  onChange={handleSettingChange}
                  className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface font-mono tracking-wider focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                  placeholder="Value * Rate / 4"
                />
                <span className="text-[9.5px] text-on-surface-variant leading-relaxed block mt-1">
                  Supports standard operators (<code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>). Placeholders: <strong>Value</strong> (Valuation) and <strong>Rate</strong> (Fee %).
                </span>
              </div>
            </div>

            {/* Collapsible Legacy slabs for clean look */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowLegacySlabs(!showLegacySlabs)}
                  className="text-xs font-semibold text-primary hover:text-primary-fixed hover:underline transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {showLegacySlabs ? 'Hide' : 'Show'} Legacy Bracket Slabs (Folder Mode)
                </button>
                {showLegacySlabs && (
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors text-[9px] font-bold cursor-pointer"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Bracket
                  </button>
                )}
              </div>

              {showLegacySlabs && (
                <div className="border border-outline-variant/30 rounded-lg overflow-hidden bg-surface-lowest/20 animate-fade-in">
                  <div className="max-h-[170px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-surface-lowest/80 border-b border-[#232d3f]/40">
                        <tr>
                          <th className="px-3 py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Min (INR)</th>
                          <th className="px-3 py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Max (INR)</th>
                          <th className="px-3 py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Rate (%)</th>
                          <th className="px-3 py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Flat (₹)</th>
                          <th className="px-3 py-2 text-center text-[9px] font-bold text-on-surface-variant uppercase tracking-wider w-8">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 bg-slate-900/10 text-xs">
                        {feeRules.map((rule, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-highest/20 transition-colors">
                            <td className="px-2 py-0.5">
                              <input
                                type="number"
                                value={rule.min_value}
                                onChange={(e) => handleRuleChange(idx, 'min_value', e.target.value)}
                                className="w-full bg-surface-lowest/40 border border-outline-variant/20 rounded px-1.5 py-0.5 text-xs text-on-surface font-mono"
                              />
                            </td>
                            <td className="px-2 py-0.5">
                              <input
                                type="number"
                                value={rule.max_value}
                                onChange={(e) => handleRuleChange(idx, 'max_value', e.target.value)}
                                className="w-full bg-surface-lowest/40 border border-outline-variant/20 rounded px-1.5 py-0.5 text-xs text-on-surface font-mono"
                              />
                            </td>
                            <td className="px-2 py-0.5">
                              <input
                                type="number"
                                step="0.01"
                                value={rule.percentage}
                                onChange={(e) => handleRuleChange(idx, 'percentage', e.target.value)}
                                className="w-full bg-surface-lowest/40 border border-outline-variant/20 rounded px-1.5 py-0.5 text-xs text-on-surface font-mono"
                              />
                            </td>
                            <td className="px-2 py-0.5">
                              <input
                                type="number"
                                value={rule.flat_rate}
                                onChange={(e) => handleRuleChange(idx, 'flat_rate', e.target.value)}
                                className="w-full bg-surface-lowest/40 border border-outline-variant/20 rounded px-1.5 py-0.5 text-xs text-on-surface font-mono"
                              />
                            </td>
                            <td className="px-2 py-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(idx)}
                                className="p-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
        <div className="glass-panel rounded-xl p-6 space-y-6 hover:border-primary/45 transition-colors duration-300">
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
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 transition-all cursor-pointer"
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
        <div className="glass-panel rounded-xl p-6 space-y-6 hover:border-primary/45 transition-colors duration-300">
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

            <div className="p-4 bg-surface-lowest/40 rounded-lg border border-outline-variant/20 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Available Placeholders</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[10px] text-primary font-mono font-semibold">
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-outline-variant/10">{'{ClientName}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-outline-variant/10">{'{InvoiceNumber}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-outline-variant/10">{'{Valuation}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-outline-variant/10">{'{FeeAmount}'}</code></div>
                <div><code className="bg-surface-lowest/60 px-1 py-0.5 rounded border border-outline-variant/10">{'{TotalAmount}'}</code></div>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
