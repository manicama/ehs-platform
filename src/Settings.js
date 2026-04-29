import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
];

export default function Settings({ user }) {
  const [activeTab, setActiveTab] = useState('company');
  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [hoursPerMonth, setHoursPerMonth] = useState('167');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [newFormDesc, setNewFormDesc] = useState('');
  const [showNewField, setShowNewField] = useState(false);
  const [newField, setNewField] = useState({
    label: '', field_type: 'text', required: false,
    placeholder: '', options: ''
  });
  const [editingField, setEditingField] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchForms();
  }, []);

  useEffect(() => {
    if (selectedForm) fetchFormFields(selectedForm.id);
  }, [selectedForm]);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_email', user.email)
      .single();
    if (data) {
      setFirstName(data.first_name || '');
      setCompanyName(data.company_name || '');
      setIndustry(data.industry || '');
      setEmployeeCount(data.employee_count || '');
      setHoursPerMonth(data.hours_per_month || '167');
    }
    setLoading(false);
  }

  async function fetchForms() {
    const { data } = await supabase
      .from('forms')
      .select('*')
      .order('created_at');
    if (data) setForms(data);
  }

  async function fetchFormFields(formId) {
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('order_index');
    if (data) setFormFields(data);
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from('settings')
      .upsert({
        user_email: user.email,
        first_name: firstName,
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

  async function createForm() {
    if (!newFormName.trim()) return;
    setFormSaving(true);
    const { data, error } = await supabase
      .from('forms')
      .insert({
        name: newFormName,
        description: newFormDesc,
        created_by: user.email
      })
      .select()
      .single();
    if (!error && data) {
      setForms(prev => [...prev, data]);
      setSelectedForm(data);
      setFormFields([]);
      setNewFormName('');
      setNewFormDesc('');
      setShowNewForm(false);
    }
    setFormSaving(false);
  }

  async function addField() {
    if (!newField.label.trim() || !selectedForm) return;
    setFormSaving(true);
    const { data, error } = await supabase
      .from('form_fields')
      .insert({
        form_id: selectedForm.id,
        label: newField.label,
        field_type: newField.field_type,
        required: newField.required,
        placeholder: newField.placeholder,
        options: newField.options,
        order_index: formFields.length + 1,
      })
      .select()
      .single();
    if (!error && data) {
      setFormFields(prev => [...prev, data]);
      setNewField({ label: '', field_type: 'text', required: false, placeholder: '', options: '' });
      setShowNewField(false);
    }
    setFormSaving(false);
  }

  async function deleteField(id) {
    const { error } = await supabase.from('form_fields').delete().eq('id', id);
    if (!error) setFormFields(prev => prev.filter(f => f.id !== id));
  }

  async function deleteForm(id) {
    const { error } = await supabase.from('forms').delete().eq('id', id);
    if (!error) {
      setForms(prev => prev.filter(f => f.id !== id));
      if (selectedForm?.id === id) {
        setSelectedForm(null);
        setFormFields([]);
      }
    }
  }

  async function create5WhyTemplate() {
    setFormSaving(true);
    const { data: form, error } = await supabase
      .from('forms')
      .insert({
        name: '5 Why Analysis',
        description: 'Root cause analysis using the 5 Why technique',
        created_by: user.email
      })
      .select()
      .single();

    if (!error && form) {
      const fields = [
        { label: 'Immediate Cause', field_type: 'textarea', required: true, placeholder: 'What was the direct cause of the incident?', order_index: 1 },
        { label: 'Why #1 — Why did this happen?', field_type: 'textarea', required: true, placeholder: 'First why...', order_index: 2 },
        { label: 'Why #2 — Why did that happen?', field_type: 'textarea', required: true, placeholder: 'Second why...', order_index: 3 },
        { label: 'Why #3 — Why did that happen?', field_type: 'textarea', required: false, placeholder: 'Third why...', order_index: 4 },
        { label: 'Why #4 — Why did that happen?', field_type: 'textarea', required: false, placeholder: 'Fourth why...', order_index: 5 },
        { label: 'Why #5 — Why did that happen?', field_type: 'textarea', required: false, placeholder: 'Fifth why...', order_index: 6 },
        { label: 'Root Cause Statement', field_type: 'textarea', required: true, placeholder: 'Summarize the root cause identified through the 5 Why analysis...', order_index: 7 },
        { label: 'Corrective Action Required', field_type: 'textarea', required: true, placeholder: 'What action will be taken to prevent recurrence?', order_index: 8 },
        { label: 'Target Completion Date', field_type: 'date', required: true, placeholder: '', order_index: 9 },
        { label: 'Responsible Person', field_type: 'text', required: true, placeholder: 'Who is responsible for the corrective action?', order_index: 10 },
      ].map(f => ({ ...f, form_id: form.id, options: '' }));

      const { data: insertedFields } = await supabase
        .from('form_fields')
        .insert(fields)
        .select();

      setForms(prev => [...prev, form]);
      setSelectedForm(form);
      setFormFields(insertedFields || []);
    }
    setFormSaving(false);
  }

  const INDUSTRIES = [
    'Construction', 'Manufacturing', 'Oil & Gas', 'Healthcare',
    'Warehousing & Logistics', 'Transportation', 'Mining',
    'Agriculture', 'Utilities', 'Other',
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

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          Company
        </button>
        <button
          className={`settings-tab ${activeTab === 'forms' ? 'active' : ''}`}
          onClick={() => setActiveTab('forms')}
        >
          Form Builder
        </button>
      </div>

      {activeTab === 'company' && (
        <div className="settings-grid">
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-title">Company Information</div>
              <div className="settings-section-sub">Basic details about your organization</div>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>Company Name</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Enter your company name" />
              </div>
              <div className="settings-field">
                <label>Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)}>
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
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
                <input type="number" value={employeeCount} onChange={e => setEmployeeCount(e.target.value)} placeholder="Total number of FT employees" />
              </div>
              <div className="settings-field">
                <label>Hours Worked Per Month (per employee)</label>
                <input type="number" value={hoursPerMonth} onChange={e => setHoursPerMonth(e.target.value)} placeholder="167" />
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
                <label>First Name</label>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>
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
              <p>Invite employees, safety managers, and admins to your workspace.</p>
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
              <p>Send automatic notifications when incidents are submitted or stages change.</p>
            </div>
          </div>

          <div className="settings-save-bar">
            <div className="settings-save-info">
              {saved && <span className="settings-saved">✓ Settings saved successfully</span>}
            </div>
            <button className="settings-save-btn" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'forms' && (
        <div className="form-builder">
          <div className="form-builder-layout">
            <div className="form-list">
              <div className="form-list-header">
                <div className="workflow-list-title">Your Forms</div>
                <button className="form-list-add" onClick={() => setShowNewForm(true)}>+ New</button>
              </div>

              {forms.length === 0 && !showNewForm && (
                <div className="form-list-empty">
                  <p>No forms yet</p>
                  <button className="template-btn" onClick={create5WhyTemplate} disabled={formSaving}>
                    {formSaving ? 'Creating...' : '+ Create 5 Why Template'}
                  </button>
                </div>
              )}

              {forms.map(f => (
                <div
                  key={f.id}
                  className={`workflow-item ${selectedForm?.id === f.id ? 'active' : ''}`}
                  onClick={() => setSelectedForm(f)}
                >
                  <div className="workflow-item-name">{f.name}</div>
                  <div className="workflow-item-meta">
                    {formFields.length > 0 && selectedForm?.id === f.id
                      ? `${formFields.length} fields`
                      : ''}
                  </div>
                </div>
              ))}

              {showNewForm && (
                <div className="new-form-inline">
                  <input
                    value={newFormName}
                    onChange={e => setNewFormName(e.target.value)}
                    placeholder="Form name"
                    autoFocus
                  />
                  <input
                    value={newFormDesc}
                    onChange={e => setNewFormDesc(e.target.value)}
                    placeholder="Description (optional)"
                  />
                  <div className="new-form-actions">
                    <button onClick={createForm} disabled={formSaving}>Create</button>
                    <button className="btn-secondary" onClick={() => setShowNewForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-detail">
              {!selectedForm ? (
                <div className="form-detail-empty">
                  <div className="ai-empty-icon">📋</div>
                  <p>Select a form to edit or create a new one</p>
                  <button className="template-btn" onClick={create5WhyTemplate} disabled={formSaving}>
                    {formSaving ? 'Creating...' : '+ Create 5 Why Template'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="form-detail-header">
                    <div>
                      <h3>{selectedForm.name}</h3>
                      {selectedForm.description && (
                        <p className="workflow-detail-desc">{selectedForm.description}</p>
                      )}
                    </div>
                    <button
                      className="btn-danger-outline"
                      onClick={() => deleteForm(selectedForm.id)}
                    >
                      Delete Form
                    </button>
                  </div>

                  <div className="form-fields-list">
                    {formFields.map((field, index) => (
                      <div key={field.id} className="form-field-row">
                        {editingField === field.id ? (
                          <div className="field-edit-form">
                            <div className="field-edit-grid">
                              <div className="settings-field">
                                <label>Field Label</label>
                                <input
                                  defaultValue={field.label}
                                  id={`label-${field.id}`}
                                  placeholder="Question or label"
                                />
                              </div>
                              <div className="settings-field">
                                <label>Field Type</label>
                                <select defaultValue={field.field_type} id={`type-${field.id}`}>
                                  {FIELD_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="settings-field">
                                <label>Placeholder</label>
                                <input
                                  defaultValue={field.placeholder}
                                  id={`placeholder-${field.id}`}
                                  placeholder="Helper text"
                                />
                              </div>
                              <div className="settings-field">
                                <label>
                                  <input
                                    type="checkbox"
                                    defaultChecked={field.required}
                                    id={`required-${field.id}`}
                                    style={{marginRight: '8px'}}
                                  />
                                  Required field
                                </label>
                              </div>
                            </div>
                            <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                              <button onClick={async () => {
                                const updates = {
                                  label: document.getElementById(`label-${field.id}`).value,
                                  field_type: document.getElementById(`type-${field.id}`).value,
                                  placeholder: document.getElementById(`placeholder-${field.id}`).value,
                                  required: document.getElementById(`required-${field.id}`).checked,
                                };
                                await supabase.from('form_fields').update(updates).eq('id', field.id);
                                setFormFields(prev => prev.map(f => f.id === field.id ? {...f, ...updates} : f));
                                setEditingField(null);
                              }}>Save</button>
                              <button className="btn-secondary" onClick={() => setEditingField(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="field-number">{index + 1}</div>
                            <div className="field-info">
                              <div className="field-label">
                                {field.label}
                                {field.required && <span className="required-dot">*</span>}
                              </div>
                              <div className="field-type-tag">
                                {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                              </div>
                            </div>
                            <div className="stage-actions">
                              <button className="btn-icon" onClick={() => setEditingField(field.id)}>✏️</button>
                              <button className="btn-icon btn-danger" onClick={() => deleteField(field.id)}>🗑</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {showNewField ? (
                      <div className="form-field-row new-field-form">
                        <div className="field-edit-form" style={{width:'100%'}}>
                          <div className="field-edit-grid">
                            <div className="settings-field">
                              <label>Field Label</label>
                              <input
                                value={newField.label}
                                onChange={e => setNewField(p => ({...p, label: e.target.value}))}
                                placeholder="Question or label"
                                autoFocus
                              />
                            </div>
                            <div className="settings-field">
                              <label>Field Type</label>
                              <select
                                value={newField.field_type}
                                onChange={e => setNewField(p => ({...p, field_type: e.target.value}))}
                              >
                                {FIELD_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="settings-field">
                              <label>Placeholder</label>
                              <input
                                value={newField.placeholder}
                                onChange={e => setNewField(p => ({...p, placeholder: e.target.value}))}
                                placeholder="Helper text (optional)"
                              />
                            </div>
                            {newField.field_type === 'dropdown' && (
                              <div className="settings-field" style={{gridColumn: '1/-1'}}>
                                <label>Options (comma separated)</label>
                                <input
                                  value={newField.options}
                                  onChange={e => setNewField(p => ({...p, options: e.target.value}))}
                                  placeholder="Option 1, Option 2, Option 3"
                                />
                              </div>
                            )}
                            <div className="settings-field">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={newField.required}
                                  onChange={e => setNewField(p => ({...p, required: e.target.checked}))}
                                  style={{marginRight: '8px'}}
                                />
                                Required field
                              </label>
                            </div>
                          </div>
                          <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                            <button onClick={addField} disabled={formSaving}>
                              {formSaving ? 'Adding...' : 'Add Field'}
                            </button>
                            <button className="btn-secondary" onClick={() => setShowNewField(false)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button className="add-stage-btn" onClick={() => setShowNewField(true)}>
                        + Add Field
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}