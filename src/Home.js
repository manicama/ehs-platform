import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

const DEFAULT_WIDGETS = [
  { id: 'my_incidents', enabled: true },
  { id: 'open_investigations', enabled: true },
  { id: 'trir_snapshot', enabled: true },
  { id: 'recent_activity', enabled: true },
  { id: 'quick_links', enabled: true },
  { id: 'near_miss_rate', enabled: false },
];

const WIDGET_META = {
  my_incidents: { title: 'My Incidents', icon: '📋', description: 'Incidents you submitted' },
  open_investigations: { title: 'Open Investigations', icon: '🔍', description: 'Incidents under investigation' },
  trir_snapshot: { title: 'TRIR Snapshot', icon: '📊', description: 'Current TRIR rate' },
  recent_activity: { title: 'Recent Activity', icon: '🕐', description: 'Latest changes' },
  quick_links: { title: 'Quick Links', icon: '🔗', description: 'Common actions' },
  near_miss_rate: { title: 'Near Miss Rate', icon: '⚠️', description: 'Near miss percentage' },
};

export default function Home({ user }) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [showWidgetEditor, setShowWidgetEditor] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [workflowStages, setWorkflowStages] = useState([]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [incRes, actRes, setRes, stageRes] = await Promise.all([
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('incident_activity').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('settings').select('*').eq('user_email', user.email).single(),
      supabase.from('workflow_stages').select('*').order('order_index'),
    ]);
    if (incRes.data) setIncidents(incRes.data);
    if (actRes.data) setActivity(actRes.data);
    if (setRes.data) {
      setSettings(setRes.data);
      setFirstName(setRes.data.first_name || '');
    }
    if (stageRes.data) setWorkflowStages(stageRes.data);
    setLoading(false);
  }

  async function handleAiPrompt(e) {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse('');

    const context = {
      total_incidents: incidents.length,
      my_incidents: incidents.filter(i => i.reported_by === user.email).length,
      open_investigations: incidents.filter(i => {
        const stage = workflowStages.find(s => s.id === i.current_stage_id);
        return stage?.name === 'Investigation';
      }).length,
      incident_types: incidents.reduce((acc, i) => {
        acc[i.incident_type] = (acc[i.incident_type] || 0) + 1;
        return acc;
      }, {}),
      recordable: incidents.filter(i => i.is_osha_recordable).length,
      dart: incidents.filter(i => i.is_dart).length,
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `You are an AI assistant for SafetyIQ, an EHS platform. The user is ${firstName || user.email}.
            
Current data context:
${JSON.stringify(context, null, 2)}

Available navigation: submit (submit incident), incidents (view all incidents), dashboard (reports), workflows (manage workflows), settings (app settings).

User prompt: "${aiPrompt}"

Respond conversationally and helpfully. If they ask to navigate somewhere, start your response with "NAVIGATE:" followed by the path (e.g. "NAVIGATE:/submit"). Keep responses brief and actionable. Do not use markdown.`
          }]
        })
      });

      const data = await response.json();
      const text = data.content[0].text;

      if (text.startsWith('NAVIGATE:')) {
        const path = text.split('\n')[0].replace('NAVIGATE:', '').trim();
        const message = text.split('\n').slice(1).join(' ').trim();
        setAiResponse(message || 'Taking you there...');
        setTimeout(() => navigate(path), 800);
      } else {
        setAiResponse(text);
      }
    } catch (err) {
      setAiResponse('Sorry, I could not process that request.');
    }
    setAiLoading(false);
    setAiPrompt('');
  }

  const myIncidents = incidents.filter(i => i.reported_by === user.email);
  const openInvestigations = incidents.filter(i => {
    const stage = workflowStages.find(s => s.id === i.current_stage_id);
    return stage?.name === 'Investigation';
  });
  const nearMisses = incidents.filter(i => i.incident_type === 'Near Miss');
  const nearMissRate = incidents.length > 0
    ? ((nearMisses.length / incidents.length) * 100).toFixed(1)
    : null;

  const activeHeadcount = settings?.employee_count || 100;
  const monthlyHours = settings?.hours_per_month || 167;
  const totalHours = activeHeadcount * monthlyHours * 12;
  const recordable = incidents.filter(i => i.is_osha_recordable);
  const trir = totalHours > 0
    ? ((recordable.length * 200000) / totalHours).toFixed(2)
    : null;

  function toggleWidget(id) {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  }

  function renderWidget(widgetId) {
    switch (widgetId) {
      case 'my_incidents':
        return (
          <div className="home-widget">
            <div className="widget-header">
              <span className="widget-icon">📋</span>
              <span className="widget-title">My Incidents</span>
            </div>
            <div className="widget-number">{myIncidents.length}</div>
            <div className="widget-sub">submitted by you</div>
            <button className="widget-link" onClick={() => navigate('/incidents')}>
              View all →
            </button>
          </div>
        );

      case 'open_investigations':
        return (
          <div className="home-widget">
            <div className="widget-header">
              <span className="widget-icon">🔍</span>
              <span className="widget-title">Open Investigations</span>
            </div>
            <div className="widget-number" style={{color: openInvestigations.length > 0 ? '#ef9f27' : '#1d9e75'}}>
              {openInvestigations.length}
            </div>
            <div className="widget-sub">in investigation stage</div>
            <button className="widget-link" onClick={() => navigate('/incidents')}>
              View all →
            </button>
          </div>
        );

      case 'trir_snapshot':
        return (
          <div className="home-widget">
            <div className="widget-header">
              <span className="widget-icon">📊</span>
              <span className="widget-title">TRIR</span>
            </div>
            <div className="widget-number" style={{color: parseFloat(trir) > 2.7 ? '#e24b4a' : '#1d9e75'}}>
              {trir ?? '—'}
            </div>
            <div className="widget-sub">Industry avg: 2.7</div>
            <button className="widget-link" onClick={() => navigate('/dashboard')}>
              View dashboard →
            </button>
          </div>
        );

      case 'near_miss_rate':
        return (
          <div className="home-widget">
            <div className="widget-header">
              <span className="widget-icon">⚠️</span>
              <span className="widget-title">Near Miss Rate</span>
            </div>
            <div className="widget-number" style={{color: '#ef9f27'}}>
              {nearMissRate ?? '—'}%
            </div>
            <div className="widget-sub">{nearMisses.length} of {incidents.length} events</div>
            <button className="widget-link" onClick={() => navigate('/dashboard')}>
              View dashboard →
            </button>
          </div>
        );

      case 'recent_activity':
        return (
          <div className="home-widget home-widget-wide">
            <div className="widget-header">
              <span className="widget-icon">🕐</span>
              <span className="widget-title">Recent Activity</span>
            </div>
            {activity.length === 0 ? (
              <div className="widget-empty">No recent activity</div>
            ) : (
              <div className="widget-activity-list">
                {activity.map(item => (
                  <div key={item.id} className="widget-activity-item">
                    <div className="widget-activity-dot"></div>
                    <div className="widget-activity-content">
                      <div className="widget-activity-action">
                        {item.from_stage && item.to_stage
                          ? `${item.from_stage} → ${item.to_stage}`
                          : item.action}
                      </div>
                      <div className="widget-activity-meta">
                        {item.user_email} · {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'quick_links':
        return (
          <div className="home-widget">
            <div className="widget-header">
              <span className="widget-icon">🔗</span>
              <span className="widget-title">Quick Links</span>
            </div>
            <div className="quick-links-grid">
              <button className="quick-link-btn" onClick={() => navigate('/submit')}>
                <span>＋</span> Submit Incident
              </button>
              <button className="quick-link-btn" onClick={() => navigate('/dashboard')}>
                <span>▦</span> Dashboard
              </button>
              <button className="quick-link-btn" onClick={() => navigate('/workflows')}>
                <span>⚡</span> Workflows
              </button>
              <button className="quick-link-btn" onClick={() => navigate('/settings')}>
                <span>⚙</span> Settings
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return <div className="incidents-loading"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="home-page">
      <div className="home-greeting">
        <div className="home-greeting-text">
          <span className="home-greeting-sub">{greeting()},</span>
          <h1 className="home-greeting-name">
            {firstName || user.email.split('@')[0]} 👋
          </h1>
          <p className="home-greeting-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          className="widget-edit-btn"
          onClick={() => setShowWidgetEditor(!showWidgetEditor)}
        >
          {showWidgetEditor ? '✓ Done' : '⊞ Customize'}
        </button>
      </div>

      {showWidgetEditor && (
        <div className="widget-editor">
          <div className="widget-editor-title">Customize your dashboard</div>
          <div className="widget-editor-grid">
            {widgets.map(w => (
              <div
                key={w.id}
                className={`widget-toggle-item ${w.enabled ? 'enabled' : ''}`}
                onClick={() => toggleWidget(w.id)}
              >
                <span className="widget-toggle-icon">{WIDGET_META[w.id].icon}</span>
                <div className="widget-toggle-info">
                  <div className="widget-toggle-name">{WIDGET_META[w.id].title}</div>
                  <div className="widget-toggle-desc">{WIDGET_META[w.id].description}</div>
                </div>
                <div className={`widget-toggle-check ${w.enabled ? 'on' : 'off'}`}>
                  {w.enabled ? '✓' : '+'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="home-widgets">
        {widgets.filter(w => w.enabled).map(w => (
          <div key={w.id}>
            {renderWidget(w.id)}
          </div>
        ))}
      </div>

      <div className="home-ai-bar">
        <div className="home-ai-title">
          <span className="ai-icon">✦</span>
          Ask SafetyIQ AI
        </div>
        <form onSubmit={handleAiPrompt} className="home-ai-form">
          <input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Ask anything... 'How many incidents this month?' or 'Take me to submit an incident'"
            className="home-ai-input"
            disabled={aiLoading}
          />
          <button type="submit" className="home-ai-btn" disabled={aiLoading || !aiPrompt.trim()}>
            {aiLoading ? '...' : '→'}
          </button>
        </form>
        {aiResponse && (
          <div className="home-ai-response">
            <span className="ai-icon">✦</span>
            {aiResponse}
          </div>
        )}
      </div>
    </div>
  );
}