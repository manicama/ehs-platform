import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const COLORS = [
  '#378add', '#ef9f27', '#1d9e75', '#e24b4a',
  '#8a94a6', '#7f77dd', '#d85a30', '#0f6e56'
];

const ICONS = ['📋', '⚠️', '🔧', '🏥', '🌿', '🔒', '⚡', '🔍'];

export default function Workflows({ user }) {
  const [workflows, setWorkflows] = useState([]);
  const [stages, setStages] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState(null);
  const [showNewStage, setShowNewStage] = useState(false);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
  const [newWorkflowIcon, setNewWorkflowIcon] = useState('📋');
  const [newStage, setNewStage] = useState({ name: '', description: '', color: '#378add', form_id: '' });
  const [saving, setSaving] = useState(false);
  const [editingWorkflowMeta, setEditingWorkflowMeta] = useState(false);
  const [workflowMetaSaving, setWorkflowMetaSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [wRes, sRes, fRes] = await Promise.all([
      supabase.from('workflows').select('*').order('created_at'),
      supabase.from('workflow_stages').select('*').order('order_index'),
      supabase.from('forms').select('*').order('name'),
    ]);
    if (wRes.data) {
      setWorkflows(wRes.data);
      if (wRes.data.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(wRes.data[0]);
      }
    }
    if (sRes.data) setStages(sRes.data);
    if (fRes.data) setForms(fRes.data);
    setLoading(false);
  }

  const workflowStages = stages.filter(s => s.workflow_id === selectedWorkflow?.id);

  async function createWorkflow() {
    if (!newWorkflowName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: newWorkflowName,
        description: newWorkflowDesc,
        icon: newWorkflowIcon,
        is_default: workflows.length === 0,
        created_by: user.email
      })
      .select()
      .single();
    if (!error && data) {
      setWorkflows(prev => [...prev, data]);
      setSelectedWorkflow(data);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
      setNewWorkflowIcon('📋');
      setShowNewWorkflow(false);
    }
    setSaving(false);
  }

  async function saveWorkflowMeta() {
    if (!selectedWorkflow) return;
    setWorkflowMetaSaving(true);
    const { error } = await supabase
      .from('workflows')
      .update({
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        icon: selectedWorkflow.icon,
        submission_form_id: selectedWorkflow.submission_form_id || null,
      })
      .eq('id', selectedWorkflow.id);

    if (!error) {
      setWorkflows(prev => prev.map(w =>
        w.id === selectedWorkflow.id ? selectedWorkflow : w
      ));
      setEditingWorkflowMeta(false);
    }
    setWorkflowMetaSaving(false);
  }

  async function addStage() {
    if (!newStage.name.trim() || !selectedWorkflow) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('workflow_stages')
      .insert({
        workflow_id: selectedWorkflow.id,
        name: newStage.name,
        description: newStage.description,
        order_index: workflowStages.length + 1,
        color: newStage.color,
        form_id: newStage.form_id || null,
      })
      .select()
      .single();
    if (!error && data) {
      setStages(prev => [...prev, data]);
      setNewStage({ name: '', description: '', color: '#378add', form_id: '' });
      setShowNewStage(false);
    }
    setSaving(false);
  }

  async function updateStage(id, updates) {
    const { error } = await supabase
      .from('workflow_stages')
      .update(updates)
      .eq('id', id);
    if (!error) {
      setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      setEditingStage(null);
    }
  }

  async function deleteStage(id) {
    const { error } = await supabase.from('workflow_stages').delete().eq('id', id);
    if (!error) setStages(prev => prev.filter(s => s.id !== id));
  }

  async function setDefault(workflowId) {
    await supabase.from('workflows').update({ is_default: false }).neq('id', workflowId);
    await supabase.from('workflows').update({ is_default: true }).eq('id', workflowId);
    setWorkflows(prev => prev.map(w => ({ ...w, is_default: w.id === workflowId })));
  }

  function getFormName(formId) {
    return forms.find(f => f.id === formId)?.name || null;
  }

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="workflows-page">
      <div className="workflows-header">
        <div>
          <h2>Workflows</h2>
          <p>Define custom stages and submission forms</p>
        </div>
        <button onClick={() => setShowNewWorkflow(true)}>+ New Workflow</button>
      </div>

      {showNewWorkflow && (
        <div className="new-workflow-form">
          <div className="form-section-title">Create New Workflow</div>
          <div className="config-row" style={{marginTop: '12px', flexWrap: 'wrap'}}>
            <div className="control-group">
              <label>Icon</label>
              <div className="icon-picker">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    className={`icon-btn ${newWorkflowIcon === icon ? 'selected' : ''}`}
                    onClick={() => setNewWorkflowIcon(icon)}
                    type="button"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <label>Workflow Name</label>
              <input
                value={newWorkflowName}
                onChange={e => setNewWorkflowName(e.target.value)}
                placeholder="e.g. Incident Report"
                style={{width: '220px'}}
              />
            </div>
            <div className="control-group">
              <label>Description</label>
              <input
                value={newWorkflowDesc}
                onChange={e => setNewWorkflowDesc(e.target.value)}
                placeholder="Optional description"
                style={{width: '220px'}}
              />
            </div>
            <div style={{display:'flex', gap:'8px', alignSelf:'flex-end'}}>
              <button onClick={createWorkflow} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
              <button className="btn-secondary" onClick={() => setShowNewWorkflow(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="workflows-layout">
        <div className="workflow-list">
          <div className="workflow-list-title">Your Workflows</div>
          {workflows.map(w => (
            <div
              key={w.id}
              className={`workflow-item ${selectedWorkflow?.id === w.id ? 'active' : ''}`}
              onClick={() => setSelectedWorkflow(w)}
            >
              <div className="workflow-item-name">
                <span style={{marginRight: '6px'}}>{w.icon || '📋'}</span>
                {w.name}
              </div>
              <div className="workflow-item-meta">
                {stages.filter(s => s.workflow_id === w.id).length} stages
                {w.is_default && <span className="default-badge">Default</span>}
              </div>
            </div>
          ))}
        </div>

        {selectedWorkflow && (
          <div className="workflow-detail">
            <div className="workflow-detail-header">
              <div style={{flex: 1}}>
                {editingWorkflowMeta ? (
                  <div className="workflow-meta-edit">
                    <div className="workflow-meta-edit-row">
                      <div className="control-group">
                        <label>Icon</label>
                        <div className="icon-picker">
                          {ICONS.map(icon => (
                            <button
                              key={icon}
                              className={`icon-btn ${selectedWorkflow.icon === icon ? 'selected' : ''}`}
                              onClick={() => setSelectedWorkflow(prev => ({...prev, icon}))}
                              type="button"
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="workflow-meta-edit-row">
                      <div className="control-group">
                        <label>Name</label>
                        <input
                          value={selectedWorkflow.name}
                          onChange={e => setSelectedWorkflow(prev => ({...prev, name: e.target.value}))}
                          style={{width: '200px'}}
                        />
                      </div>
                      <div className="control-group">
                        <label>Description</label>
                        <input
                          value={selectedWorkflow.description || ''}
                          onChange={e => setSelectedWorkflow(prev => ({...prev, description: e.target.value}))}
                          placeholder="Optional"
                          style={{width: '200px'}}
                        />
                      </div>
                    </div>
                    <div className="control-group" style={{marginTop: '12px'}}>
                      <label>Submission Form (shown when user selects this workflow)</label>
                      <select
                        value={selectedWorkflow.submission_form_id || ''}
                        onChange={e => setSelectedWorkflow(prev => ({...prev, submission_form_id: e.target.value || null}))}
                        style={{width: '300px'}}
                      >
                        <option value="">No submission form (use default fields)</option>
                        {forms.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                      <button onClick={saveWorkflowMeta} disabled={workflowMetaSaving}>
                        {workflowMetaSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-secondary" onClick={() => setEditingWorkflowMeta(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>
                      <span style={{marginRight: '8px'}}>{selectedWorkflow.icon || '📋'}</span>
                      {selectedWorkflow.name}
                    </h3>
                    {selectedWorkflow.description && (
                      <p className="workflow-detail-desc">{selectedWorkflow.description}</p>
                    )}
                    {selectedWorkflow.submission_form_id && (
                      <p className="workflow-submission-form-tag">
                        📝 Submission form: {getFormName(selectedWorkflow.submission_form_id)}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div style={{display:'flex', gap:'8px', flexShrink: 0}}>
                {!editingWorkflowMeta && (
                  <button className="btn-secondary" onClick={() => setEditingWorkflowMeta(true)}>
                    ✏️ Edit
                  </button>
                )}
                {!selectedWorkflow.is_default && !editingWorkflowMeta && (
                  <button className="btn-secondary" onClick={() => setDefault(selectedWorkflow.id)}>
                    Set as Default
                  </button>
                )}
                {selectedWorkflow.is_default && !editingWorkflowMeta && (
                  <span className="default-badge-large">✓ Default</span>
                )}
              </div>
            </div>

            <div className="stages-list">
              {workflowStages.map((stage, index) => (
                <div key={stage.id} className="stage-row">
                  {editingStage === stage.id ? (
                    <div className="stage-edit-form">
                      <div className="stage-edit-fields">
                        <input defaultValue={stage.name} placeholder="Stage name" id={`name-${stage.id}`} />
                        <input defaultValue={stage.description} placeholder="Description" id={`desc-${stage.id}`} />
                        <div className="color-picker">
                          {COLORS.map(c => (
                            <div
                              key={c}
                              className={`color-dot ${stage.color === c ? 'selected' : ''}`}
                              style={{background: c}}
                              onClick={() => updateStage(stage.id, { color: c })}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="stage-form-selector">
                        <label>Attach Form (optional)</label>
                        <select defaultValue={stage.form_id || ''} id={`form-${stage.id}`}>
                          <option value="">No form attached</option>
                          {forms.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                        <button onClick={() => updateStage(stage.id, {
                          name: document.getElementById(`name-${stage.id}`).value,
                          description: document.getElementById(`desc-${stage.id}`).value,
                          form_id: document.getElementById(`form-${stage.id}`).value || null,
                        })}>Save</button>
                        <button className="btn-secondary" onClick={() => setEditingStage(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="stage-number">{index + 1}</div>
                      <div className="stage-color-dot" style={{background: stage.color}}></div>
                      <div className="stage-info">
                        <div className="stage-name">{stage.name}</div>
                        {stage.description && <div className="stage-desc">{stage.description}</div>}
                        {stage.form_id && (
                          <div className="stage-form-tag">📋 {getFormName(stage.form_id)}</div>
                        )}
                      </div>
                      <div className="stage-actions">
                        <button className="btn-icon" onClick={() => setEditingStage(stage.id)}>✏️</button>
                        <button className="btn-icon btn-danger" onClick={() => deleteStage(stage.id)}>🗑</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {showNewStage ? (
                <div className="stage-row new-stage-form">
                  <div className="stage-edit-form" style={{width:'100%'}}>
                    <div className="stage-edit-fields">
                      <input
                        value={newStage.name}
                        onChange={e => setNewStage(prev => ({...prev, name: e.target.value}))}
                        placeholder="Stage name"
                      />
                      <input
                        value={newStage.description}
                        onChange={e => setNewStage(prev => ({...prev, description: e.target.value}))}
                        placeholder="Description (optional)"
                      />
                      <div className="color-picker">
                        {COLORS.map(c => (
                          <div
                            key={c}
                            className={`color-dot ${newStage.color === c ? 'selected' : ''}`}
                            style={{background: c}}
                            onClick={() => setNewStage(prev => ({...prev, color: c}))}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="stage-form-selector">
                      <label>Attach Form (optional)</label>
                      <select
                        value={newStage.form_id}
                        onChange={e => setNewStage(prev => ({...prev, form_id: e.target.value}))}
                      >
                        <option value="">No form attached</option>
                        {forms.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                      <button onClick={addStage} disabled={saving}>{saving ? 'Adding...' : 'Add Stage'}</button>
                      <button className="btn-secondary" onClick={() => setShowNewStage(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button className="add-stage-btn" onClick={() => setShowNewStage(true)}>
                  + Add Stage
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}