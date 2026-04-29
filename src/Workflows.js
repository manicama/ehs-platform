import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const COLORS = [
  '#378add', '#ef9f27', '#1d9e75', '#e24b4a',
  '#8a94a6', '#7f77dd', '#d85a30', '#0f6e56'
];

export default function Workflows({ user }) {
  const [workflows, setWorkflows] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState(null);
  const [showNewStage, setShowNewStage] = useState(false);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
  const [newStage, setNewStage] = useState({ name: '', description: '', color: '#378add' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    setLoading(true);
    const { data: wData } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at');

    const { data: sData } = await supabase
      .from('workflow_stages')
      .select('*')
      .order('order_index');

    if (wData) {
      setWorkflows(wData);
      if (wData.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(wData[0]);
      }
    }
    if (sData) setStages(sData);
    setLoading(false);
  }

  const workflowStages = stages.filter(s =>
    s.workflow_id === selectedWorkflow?.id
  );

  async function createWorkflow() {
    if (!newWorkflowName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: newWorkflowName,
        description: newWorkflowDesc,
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
      setShowNewWorkflow(false);
    }
    setSaving(false);
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
        color: newStage.color
      })
      .select()
      .single();

    if (!error && data) {
      setStages(prev => [...prev, data]);
      setNewStage({ name: '', description: '', color: '#378add' });
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
    const { error } = await supabase
      .from('workflow_stages')
      .delete()
      .eq('id', id);

    if (!error) {
      setStages(prev => prev.filter(s => s.id !== id));
    }
  }

  async function setDefault(workflowId) {
    await supabase.from('workflows').update({ is_default: false }).neq('id', workflowId);
    await supabase.from('workflows').update({ is_default: true }).eq('id', workflowId);
    setWorkflows(prev => prev.map(w => ({ ...w, is_default: w.id === workflowId })));
  }

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="workflows-page">
      <div className="workflows-header">
        <div>
          <h2>Workflows</h2>
          <p>Define custom stages for incident management</p>
        </div>
        <button onClick={() => setShowNewWorkflow(true)}>+ New Workflow</button>
      </div>

      {showNewWorkflow && (
        <div className="new-workflow-form">
          <div className="form-section-title">Create New Workflow</div>
          <div className="config-row" style={{marginTop: '12px'}}>
            <div className="control-group">
              <label>Workflow Name</label>
              <input
                value={newWorkflowName}
                onChange={e => setNewWorkflowName(e.target.value)}
                placeholder="e.g. Standard Incident Workflow"
                style={{width: '260px'}}
              />
            </div>
            <div className="control-group">
              <label>Description</label>
              <input
                value={newWorkflowDesc}
                onChange={e => setNewWorkflowDesc(e.target.value)}
                placeholder="Optional description"
                style={{width: '260px'}}
              />
            </div>
            <div style={{display:'flex', gap:'8px', alignSelf:'flex-end'}}>
              <button onClick={createWorkflow} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewWorkflow(false)}>
                Cancel
              </button>
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
              <div className="workflow-item-name">{w.name}</div>
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
              <div>
                <h3>{selectedWorkflow.name}</h3>
                {selectedWorkflow.description && (
                  <p className="workflow-detail-desc">{selectedWorkflow.description}</p>
                )}
              </div>
              <div style={{display:'flex', gap:'8px'}}>
                {!selectedWorkflow.is_default && (
                  <button className="btn-secondary" onClick={() => setDefault(selectedWorkflow.id)}>
                    Set as Default
                  </button>
                )}
                {selectedWorkflow.is_default && (
                  <span className="default-badge-large">✓ Default Workflow</span>
                )}
              </div>
            </div>

            <div className="stages-list">
              {workflowStages.map((stage, index) => (
                <div key={stage.id} className="stage-row">
                  {editingStage === stage.id ? (
                    <div className="stage-edit-form">
                      <div className="stage-edit-fields">
                        <input
                          defaultValue={stage.name}
                          placeholder="Stage name"
                          id={`name-${stage.id}`}
                        />
                        <input
                          defaultValue={stage.description}
                          placeholder="Description"
                          id={`desc-${stage.id}`}
                        />
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
                      <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                        <button onClick={() => updateStage(stage.id, {
                          name: document.getElementById(`name-${stage.id}`).value,
                          description: document.getElementById(`desc-${stage.id}`).value,
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
                        {stage.description && (
                          <div className="stage-desc">{stage.description}</div>
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
                    <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                      <button onClick={addStage} disabled={saving}>
                        {saving ? 'Adding...' : 'Add Stage'}
                      </button>
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