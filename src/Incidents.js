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

function AssignTask({ incident, user, onAssigned }) {
  const [forms, setForms] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [formId, setFormId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.from('forms').select('*').order('name').then(({ data }) => {
      if (data) setForms(data);
    });
  }, []);

  async function assignTask() {
    if (!assignTo.trim() || !formId) return;
    setSaving(true);
    const { error } = await supabase.from('tasks').insert({
      incident_id: incident.id,
      form_id: formId,
      assigned_to: assignTo.trim(),
      assigned_by: user.email,
      stage_id: incident.current_stage_id,
      due_date: dueDate || null,
      note: note || null,
      status: 'pending',
    });

    if (!error) {
      await supabase.from('incident_activity').insert({
        incident_id: incident.id,
        user_email: user.email,
        action: `Assigned task to ${assignTo}`,
        note: `Form: ${forms.find(f => f.id === formId)?.name}`,
      });
      setSaved(true);
      setAssignTo('');
      setFormId('');
      setDueDate('');
      setNote('');
      setShowForm(false);
      onAssigned();
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  return (
    <div className="assign-task">
      {saved && <div className="assign-task-saved">✓ Task assigned successfully</div>}
      {!showForm ? (
        <button className="assign-task-btn" onClick={() => setShowForm(true)}>
          + Assign Task
        </button>
      ) : (
        <div className="assign-task-form">
          <div className="assign-task-fields">
            <div className="stage-form-field">
              <label className="stage-form-field-label">Assign To (email)</label>
              <input
                type="email"
                value={assignTo}
                onChange={e => setAssignTo(e.target.value)}
                placeholder="user@company.com"
                className="task-field-input"
              />
            </div>
            <div className="stage-form-field">
              <label className="stage-form-field-label">Form to Complete</label>
              <select
                value={formId}
                onChange={e => setFormId(e.target.value)}
                className="task-field-input"
              >
                <option value="">Select a form...</option>
                {forms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="assign-task-row">
              <div className="stage-form-field">
                <label className="stage-form-field-label">Due Date (optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="task-field-input"
                />
              </div>
              <div className="stage-form-field">
                <label className="stage-form-field-label">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Instructions for assignee"
                  className="task-field-input"
                />
              </div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '8px', marginTop: '12px'}}>
            <button onClick={assignTask} disabled={saving || !assignTo || !formId}>
              {saving ? 'Assigning...' : 'Assign Task'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StageConfirmModal({ isOpen, onConfirm, onCancel, currentStage, targetStage, isBackward }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">
          {isBackward ? '⚠️' : '→'}
        </div>
        <h3 className="modal-title">
          {isBackward ? 'Move Stage Backwards?' : 'Move to Next Stage?'}
        </h3>
        <p className="modal-body">
          {isBackward
            ? `You are about to move this incident backwards from `
            : `You are about to move this incident from `}
          <strong>{currentStage}</strong> to <strong>{targetStage}</strong>.
          {isBackward && (
            <span className="modal-warning">
              Moving backwards will reopen the incident at an earlier stage. This action will be logged.
            </span>
          )}
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className={isBackward ? 'modal-btn-warning' : 'modal-btn-confirm'}
            onClick={onConfirm}
          >
            {isBackward ? 'Move Backwards' : 'Confirm Move'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Incidents({ user }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [workflowStages, setWorkflowStages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState(null);

  useEffect(() => {
    fetchIncidents();
    fetchWorkflowStages();
  }, []);

  useEffect(() => {
    if (selected) fetchActivity(selected.id);
  }, [selected]);

  async function fetchIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select(`*, workflow_stages (id, name, color, order_index)`)
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

  function requestStageChange(stage) {
    if (selected.current_stage_id === stage.id) return;
    setPendingStage(stage);
    setModalOpen(true);
  }

  async function confirmStageChange() {
    if (!pendingStage || !selected) return;
    const currentStage = getStageName(selected);

    const { error } = await supabase
      .from('incidents')
      .update({
        current_stage_id: pendingStage.id,
        status: pendingStage.name
      })
      .eq('id', selected.id);

    if (!error) {
      await supabase.from('incident_activity').insert({
        incident_id: selected.id,
        user_email: user.email,
        action: `Moved to ${pendingStage.name}`,
        from_stage: currentStage,
        to_stage: pendingStage.name,
      });

      setIncidents(prev => prev.map(i =>
        i.id === selected.id
          ? { ...i, current_stage_id: pendingStage.id, status: pendingStage.name }
          : i
      ));
      setSelected(prev => ({
        ...prev,
        current_stage_id: pendingStage.id,
        status: pendingStage.name
      }));
      fetchActivity(selected.id);
    }

    setModalOpen(false);
    setPendingStage(null);
  }

  function cancelStageChange() {
    setModalOpen(false);
    setPendingStage(null);
  }

  function isBackwardMove(targetStage) {
    const currentStage = workflowStages.find(s => s.id === selected?.current_stage_id);
    if (!currentStage) return false;
    return targetStage.order_index < currentStage.order_index;
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

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  const currentStageIndex = workflowStages.findIndex(s => s.id === selected?.current_stage_id);

  return (
    <div className="incidents-page">
      <StageConfirmModal
        isOpen={modalOpen}
        onConfirm={confirmStageChange}
        onCancel={cancelStageChange}
        currentStage={getStageName(selected)}
        targetStage={pendingStage?.name}
        isBackward={pendingStage ? isBackwardMove(pendingStage) : false}
      />

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

              <div className="detail-section">
                <div className="detail-section-title">Assign Task</div>
                <AssignTask
                  incident={selected}
                  user={user}
                  onAssigned={() => fetchActivity(selected.id)}
                />
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Workflow Stage</div>
                <div className="stage-progress">
                  {workflowStages.map((stage, index) => {
                    const isCurrent = selected.current_stage_id === stage.id;
                    const isPast = index < currentStageIndex;
                    const isFuture = index > currentStageIndex;
                    return (
                      <div key={stage.id} className="stage-progress-item">
                        <button
                          className={`stage-progress-btn ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
                          style={isCurrent ? { background: stage.color + '20', color: stage.color, borderColor: stage.color } : {}}
                          onClick={() => requestStageChange(stage)}
                          disabled={isCurrent}
                        >
                          {isPast && <span className="stage-check">✓</span>}
                          {stage.name}
                        </button>
                        {index < workflowStages.length - 1 && (
                          <span className="stage-progress-arrow">→</span>
                        )}
                      </div>
                    );
                  })}
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