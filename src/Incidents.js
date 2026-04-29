import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const TYPE_COLORS = {
  'Injury': { bg: 'rgba(226,75,74,0.1)', color: '#e24b4a' },
  'Near Miss': { bg: 'rgba(239,159,39,0.1)', color: '#ef9f27' },
  'Property Damage': { bg: 'rgba(55,138,221,0.1)', color: '#378add' },
  'Environmental': { bg: 'rgba(29,158,117,0.1)', color: '#1d9e75' },
  'Security': { bg: 'rgba(138,148,166,0.1)', color: '#8a94a6' },
  'Other': { bg: 'rgba(138,148,166,0.1)', color: '#8a94a6' },
};

export default function Incidents({ user }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [workflowStages, setWorkflowStages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [stageForm, setStageForm] = useState(null);
  const [stageFormFields, setStageFormFields] = useState([]);
  const [formResponses, setFormResponses] = useState({});
  const [existingResponse, setExistingResponse] = useState(null);
  const [existingFieldResponses, setExistingFieldResponses] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    fetchIncidents();
    fetchWorkflowStages();
  }, []);

  useEffect(() => {
    if (selected) {
      fetchActivity(selected.id);
      fetchStageForm(selected.current_stage_id);
    }
  }, [selected]);

  async function fetchIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select(`*, workflow_stages (id, name, color, order_index, form_id)`)
      .order('created_at', { ascending: false });
    if (!error) setIncidents(data);
    setLoading(false);
  }

  async function fetchWorkflowStages() {
    const { data } = await supabase
      .from('workflow_stages')
      .select('*')
      .order('order_index');
    if (data) setWorkflowStages(data);
  }

  async function fetchActivity(incidentId) {
    setActivityLoading(true);
    const { data } = await supabase
      .from('incident_activity')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });
    if (data) setActivity(data);
    setActivityLoading(false);
  }

  async function fetchStageForm(stageId) {
    setStageForm(null);
    setStageFormFields([]);
    setFormResponses({});
    setExistingResponse(null);
    setExistingFieldResponses([]);
    setFormSubmitted(false);

    if (!stageId) return;

    const stage = workflowStages.find(s => s.id === stageId);
    if (!stage?.form_id) return;

    const { data: form } = await supabase
      .from('forms')
      .select('*')
      .eq('id', stage.form_id)
      .single();

    const { data: fields } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', stage.form_id)
      .order('order_index');

    if (form) setStageForm(form);
    if (fields) setStageFormFields(fields);

    if (selected) {
      const { data: response } = await supabase
        .from('form_responses')
        .select('*')
        .eq('incident_id', selected.id)
        .eq('form_id', stage.form_id)
        .single();

      if (response) {
        setExistingResponse(response);
        setFormSubmitted(true);
        const { data: fieldResponses } = await supabase
          .from('form_field_responses')
          .select('*')
          .eq('response_id', response.id);
        if (fieldResponses) setExistingFieldResponses(fieldResponses);
      }
    }
  }

  async function updateStatus(id, stageId, stageName) {
    const currentStage = getStageName(selected);
    const { error } = await supabase
      .from('incidents')
      .update({ current_stage_id: stageId, status: stageName })
      .eq('id', id);

    if (!error) {
      await supabase.from('incident_activity').insert({
        incident_id: id,
        user_email: user.email,
        action: `Moved to ${stageName}`,
        from_stage: currentStage,
        to_stage: stageName,
      });

      setIncidents(prev => prev.map(i =>
        i.id === id ? { ...i, current_stage_id: stageId, status: stageName } : i
      ));

      if (selected?.id === id) {
        const updatedSelected = { ...selected, current_stage_id: stageId, status: stageName };
        setSelected(updatedSelected);
        fetchActivity(id);
        fetchStageForm(stageId);
      }
    }
  }

  async function submitForm() {
    if (!selected || !stageForm) return;
    const required = stageFormFields.filter(f => f.required);
    const missing = required.filter(f => !formResponses[f.id]?.trim());
    if (missing.length > 0) {
      alert(`Please fill in required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setFormSubmitting(true);

    const { data: response, error } = await supabase
      .from('form_responses')
      .insert({
        incident_id: selected.id,
        form_id: stageForm.id,
        submitted_by: user.email,
        stage_id: selected.current_stage_id,
      })
      .select()
      .single();

    if (!error && response) {
      const fieldResponses = stageFormFields.map(f => ({
        response_id: response.id,
        field_id: f.id,
        value: formResponses[f.id] || '',
      }));

      await supabase.from('form_field_responses').insert(fieldResponses);

      await supabase.from('incident_activity').insert({
        incident_id: selected.id,
        user_email: user.email,
        action: `Submitted form: ${stageForm.name}`,
        note: `Form completed at ${stageForm.name} stage`,
      });

      setExistingResponse(response);
      setExistingFieldResponses(fieldResponses);
      setFormSubmitted(true);
      fetchActivity(selected.id);
    }
    setFormSubmitting(false);
  }

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter(i => i.incident_type === filter);

  const types = [...new Set(incidents.map(i => i.incident_type).filter(Boolean))];

  function getStageStyle(incident) {
    const stage = workflowStages.find(s => s.id === incident.current_stage_id);
    if (stage) return { bg: stage.color + '20', color: stage.color };
    return { bg: 'rgba(55,138,221,0.1)', color: '#378add' };
  }

  function getStageName(incident) {
    const stage = workflowStages.find(s => s.id === incident?.current_stage_id);
    return stage?.name || incident?.status || 'New';
  }

  function renderFormField(field) {
    const value = formResponses[field.id] || '';
    const existingValue = existingFieldResponses.find(r => r.field_id === field.id)?.value || '';
    const displayValue = formSubmitted ? existingValue : value;

    const commonProps = {
      disabled: formSubmitted,
      className: formSubmitted ? 'form-field-input-disabled' : '',
    };

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={displayValue}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
            rows={3}
          />
        );
      case 'dropdown':
        return (
          <select
            {...commonProps}
            value={displayValue}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
          >
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
                className={`yes-no-btn ${displayValue === opt ? 'active' : ''}`}
                onClick={() => !formSubmitted && setFormResponses(p => ({...p, [field.id]: opt}))}
                disabled={formSubmitted}
                type="button"
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
            value={displayValue}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
          />
        );
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            value={displayValue}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
          />
        );
      default:
        return (
          <input
            {...commonProps}
            type="text"
            value={displayValue}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
          />
        );
    }
  }

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="incidents-page">
      <div className="incidents-header">
        <div>
          <h2>Incidents</h2>
          <p>{incidents.length} total incident{incidents.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="refresh-btn" onClick={fetchIncidents}>↻ Refresh</button>
      </div>

      <div className="incidents-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All ({incidents.length})
        </button>
        {types.map(t => (
          <button key={t} className={`filter-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t} ({incidents.filter(i => i.incident_type === t).length})
          </button>
        ))}
      </div>

      <div className="incidents-layout">
        <div className="incidents-list">
          {filtered.length === 0 ? (
            <div className="incidents-empty"><p>No incidents found</p></div>
          ) : (
            filtered.map(incident => (
              <div
                key={incident.id}
                className={`incident-card ${selected?.id === incident.id ? 'active' : ''}`}
                onClick={() => setSelected(incident)}
              >
                <div className="incident-card-header">
                  <span className="incident-type-badge" style={TYPE_COLORS[incident.incident_type] || TYPE_COLORS['Other']}>
                    {incident.incident_type}
                  </span>
                  <span className="incident-status-badge" style={getStageStyle(incident)}>
                    {getStageName(incident)}
                  </span>
                </div>
                <div className="incident-card-title">{incident.title}</div>
                <div className="incident-card-meta">
                  <span>📍 {incident.location}</span>
                  <span>🕐 {new Date(incident.occurred_at).toLocaleDateString()}</span>
                </div>
                <div className="incident-card-reporter">Reported by {incident.reported_by}</div>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div className="incident-detail">
            <div className="detail-header">
              <div className="detail-title-row">
                <h3>{selected.title}</h3>
                <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="detail-badges">
                <span className="incident-type-badge" style={TYPE_COLORS[selected.incident_type] || TYPE_COLORS['Other']}>
                  {selected.incident_type}
                </span>
                <span className="incident-status-badge" style={getStageStyle(selected)}>
                  {getStageName(selected)}
                </span>
                {selected.is_osha_recordable && <span className="osha-badge">OSHA Recordable</span>}
                {selected.is_dart && <span className="dart-badge">DART</span>}
              </div>
            </div>

            <div className="detail-body">
              <div className="detail-section">
                <div className="detail-section-title">Incident Information</div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Date & Time</span>
                    <span className="detail-value">{new Date(selected.occurred_at).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{selected.location}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reported By</span>
                    <span className="detail-value">{selected.reported_by}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Submitted</span>
                    <span className="detail-value">{new Date(selected.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Description</div>
                <p className="detail-text">{selected.description}</p>
              </div>

              {selected.immediate_action && (
                <div className="detail-section">
                  <div className="detail-section-title">Immediate Actions Taken</div>
                  <p className="detail-text">{selected.immediate_action}</p>
                </div>
              )}

              {stageForm && (
                <div className="detail-section">
                  <div className="stage-form-header">
                    <div className="stage-form-title">
                      <span>📋</span>
                      {stageForm.name}
                      {formSubmitted && <span className="form-completed-badge">✓ Completed</span>}
                    </div>
                    {stageForm.description && (
                      <div className="stage-form-desc">{stageForm.description}</div>
                    )}
                  </div>

                  <div className="stage-form-fields">
                    {stageFormFields.map(field => (
                      <div key={field.id} className="stage-form-field">
                        <label className="stage-form-field-label">
                          {field.label}
                          {field.required && !formSubmitted && <span className="required"> *</span>}
                        </label>
                        {renderFormField(field)}
                      </div>
                    ))}
                  </div>

                  {!formSubmitted && (
                    <button
                      className="form-submit-btn"
                      onClick={submitForm}
                      disabled={formSubmitting}
                    >
                      {formSubmitting ? 'Submitting...' : `Submit ${stageForm.name}`}
                    </button>
                  )}
                </div>
              )}

              <div className="detail-section">
                <div className="detail-section-title">Move to Stage</div>
                <div className="status-buttons">
                  {workflowStages.map(stage => (
                    <button
                      key={stage.id}
                      className={`status-btn ${selected.current_stage_id === stage.id ? 'active' : ''}`}
                      style={selected.current_stage_id === stage.id ? {
                        background: stage.color + '20',
                        color: stage.color,
                        borderColor: stage.color
                      } : {}}
                      onClick={() => updateStatus(selected.id, stage.id, stage.name)}
                    >
                      {stage.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Activity Log</div>
                {activityLoading ? (
                  <div className="activity-loading">Loading...</div>
                ) : activity.length === 0 ? (
                  <div className="activity-empty">No activity yet</div>
                ) : (
                  <div className="activity-timeline">
                    {activity.map((item, index) => (
                      <div key={item.id} className="activity-item">
                        <div className="activity-dot"></div>
                        {index < activity.length - 1 && <div className="activity-line"></div>}
                        <div className="activity-content">
                          <div className="activity-action">
                            {item.from_stage && item.to_stage ? (
                              <>
                                <span className="activity-from">{item.from_stage}</span>
                                <span className="activity-arrow">→</span>
                                <span className="activity-to">{item.to_stage}</span>
                              </>
                            ) : (
                              <span>{item.action}</span>
                            )}
                          </div>
                          <div className="activity-meta">
                            {item.user_email} · {new Date(item.created_at).toLocaleString()}
                          </div>
                          {item.note && <div className="activity-note">{item.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}