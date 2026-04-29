import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const DEFAULT_FIELDS = [
  { id: 'title', label: 'Incident Title', type: 'text', required: true, placeholder: 'Brief title describing what happened' },
  { id: 'occurred_at', label: 'Date & Time', type: 'datetime-local', required: true },
  { id: 'location', label: 'Location', type: 'text', required: true, placeholder: 'Where did this occur?' },
  { id: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Describe what happened in detail...' },
  { id: 'immediate_action', label: 'Immediate Actions Taken', type: 'textarea', required: false, placeholder: 'What immediate actions were taken?' },
];

export default function Submit({ user, preselectedWorkflowId }) {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [submissionForm, setSubmissionForm] = useState(null);
  const [submissionFields, setSubmissionFields] = useState([]);
  const [firstStage, setFirstStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formValues, setFormValues] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (preselectedWorkflowId && workflows.length > 0) {
      const wf = workflows.find(w => w.id === preselectedWorkflowId);
      if (wf) selectWorkflow(wf);
    }
  }, [preselectedWorkflowId, workflows]);

  async function fetchWorkflows() {
    setLoading(true);
    const { data } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at');
    if (data) setWorkflows(data);
    setLoading(false);
  }

  async function selectWorkflow(workflow) {
    setSelectedWorkflow(workflow);
    setSubmissionForm(null);
    setSubmissionFields([]);
    setFormValues({});
    setCustomFieldValues({});

    const { data: stages } = await supabase
      .from('workflow_stages')
      .select('*')
      .eq('workflow_id', workflow.id)
      .order('order_index')
      .limit(1)
      .single();
    if (stages) setFirstStage(stages);

    if (workflow.submission_form_id) {
      const { data: form } = await supabase
        .from('forms')
        .select('*')
        .eq('id', workflow.submission_form_id)
        .single();
      const { data: fields } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', workflow.submission_form_id)
        .order('order_index');
      if (form) setSubmissionForm(form);
      if (fields) setSubmissionFields(fields);
    }
  }

  function handleDefaultField(e) {
    const { name, value, type, checked } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { data: incident, error: incError } = await supabase
      .from('incidents')
      .insert({
        title: formValues.title || '',
        description: formValues.description || '',
        incident_type: selectedWorkflow.name,
        occurred_at: formValues.occurred_at || new Date().toISOString(),
        location: formValues.location || '',
        immediate_action: formValues.immediate_action || '',
        reported_by: user.email,
        status: firstStage?.name || 'New',
        workflow_id: selectedWorkflow.id,
        current_stage_id: firstStage?.id || null,
        is_osha_recordable: formValues.is_osha_recordable || false,
        is_dart: formValues.is_dart || false,
      })
      .select()
      .single();

    if (incError) {
      setError(incError.message);
      setSubmitting(false);
      return;
    }

    if (submissionForm && submissionFields.length > 0 && incident) {
      const { data: response } = await supabase
        .from('form_responses')
        .insert({
          incident_id: incident.id,
          form_id: submissionForm.id,
          submitted_by: user.email,
          stage_id: firstStage?.id || null,
        })
        .select()
        .single();

      if (response) {
        await supabase.from('form_field_responses').insert(
          submissionFields.map(f => ({
            response_id: response.id,
            field_id: f.id,
            value: customFieldValues[f.id] || '',
          }))
        );
      }
    }

    setSuccess(true);
    setSubmitting(false);
  }

  function renderCustomField(field) {
    const value = customFieldValues[field.id] || '';
    const props = {
      value,
      onChange: e => setCustomFieldValues(p => ({...p, [field.id]: e.target.value})),
      placeholder: field.placeholder || '',
      className: 'form-field-input',
    };

    switch (field.field_type) {
      case 'textarea':
        return <textarea {...props} rows={3} />;
      case 'dropdown':
        return (
          <select {...props}>
            <option value="">Select...</option>
            {(field.options || '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      case 'yes_no':
        return (
          <div className="yes-no-field">
            {['Yes', 'No'].map(opt => (
              <button
                key={opt}
                type="button"
                className={`yes-no-btn ${value === opt ? 'active' : ''}`}
                onClick={() => setCustomFieldValues(p => ({...p, [field.id]: opt}))}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'date':
        return <input {...props} type="date" />;
      case 'number':
        return <input {...props} type="number" />;
      default:
        return <input {...props} type="text" />;
    }
  }

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  if (success) {
    return (
      <div className="submit-success">
        <div className="success-icon">✓</div>
        <h2>Submitted Successfully</h2>
        <p>
          Your <strong>{selectedWorkflow?.name}</strong> has been submitted and is now in the{' '}
          <strong>{firstStage?.name || 'New'}</strong> stage.
        </p>
        <button onClick={() => {
          setSuccess(false);
          setSelectedWorkflow(null);
          setFormValues({});
          setCustomFieldValues({});
        }}>
          Submit Another
        </button>
      </div>
    );
  }

  if (!selectedWorkflow) {
    return (
      <div className="submit-page">
        <div className="page-header">
          <h2>New Submission</h2>
          <p>Select the type of report you want to submit</p>
        </div>
        <div className="workflow-cards">
          {workflows.map(workflow => {
            const stageCount = 0;
            return (
              <div
                key={workflow.id}
                className="workflow-card"
                onClick={() => selectWorkflow(workflow)}
              >
                <div className="workflow-card-icon">{workflow.icon || '📋'}</div>
                <div className="workflow-card-name">{workflow.name}</div>
                {workflow.description && (
                  <div className="workflow-card-desc">{workflow.description}</div>
                )}
                {workflow.is_default && (
                  <span className="workflow-card-badge">Default</span>
                )}
                <button className="workflow-card-btn">Select →</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="page-header">
        <button
          className="back-btn"
          onClick={() => { setSelectedWorkflow(null); setFormValues({}); setCustomFieldValues({}); }}
        >
          ← Back
        </button>
        <div>
          <h2>
            {selectedWorkflow.icon || '📋'} {selectedWorkflow.name}
          </h2>
          <p>
            {selectedWorkflow.description || 'Complete the form below to submit'}
            {firstStage && <span> · Will start at <strong>{firstStage.name}</strong></span>}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="incident-form">
        <div className="form-section">
          <div className="form-section-title">Basic Information</div>
          <div className="form-grid">
            <div className="form-field full">
              <label>Title <span className="required">*</span></label>
              <input
                name="title"
                value={formValues.title || ''}
                onChange={handleDefaultField}
                placeholder="Brief title describing what happened"
                required
              />
            </div>
            <div className="form-field">
              <label>Date & Time <span className="required">*</span></label>
              <input
                type="datetime-local"
                name="occurred_at"
                value={formValues.occurred_at || ''}
                onChange={handleDefaultField}
                required
              />
            </div>
            <div className="form-field">
              <label>Location <span className="required">*</span></label>
              <input
                name="location"
                value={formValues.location || ''}
                onChange={handleDefaultField}
                placeholder="Where did this occur?"
                required
              />
            </div>
            <div className="form-field full">
              <label>Description <span className="required">*</span></label>
              <textarea
                name="description"
                value={formValues.description || ''}
                onChange={handleDefaultField}
                placeholder="Describe what happened in detail..."
                rows={4}
                required
              />
            </div>
            <div className="form-field full">
              <label>Immediate Actions Taken</label>
              <textarea
                name="immediate_action"
                value={formValues.immediate_action || ''}
                onChange={handleDefaultField}
                placeholder="What immediate actions were taken?"
                rows={3}
              />
            </div>
          </div>
        </div>

        {submissionForm && submissionFields.length > 0 && (
          <div className="form-section">
            <div className="form-section-title">{submissionForm.name}</div>
            <div className="form-grid">
              {submissionFields.map(field => (
                <div key={field.id} className={`form-field ${field.field_type === 'textarea' ? 'full' : ''}`}>
                  <label>
                    {field.label}
                    {field.required && <span className="required"> *</span>}
                  </label>
                  {renderCustomField(field)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-section">
          <div className="form-section-title">OSHA Classification</div>
          <div className="form-checks">
            <label className="check-label">
              <input
                type="checkbox"
                name="is_osha_recordable"
                checked={formValues.is_osha_recordable || false}
                onChange={handleDefaultField}
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
                checked={formValues.is_dart || false}
                onChange={handleDefaultField}
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
          <button type="submit" disabled={submitting} className="submit-btn">
            {submitting ? 'Submitting...' : `Submit ${selectedWorkflow.name}`}
          </button>
        </div>
      </form>
    </div>
  );
}