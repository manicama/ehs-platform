import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const STATUS_COLORS = {
  new: { bg: 'rgba(55,138,221,0.1)', color: '#378add' },
  in_review: { bg: 'rgba(239,159,39,0.1)', color: '#ef9f27' },
  resolved: { bg: 'rgba(29,158,117,0.1)', color: '#1d9e75' },
  closed: { bg: 'rgba(138,148,166,0.1)', color: '#8a94a6' },
};

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

  useEffect(() => {
    fetchIncidents();
  }, []);

  async function fetchIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setIncidents(data);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from('incidents')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
    }
  }

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter(i => i.incident_type === filter);

  const types = [...new Set(incidents.map(i => i.incident_type).filter(Boolean))];

  if (loading) {
    return (
      <div className="incidents-loading">
        <div className="loading-spinner"></div>
      </div>
    );
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
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({incidents.length})
        </button>
        {types.map(t => (
          <button
            key={t}
            className={`filter-btn ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t} ({incidents.filter(i => i.incident_type === t).length})
          </button>
        ))}
      </div>

      <div className="incidents-layout">
        <div className="incidents-list">
          {filtered.length === 0 ? (
            <div className="incidents-empty">
              <p>No incidents found</p>
            </div>
          ) : (
            filtered.map(incident => (
              <div
                key={incident.id}
                className={`incident-card ${selected?.id === incident.id ? 'active' : ''}`}
                onClick={() => setSelected(incident)}
              >
                <div className="incident-card-header">
                  <span
                    className="incident-type-badge"
                    style={TYPE_COLORS[incident.incident_type] || TYPE_COLORS['Other']}
                  >
                    {incident.incident_type}
                  </span>
                  <span
                    className="incident-status-badge"
                    style={STATUS_COLORS[incident.status] || STATUS_COLORS['new']}
                  >
                    {incident.status?.replace('_', ' ')}
                  </span>
                </div>
                <div className="incident-card-title">{incident.title}</div>
                <div className="incident-card-meta">
                  <span>📍 {incident.location}</span>
                  <span>🕐 {new Date(incident.occurred_at).toLocaleDateString()}</span>
                </div>
                <div className="incident-card-reporter">
                  Reported by {incident.reported_by}
                </div>
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
                <span
                  className="incident-type-badge"
                  style={TYPE_COLORS[selected.incident_type] || TYPE_COLORS['Other']}
                >
                  {selected.incident_type}
                </span>
                <span
                  className="incident-status-badge"
                  style={STATUS_COLORS[selected.status] || STATUS_COLORS['new']}
                >
                  {selected.status?.replace('_', ' ')}
                </span>
                {selected.is_osha_recordable && (
                  <span className="osha-badge">OSHA Recordable</span>
                )}
                {selected.is_dart && (
                  <span className="dart-badge">DART</span>
                )}
              </div>
            </div>

            <div className="detail-body">
              <div className="detail-section">
                <div className="detail-section-title">Incident Information</div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Date & Time</span>
                    <span className="detail-value">
                      {new Date(selected.occurred_at).toLocaleString()}
                    </span>
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
                    <span className="detail-value">
                      {new Date(selected.created_at).toLocaleString()}
                    </span>
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
                <div className="detail-section-title">Update Status</div>
                <div className="status-buttons">
                  {['new', 'in_review', 'resolved', 'closed'].map(s => (
                    <button
                      key={s}
                      className={`status-btn ${selected.status === s ? 'active' : ''}`}
                      style={selected.status === s ? STATUS_COLORS[s] : {}}
                      onClick={() => updateStatus(selected.id, s)}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}