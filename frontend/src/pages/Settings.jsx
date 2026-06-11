import { useState, useEffect } from 'react';
import { Save, Building2, Globe, Phone, Mail, MapPin, Clock, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import api from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [clearing, setClearing] = useState(null);

  useEffect(() => {
    api.getSettings().then(s => { setSettings(s); setDirty(false); }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const clearData = async (label, table) => {
    if (!confirm(`Delete ALL ${label.toLowerCase()}? This cannot be undone.`)) return;
    setClearing(label);
    try {
      await api.clearData(table);
      alert(`Cleared all ${label.toLowerCase()} successfully`);
      window.dispatchEvent(new Event('data-cleared'));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
    setClearing(null);
  };

  const update = (key, value) => {
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  };

  const fields = [
    { key: 'company_name', label: 'Company Name', icon: Building2 },
    { key: 'company_tagline', label: 'Tagline / Slogan', icon: Globe },
    { key: 'company_description', label: 'About Company', icon: Globe },
    { key: 'company_phone', label: 'Phone Number', icon: Phone },
    { key: 'company_email', label: 'Email Address', icon: Mail },
    { key: 'company_address', label: 'Physical Address', icon: MapPin },
    { key: 'business_hours', label: 'Business Hours', icon: Clock },
    { key: 'company_website', label: 'Website', icon: Globe },
    { key: 'whatsapp_number', label: 'WhatsApp Number', icon: Phone },
    { key: 'google_maps_url', label: 'Google Maps Link', icon: Globe },
    { key: 'facebook_url', label: 'Facebook URL', icon: Globe },
    { key: 'linkedin_url', label: 'LinkedIn URL', icon: Globe },
  ];

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <p className="text-mute-dark text-sm mt-0.5">Manage company information — click Save to persist</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 text-sm font-semibold animate-fade-in">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          {dirty && !saved && (
            <span className="flex items-center gap-1.5 text-brand text-sm font-semibold animate-fade-in">
              <AlertCircle className="w-4 h-4" /> Unsaved
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !dirty}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/10">
            <Building2 className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Company Profile</h3>
            <p className="text-sm text-mute-dark">Used in bot responses to customers</p>
          </div>
        </div>
        <div className="space-y-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">{label}</label>
              <input type="text" value={settings[key] || ''} onChange={e => update(key, e.target.value)} className="glass-input" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/10">
            <Globe className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="font-semibold text-white">System Status</h3>
        </div>
        <div className="space-y-3 text-sm">
          {[
            ['Backend API', 'Operational'],
            ['Database', 'SQLite Connected'],
            ['WhatsApp', 'Connected'],
            ['Gemini AI', 'Active'],
          ].map(([label, status]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-white/[0.03] last:border-0">
              <span className="text-mute">{label}</span>
              <span className="font-semibold text-green-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />{status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/10">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Data Management</h3>
            <p className="text-sm text-mute-dark">Clear records — this cannot be undone</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Orders & Quotations', table: 'quotation_requests' },
            { label: 'Support Tickets', table: 'support_tickets' },
            { label: 'Conversations & Messages', table: 'conversations' },
          ].map(({ label, table }) => (
            <button
              key={table}
              onClick={() => clearData(label, table)}
              disabled={clearing !== null}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 inline mr-1.5" />
              {clearing === label ? 'Clearing...' : `Clear ${label}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
