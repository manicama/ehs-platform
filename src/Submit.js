import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const INCIDENT_TYPES = [
  'Injury',
  'Near Miss',
  'Property Damage',
  'Environmental',
  'Security',
  'Other'
];

export default function Submit({ user }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [defaultWorkflow, setDefaultWorkflow] = useState(null);
  const [firstStage, setFirstStage] = useState(null);

  const [form, setForm] = useState({
    title: '',
    incident_type: '',
    occurred_at: '',
    location: '',
    description: '',
    immediate_action: '',
    is_osha_recordable: false,
    is_dart: false,
  });

  useEffect(() => {
    fetchDefaultWorkflow();
  }, []);

  async function fetchDefaultWorkflow() {
    const { data: workflow } = await supabase
      .from('workflows')
      .select('*')
      .eq('is_default', true)
      .single();

    if (workflow) {
      setDefaultWorkflow(workflow);
      const { data: stages } = await supabase
        .from('workflow_stages')
        .select('*')
        .eq('workflow_id', workflow.id)
        .order('order_index')
        .limit(1)
        .single();
      if (stages) setFirstStage(stages);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase
      .from('incidents')
      .insert({
        ...form,
        reported_by: user.email,
        status: firstStage?.name || 'new',
        workflow_id: defaultWorkflow?.id || null,
        current_stage_id: firstStage?.id || null,
      });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setForm({
        title: '',
        incident_type: '',
        occurred_at: '',
        location: '',
        description: '',
        immediate_action: '',
        is_osha_recordable: false,
        is_dart: false,
      });
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="submit-success">
        <div className="success-icon">✓</div>
        <h2>Incident Reported</h2>
        <p>Your incident has been submitted and is now in the <strong>{firstStage?.name || 'New'}</strong> stage.</p>
        <button onClick={() => setSuccess(false)}>Submit Another</button>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="page-header">
        <h2>Report an Incident</h2>
        <p>Complete the form below to submit a new incident report</p>
      </div>

      {defaultWorkflow && (
        <div className="workflow-banner">
          <span className="workflow-banner-icon">⚡</span>
          Using workflow: <strong>{defaultWorkflow.name}</strong>
          {firstStage && <span className="workflow-banner-stage">→ Will start at <strong>{firstStage.name}</strong></span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="incident-form">
        <div className="form-section">
          <div className="form-section-title">Basic Information</div>
          <div className="form-grid">
            <div className="form-field full">
              <label>Incident Title <span className="required">*</span></label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Brief title describing the incident"
                required
              />
            </div>
            <div className="form-field">
              <label>Incident Type <span className="required">*</span></label>
              <select name="incident_type" value={form.incident_type} onChange={handleChange} required>
                <option value="">Select type...</option>
                {INCIDENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Date & Time of Incident <span className="required">*</span></label>
              <input
                type="datetime-local"
                name="occurred_at"
                value={form.occurred_at}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-field full">
              <label>Location <span className="required">*</span></label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Where did this occur?"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Incident Details</div>
          <div className="form-grid">
            <div className="form-field full">
              <label>Description <span className="required">*</span></label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe what happened in detail..."
                rows={5}
                required
              />
            </div>
            <div className="form-field full">
              <label>Immediate Actions Taken</label>
              <textarea
                name="immediate_action"
                value={form.immediate_action}
                onChange={handleChange}
                placeholder="What immediate actions were taken after the incident?"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">OSHA Classification</div>
          <div className="form-checks">
            <label className="check-label">
              <input
                type="checkbox"
                name="is_osha_recordable"
                checked={form.is_osha_recordable}
                onChange={handleChange}
              />
              <div className="check-content">
                <span className="check-title">OSHA Recordable</span>
                <span className="check-sub">This incident meets OSHA recordability criteria</span>
              </div>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="is_dart"
                checked={form.is_dart}
                onChange={handleChange}
              />
              <div className="check-content">
                <span className="check-title">DART Case</span>
                <span className="check-sub">Days Away, Restricted, or Transferred</span>
              </div>
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <div className="form-reporter">
            Submitting as <strong>{user.email}</strong>
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Submitting...' : 'Submit Incident Report'}
          </button>
        </div>
      </form>
    </div>
  );
}