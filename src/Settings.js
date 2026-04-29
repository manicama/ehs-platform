import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Settings({ user }) {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [hoursPerMonth, setHoursPerMonth] = useState('167');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_email', user.email)
      .single();

    if (data) {
      setCompanyName(data.company_name || '');
      setIndustry(data.industry || '');
      setEmployeeCount(data.employee_count || '');
      setHoursPerMonth(data.hours_per_month || '167');
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('settings')
      .upsert({
        user_email: user.email,
        company_name: companyName,
        industry,
        employee_count: parseInt(employeeCount) || null,
        hours_per_month: parseInt(hoursPerMonth) || 167,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email' });

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  const INDUSTRIES = [
    'Construction',
    'Manufacturing',
    'Oil & Gas',
    'Healthcare',
    'Warehousing & Logistics',
    'Transportation',
    'Mining',
    'Agriculture',
    'Utilities',
    'Other',
  ];

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Configure your SafetyIQ workspace</p>
      </div>

      <div className="settings-grid">

        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">Company Information</div>
            <div className="settings-section-sub">Basic details about your organization</div>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label>Company Name</label>
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Enter your company name"
              />
            </div>
            <div className="settings-field">
              <label>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)}>
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">Workforce Configuration</div>
            <div className="settings-section-sub">Used for TRIR and DART calculations on the dashboard</div>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label>Full Time Employees</label>
              <input
                type="number"
                value={employeeCount}
                onChange={e => setEmployeeCount(e.target.value)}
                placeholder="Total number of FT employees"
              />
            </div>
            <div className="settings-field">
              <label>Hours Worked Per Month (per employee)</label>
              <input
                type="number"
                value={hoursPerMonth}
                onChange={e => setHoursPerMonth(e.target.value)}
                placeholder="167"
              />
              <span className="settings-hint">Standard is 167 hours (2,000 hrs/year ÷ 12)</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">Account</div>
            <div className="settings-section-sub">Your account information</div>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label>Email</label>
              <input value={user.email} disabled className="settings-disabled" />
            </div>
            <div className="settings-field">
              <label>Role</label>
              <input value="Administrator" disabled className="settings-disabled" />
            </div>
          </div>
        </div>

        <div className="settings-section coming-soon">
          <div className="settings-section-header">
            <div className="settings-section-title">
              User Management
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
            <div className="settings-section-sub">Invite team members and manage roles</div>
          </div>
          <div className="coming-soon-content">
            <p>Invite employees, safety managers, and admins to your workspace. Control who can submit incidents, manage workflows, and view reports.</p>
          </div>
        </div>

        <div className="settings-section coming-soon">
          <div className="settings-section-header">
            <div className="settings-section-title">
              Email Notifications
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
            <div className="settings-section-sub">Configure automatic alerts and reminders</div>
          </div>
          <div className="coming-soon-content">
            <p>Send automatic notifications when incidents are submitted, stages change, or actions are overdue.</p>
          </div>
        </div>

      </div>

      <div className="settings-save-bar">
        <div className="settings-save-info">
          {saved && <span className="settings-saved">✓ Settings saved successfully</span>}
        </div>
        <button
          className="settings-save-btn"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}