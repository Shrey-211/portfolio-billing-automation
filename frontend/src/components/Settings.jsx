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
  AlertCircle,
  SendHorizonal,
  Loader2,
} from 'lucide-react';

const TABS = [
  { id: 'company',     label: 'Company Profile',    icon: Building },
  { id: 'calculation', label: 'Calculation',         icon: Percent  },
  { id: 'smtp',        label: 'Mail Server',         icon: Mail     },
  { id: 'templates',   label: 'Email Templates',     icon: Info     },
];

export default function Settings() {
  const [activeTab, setActiveTab]   = useState('company');
  const [settings, setSettings]     = useState({});
  const [feeRules, setFeeRules]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const [profileLocked, setProfileLocked]   = useState(true);
  const [showLegacySlabs, setShowLegacySlabs] = useState(false);

  const [testEmailAddr,   setTestEmailAddr]   = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState(null);
  const [testEmailMsg,    setTestEmailMsg]    = useState('');

  useEffect(() => {
    fetchSettings();
    fetchFeeRules();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) setSettings(await res.json());
    } catch (err) { console.error('Failed to load settings:', err); }
  };

  const fetchFeeRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/fee-rules`);
      if (res.ok) setFeeRules(await res.json());
    } catch (err) { console.error('Failed to load fee rules:', err); }
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
    const nextMin  = lastRule ? lastRule.max_value : 0;
    setFeeRules(prev => [...prev, { min_value: nextMin, max_value: nextMin + 10000000, percentage: 0.1, flat_rate: 0 }]);
  };

  const handleDeleteRule = (idx) => setFeeRules(prev => prev.filter((_, i) => i !== idx));

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSaveStatus('');
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_BASE}/api/settings`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        }),
        fetch(`${API_BASE}/api/settings/fee-rules`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: feeRules }),
        }),
      ]);
      setSaveStatus(r1.ok && r2.ok ? 'success' : 'error');
      if (r1.ok && r2.ok) setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailAddr.trim()) return;
    setTestEmailStatus('loading');
    setTestEmailMsg('');
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const res = await fetch(`${API_BASE}/api/email/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: testEmailAddr.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestEmailStatus('success');
        setTestEmailMsg(data.message || 'Test email sent successfully!');
      } else {
        const err = await res.json();
        setTestEmailStatus('error');
        setTestEmailMsg(err.detail || 'Failed to send test email.');
      }
    } catch (err) {
      setTestEmailStatus('error');
      setTestEmailMsg(err.message || 'Network error.');
    }
  };

  /* ─── field helper ─── */
  const Field = ({ label, children }) => (
    <div className="space-y-2">{label && <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</label>}{children}</div>
  );
  const inputCls = "w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all";
  const readCls  = "w-full bg-surface-lowest/20 border border-outline-variant/10 rounded-lg px-4 py-2.5 text-xs text-on-surface/85";

  /* ─── tab panels ─── */
  const panels = {

    /* ── 1. Company Profile ── */
    company: (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-on-surface">Company Billing Profile</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Automatically parsed from the Invoice sheet of your master Excel workbook.</p>
          </div>
          <button
            type="button"
            onClick={() => setProfileLocked(!profileLocked)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
              profileLocked
                ? 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            {profileLocked ? <><Lock className="h-3.5 w-3.5" /> Auto-Linked (Excel)</> : <><Unlock className="h-3.5 w-3.5 animate-pulse" /> Unlocked (Manual)</>}
          </button>
        </div>

        {profileLocked && (
          <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-3.5 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              These settings are automatically parsed from the <strong>Invoice</strong> sheet of your uploaded Excel file. Click the badge above to manually override.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Company Registered Name">
            <div className="sm:col-span-2">
              {profileLocked
                ? <div className={readCls + ' font-semibold'}>{settings.company_name || 'No master sheet loaded yet'}</div>
                : <input type="text" name="company_name" value={settings.company_name || ''} onChange={handleSettingChange} className={inputCls} />}
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Registered Office Address">
              {profileLocked
                ? <div className={readCls + ' leading-relaxed font-semibold'}>{settings.company_address || 'No master sheet loaded yet'}</div>
                : <input type="text" name="company_address" value={settings.company_address || ''} onChange={handleSettingChange} className={inputCls} />}
            </Field>
          </div>

          <Field label="Company GSTIN">
            {profileLocked
              ? <div className={readCls + ' font-mono font-bold tracking-wider'}>{settings.company_gstin || 'Not configured'}</div>
              : <input type="text" name="company_gstin" value={settings.company_gstin || ''} onChange={handleSettingChange} className={inputCls + ' font-mono tracking-wider'} />}
          </Field>

          <Field label="Support Email">
            {profileLocked
              ? <div className={readCls + ' font-semibold'}>{settings.company_email || 'Not configured'}</div>
              : <input type="email" name="company_email" value={settings.company_email || ''} onChange={handleSettingChange} className={inputCls} />}
          </Field>
        </div>

        <div className="border-t border-outline-variant/30 pt-6 space-y-5">
          <p className="text-xs font-bold text-on-surface flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Settlement Bank Credentials
          </p>
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <Field label="Bank Name">
                {profileLocked
                  ? <div className={readCls + ' font-semibold'}>{settings.company_bank_name || 'No bank info loaded'}</div>
                  : <input type="text" name="company_bank_name" value={settings.company_bank_name || ''} onChange={handleSettingChange} className={inputCls} />}
              </Field>
            </div>
            <Field label="Account Number">
              {profileLocked
                ? <div className={readCls + ' font-mono'}>{settings.company_bank_account || 'Not configured'}</div>
                : <input type="text" name="company_bank_account" value={settings.company_bank_account || ''} onChange={handleSettingChange} className={inputCls + ' font-mono tracking-wider'} />}
            </Field>
            <Field label="Bank IFSC Code">
              {profileLocked
                ? <div className={readCls + ' font-mono'}>{settings.company_bank_ifsc || 'Not configured'}</div>
                : <input type="text" name="company_bank_ifsc" value={settings.company_bank_ifsc || ''} onChange={handleSettingChange} className={inputCls + ' font-mono tracking-wider'} />}
            </Field>
          </div>
        </div>
      </div>
    ),

    /* ── 2. Calculation Configuration ── */
    calculation: (
      <div className="space-y-8 animate-fade-in">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse mt-1 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Excel Automation Active</p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
              Billing fees and client allocations are calculated directly inside the Excel workbook. Overrides synced from the workbench are dynamically recalculated by Excel COM formulas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Invoice Prefix">
            <input type="text" name="invoice_prefix" value={settings.invoice_prefix || ''} onChange={handleSettingChange} className={inputCls + ' font-mono tracking-wider'} />
          </Field>
          <Field label="Fallback Calculation Method">
            <select name="fee_calculation_type" value={settings.fee_calculation_type || 'flat'} onChange={handleSettingChange} className={inputCls + ' cursor-pointer'}>
              <option value="flat" className="bg-[#0b0e15]">Flat Tier Rate</option>
              <option value="slab" className="bg-[#0b0e15]">Progressive Slab Rate</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label={<span className="flex items-center gap-1">Active Fee Calculation Formula (Excel & Fallback)<Info className="h-3.5 w-3.5 text-on-surface-variant/60" title="Use placeholders 'Value' (Valuation) and 'Rate' (Fee %)." /></span>}>
              <input type="text" name="taxable_amt_formula" value={settings.taxable_amt_formula || 'Value * Rate / 4'} onChange={handleSettingChange} placeholder="Value * Rate / 4" className={inputCls + ' font-mono tracking-wider'} />
              <p className="text-[9.5px] text-on-surface-variant mt-1">Supports <code>+</code> <code>-</code> <code>*</code> <code>/</code>. Placeholders: <strong>Value</strong> (Valuation) and <strong>Rate</strong> (Fee %).</p>
            </Field>
          </div>
        </div>

        <div className="border-t border-outline-variant/30 pt-6 space-y-5">
          <p className="text-xs font-bold text-on-surface">GST Taxation Rules (%)</p>
          <div className="grid grid-cols-3 gap-5">
            {[['CGST Rate', 'gst_rate_cgst', '9.0'], ['SGST Rate', 'gst_rate_sgst', '9.0'], ['IGST Rate', 'gst_rate_igst', '18.0']].map(([label, name, def]) => (
              <Field key={name} label={label}>
                <input type="text" name={name} value={settings[name] || def} onChange={handleSettingChange} className={inputCls + ' font-mono'} />
              </Field>
            ))}
          </div>
        </div>

        <div className="border-t border-outline-variant/30 pt-6 space-y-3">
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => setShowLegacySlabs(!showLegacySlabs)} className="text-xs font-semibold text-primary hover:underline transition-all flex items-center gap-1.5 cursor-pointer">
              {showLegacySlabs ? 'Hide' : 'Show'} Legacy Bracket Slabs (Folder Mode)
            </button>
            {showLegacySlabs && (
              <button type="button" onClick={handleAddRule} className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors text-[9px] font-bold cursor-pointer">
                <Plus className="h-3 w-3 mr-1" /> Add Bracket
              </button>
            )}
          </div>
          {showLegacySlabs && (
            <div className="border border-outline-variant/30 rounded-lg overflow-hidden bg-surface-lowest/20 animate-fade-in">
              <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-lowest/80 border-b border-[#232d3f]/40">
                    <tr>
                      {['Min (INR)', 'Max (INR)', 'Rate (%)', 'Flat (₹)', 'Del'].map(h => (
                        <th key={h} className="px-3 py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 bg-slate-900/10 text-xs">
                    {feeRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-highest/20 transition-colors">
                        {[['min_value', 'number'], ['max_value', 'number'], ['percentage', 'number', '0.01'], ['flat_rate', 'number']].map(([field, type, step]) => (
                          <td key={field} className="px-2 py-1">
                            <input type={type} step={step} value={rule[field]} onChange={e => handleRuleChange(idx, field, e.target.value)} className="w-full bg-surface-lowest/40 border border-outline-variant/20 rounded px-1.5 py-0.5 text-xs text-on-surface font-mono" />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center">
                          <button type="button" onClick={() => handleDeleteRule(idx)} className="p-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer">
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
    ),

    /* ── 3. SMTP Mail Server ── */
    smtp: (
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-sm font-bold text-on-surface">Distribution Server Settings</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Configure the outbound mail protocol used for sending invoices and reports.</p>
        </div>

        <Field label="Mailing Protocol">
          <select name="email_use_outlook" value={settings.email_use_outlook || '0'} onChange={handleSettingChange} className={inputCls + ' cursor-pointer'}>
            <option value="0" className="bg-[#0b0e15]">SMTP (External Host)</option>
            <option value="1" className="bg-[#0b0e15]">Microsoft Outlook Desktop (COM)</option>
          </select>
        </Field>

        {settings.email_use_outlook === '1' ? (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Outlook COM Protocol Active</p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              The application will connect to your local Microsoft Outlook desktop program. Make sure Outlook is open and running in the background before sending emails.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="sm:col-span-2">
              <Field label="SMTP Server Address">
                <input type="text" name="email_smtp_server" placeholder="smtp.gmail.com" value={settings.email_smtp_server || ''} onChange={handleSettingChange} className={inputCls} />
              </Field>
            </div>
            <Field label="SMTP Port">
              <input type="number" name="email_smtp_port" placeholder="587" value={settings.email_smtp_port || ''} onChange={handleSettingChange} className={inputCls + ' font-mono'} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="SMTP Username">
                <input type="text" name="email_smtp_user" placeholder="billing@wealth.com" value={settings.email_smtp_user || ''} onChange={handleSettingChange} className={inputCls} />
              </Field>
            </div>
            <Field label="SMTP Password">
              <input type="password" name="email_smtp_pass" value={settings.email_smtp_pass || ''} onChange={handleSettingChange} className={inputCls} />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Encryption / TLS Mode">
                <select name="email_smtp_tls" value={settings.email_smtp_tls || 'starttls'} onChange={handleSettingChange} className={inputCls + ' cursor-pointer'}>
                  <option value="starttls" className="bg-[#0b0e15]">STARTTLS — Upgrade to TLS (port 587 / 2525)</option>
                  <option value="ssl"      className="bg-[#0b0e15]">SSL/TLS — Direct SSL wrap (port 465)</option>
                  <option value="none"     className="bg-[#0b0e15]">None — Plain / No encryption (port 25 / 1025 MailHog)</option>
                </select>
                <p className="text-[9.5px] text-on-surface-variant mt-1.5">
                  Use <strong>None</strong> for local MailHog testing. Use <strong>STARTTLS</strong> for Gmail/Office365. Use <strong>SSL</strong> for port 465 servers.
                </p>
              </Field>
            </div>

            {/* ── Test Connection ── */}
            <div className="sm:col-span-3 p-4 bg-surface-lowest/30 border border-outline-variant/20 rounded-lg space-y-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Test SMTP Connection
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Recipient: test@example.com"
                  value={testEmailAddr}
                  onChange={e => { setTestEmailAddr(e.target.value); setTestEmailStatus(null); }}
                  className="flex-1 bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2 text-xs text-on-surface focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all"
                />
                <button
                  type="button"
                  onClick={sendTestEmail}
                  disabled={testEmailStatus === 'loading' || !testEmailAddr.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {testEmailStatus === 'loading'
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                    : <><SendHorizonal className="h-3.5 w-3.5" /> Send Test</>}
                </button>
              </div>
              {testEmailStatus === 'success' && (
                <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                  <Check className="h-3.5 w-3.5" /> {testEmailMsg}
                </p>
              )}
              {testEmailStatus === 'error' && (
                <p className="text-[10px] font-semibold text-red-400 flex items-center gap-1.5 animate-fade-in">
                  <AlertCircle className="h-3.5 w-3.5" /> {testEmailMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    ),

    /* ── 4. Email Templates ── */
    templates: (
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-sm font-bold text-on-surface">Email Template Layout</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Customize the subject and body of outbound invoice emails using dynamic placeholders.</p>
        </div>

        <Field label="Subject Line Template">
          <input type="text" name="email_subject_template" value={settings.email_subject_template || ''} onChange={handleSettingChange} className={inputCls} />
        </Field>

        <Field label="Body Layout Message">
          <textarea name="email_body_template" value={settings.email_body_template || ''} onChange={handleSettingChange} rows="10" className={inputCls + ' resize-none leading-relaxed'} />
        </Field>

        <div className="p-4 bg-surface-lowest/40 rounded-lg border border-outline-variant/20 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Available Placeholders</p>
          <div className="flex flex-wrap gap-2">
            {['{ClientName}', '{InvoiceNumber}', '{Valuation}', '{FeeAmount}', '{TotalAmount}', '{CustomMessage}'].map(p => (
              <code key={p} className="text-[10px] text-primary font-mono font-semibold bg-surface-lowest/60 px-2 py-1 rounded border border-outline-variant/10">{p}</code>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 z-10 relative">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline-xl">System Settings</h2>
          <p className="mt-1 text-sm text-on-surface-variant font-medium">Manage invoice defaults, mailing protocol, and email templates.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5 bg-secondary/15 border border-secondary/25 px-4 py-2 rounded-lg animate-fade-in">
              <Check className="h-4 w-4" /> Settings Saved!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs font-semibold text-error bg-error/15 border border-error/25 px-4 py-2 rounded-lg animate-fade-in">
              Failed to save.
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Settings</>}
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-outline-variant/20 bg-surface-lowest/30">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-5 py-4 text-xs font-bold transition-all cursor-pointer flex-1 justify-center sm:flex-none sm:justify-start whitespace-nowrap ${
                activeTab === id
                  ? 'text-primary bg-primary/5'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-lowest/40'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              {/* Active indicator */}
              {activeTab === id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <form onSubmit={handleSaveAll} className="p-7">
          {panels[activeTab]}
        </form>
      </div>
    </div>
  );
}
