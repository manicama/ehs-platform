import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Tasks({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [formResponses, setFormResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [forms, setForms] = useState([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) fetchFormFields(selectedTask.form_id);
  }, [selectedTask]);

  async function fetchTasks() {
    setLoading(true);
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.email)
      .order('created_at', { ascending: false });

    if (taskData) {
      setTasks(taskData);
      const incidentIds = [...new Set(taskData.map(t => t.incident_id))];
      const formIds = [...new Set(taskData.map(t => t.form_id).filter(Boolean))];

      if (incidentIds.length > 0) {
        const { data: incData } = await supabase
          .from('incidents')
          .select('*')
          .in('id', incidentIds);
        if (incData) setIncidents(incData);
      }

      if (formIds.length > 0) {
        const { data: formData } = await supabase
          .from('forms')
          .select('*')
          .in('id', formIds);
        if (formData) setForms(formData);
      }
    }
    setLoading(false);
  }

  async function fetchFormFields(formId) {
    if (!formId) return;
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('order_index');
    if (data) setFormFields(data);
  }

  async function submitForm() {
    if (!selectedTask) return;
    const required = formFields.filter(f => f.required);
    const missing = required.filter(f => !formResponses[f.id]?.trim());
    if (missing.length > 0) {
      alert(`Please fill in required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);

    const { data: response, error } = await supabase
      .from('form_responses')
      .insert({
        incident_id: selectedTask.incident_id,
        form_id: selectedTask.form_id,
        submitted_by: user.email,
        stage_id: selectedTask.stage_id,
      })
      .select()
      .single();

    if (!error && response) {
      const fieldResponses = formFields.map(f => ({
        response_id: response.id,
        field_id: f.id,
        value: formResponses[f.id] || '',
      }));

      await supabase.from('form_field_responses').insert(fieldResponses);

      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', selectedTask.id);

      const form = forms.find(f => f.id === selectedTask.form_id);
      await supabase.from('incident_activity').insert({
        incident_id: selectedTask.incident_id,
        user_email: user.email,
        action: `Completed task: ${form?.name || 'Form'}`,
        note: `Task assigned by ${selectedTask.assigned_by} completed`,
      });

      setTasks(prev => prev.map(t =>
        t.id === selectedTask.id ? { ...t, status: 'completed' } : t
      ));
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  function getIncident(incidentId) {
    return incidents.find(i => i.id === incidentId);
  }

  function getForm(formId) {
    return forms.find(f => f.id === formId);
  }

  function renderField(field) {
    const value = formResponses[field.id] || '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
            rows={3}
            className="task-field-input"
          />
        );
      case 'dropdown':
        return (
          <select
            value={value}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            className="task-field-input"
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
                type="button"
                className={`yes-no-btn ${value === opt ? 'active' : ''}`}
                onClick={() => setFormResponses(p => ({...p, [field.id]: opt}))}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            className="task-field-input"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
            className="task-field-input"
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={e => setFormResponses(p => ({...p, [field.id]: e.target.value}))}
            placeholder={field.placeholder || ''}
            className="task-field-input"
          />
        );
    }
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div>
          <h2>My Tasks</h2>
          <p>{pendingTasks.length} pending · {completedTasks.length} completed</p>
        </div>
        <button className="refresh-btn" onClick={fetchTasks}>↻ Refresh</button>
      </div>

      <div className="tasks-layout">
        <div className="tasks-list">
          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <div className="incidents-empty">
              <p>No tasks assigned to you yet</p>
            </div>
          )}

          {pendingTasks.length > 0 && (
            <>
              <div className="tasks-group-title">Pending</div>
              {pendingTasks.map(task => {
                const incident = getIncident(task.incident_id);
                const form = getForm(task.form_id);
                return (
                  <div
                    key={task.id}
                    className={`task-card pending ${selectedTask?.id === task.id ? 'active' : ''}`}
                    onClick={() => { setSelectedTask(task); setSubmitted(false); setFormResponses({}); }}
                  >
                    <div className="task-card-header">
                      <span className="task-status-badge pending">Pending</span>
                      {task.due_date && (
                        <span className="task-due">Due {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="task-card-title">
                      {form?.name || 'Task'}
                    </div>
                    <div className="task-card-incident">
                      📋 {incident?.title || 'Loading...'}
                    </div>
                    <div className="task-card-meta">
                      Assigned by {task.assigned_by}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {completedTasks.length > 0 && (
            <>
              <div className="tasks-group-title" style={{marginTop: '16px'}}>Completed</div>
              {completedTasks.map(task => {
                const incident = getIncident(task.incident_id);
                const form = getForm(task.form_id);
                return (
                  <div key={task.id} className="task-card completed">
                    <div className="task-card-header">
                      <span className="task-status-badge completed">Completed</span>
                      {task.completed_at && (
                        <span className="task-due">
                          {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="task-card-title" style={{opacity: 0.6}}>
                      {form?.name || 'Task'}
                    </div>
                    <div className="task-card-incident" style={{opacity: 0.6}}>
                      📋 {incident?.title || 'Loading...'}
                    </div>
                    <div className="task-card-meta">
                      Assigned by {task.assigned_by}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {selectedTask && (
          <div className="task-detail">
            {submitted ? (
              <div className="task-submitted">
                <div className="success-icon">✓</div>
                <h3>Task Completed!</h3>
                <p>Your form has been submitted successfully.</p>
                <button onClick={() => { setSelectedTask(null); setSubmitted(false); }}>
                  Back to Tasks
                </button>
              </div>
            ) : (
              <>
                <div className="task-detail-header">
                  <div>
                    <h3>{getForm(selectedTask.form_id)?.name || 'Task'}</h3>
                    <p className="task-detail-incident">
                      For incident: <strong>{getIncident(selectedTask.incident_id)?.title}</strong>
                    </p>
                    {selectedTask.note && (
                      <p className="task-detail-note">Note: {selectedTask.note}</p>
                    )}
                  </div>
                </div>

                <div className="task-form-fields">
                  {formFields.map(field => (
                    <div key={field.id} className="stage-form-field">
                      <label className="stage-form-field-label">
                        {field.label}
                        {field.required && <span className="required"> *</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>

                <button
                  className="form-submit-btn"
                  onClick={submitForm}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Form'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}