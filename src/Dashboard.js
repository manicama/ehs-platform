import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import AIInsights from './AIInsights';

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()} Q${q}`;
}

export default function Dashboard({ user }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendView, setTrendView] = useState('month');
  const [settings, setSettings] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchIncidents();
    fetchSettings();
  }, []);

  async function fetchIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('occurred_at', { ascending: false });
    if (!error) setIncidents(data);
    setLoading(false);
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_email', user.email)
      .single();
    if (data) setSettings(data);
  }

  const filtered = incidents.filter(i => {
    if (dateFrom && new Date(i.occurred_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(i.occurred_at) > new Date(dateTo)) return false;
    return true;
  });

  const recordable = filtered.filter(i => i.is_osha_recordable);
  const dartCases = filtered.filter(i => i.is_dart);
  const nearMisses = filtered.filter(i => i.incident_type === 'Near Miss');
  const injuries = filtered.filter(i => i.incident_type === 'Injury');

  const activeHeadcount = settings?.employee_count || 100;
  const monthlyHours = settings?.hours_per_month || 167;
  const months = dateFrom && dateTo
    ? Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24 * 30)))
    : 12;
  const totalHours = activeHeadcount * monthlyHours * months;

  const trir = totalHours > 0
    ? ((recordable.length * 200000) / totalHours).toFixed(2)
    : null;
  const dart = totalHours > 0
    ? ((dartCases.length * 200000) / totalHours).toFixed(2)
    : null;
  const nearMissRate = filtered.length > 0
    ? ((nearMisses.length / filtered.length) * 100).toFixed(1)
    : null;

  const pieData = [
    { name: 'DART', value: dartCases.length },
    { name: 'Recordable (non-DART)', value: Math.max(0, recordable.length - dartCases.length) },
    { name: 'Not Recordable', value: Math.max(0, filtered.length - recordable.length) },
  ].filter(d => d.value > 0);

  const COLORS = ['#ef9f27', '#378add', '#c8d0dc'];

  const barData = [
    { name: 'TRIR', yours: parseFloat(trir) || 0, industry: 2.7 },
    { name: 'DART', yours: parseFloat(dart) || 0, industry: 1.5 },
  ];

  const trendData = (() => {
    const map = {};
    filtered.forEach(i => {
      const key = trendView === 'month'
        ? monthKey(i.occurred_at)
        : quarterKey(i.occurred_at);
      if (!key) return;
      if (!map[key]) map[key] = { period: key, incidents: 0, nearMiss: 0, total: 0 };
      map[key].total++;
      if (i.incident_type === 'Injury') map[key].incidents++;
      if (i.incident_type === 'Near Miss') map[key].nearMiss++;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  })();

  if (loading) {
    return (
      <div className="incidents-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      {settings && (
        <div className="dashboard-settings-bar">
          <span>
            {settings.company_name && <strong>{settings.company_name}</strong>}
            {settings.company_name && ' · '}
            {activeHeadcount} employees · {monthlyHours} hrs/month
          </span>
          <a href="/settings" className="dashboard-settings-link">
            Edit in Settings →
          </a>
        </div>
      )}

      {!settings && (
        <div className="dashboard-settings-banner">
          Configure your workforce settings to calculate accurate TRIR and DART rates.
          <a href="/settings" className="dashboard-settings-link">Go to Settings →</a>
        </div>
      )}

      <div className="dash-section-block">
        <div className="section-header">
          <div className="section-header-left">
            <h2>TRIR & DART</h2>
            <p>Recordable incident rates compared to industry benchmarks</p>
          </div>
          <div className="date-filter-group">
            <span className="date-filter-label">Date Range</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="date-sep">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button className="btn-clear" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            )}
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card blue">
            <div className="kpi-label">TRIR</div>
            <div className="kpi-value blue">{trir ?? '—'}</div>
            <div className="kpi-sub">Industry avg: 2.7</div>
          </div>
          <div className="kpi-card amber">
            <div className="kpi-label">DART Rate</div>
            <div className="kpi-value amber">{dart ?? '—'}</div>
            <div className="kpi-sub">Industry avg: 1.5</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Total Incidents</div>
            <div className="kpi-value green">{filtered.length}</div>
            <div className="kpi-sub">In selected period</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Recordable</div>
            <div className="kpi-value red">{recordable.length}</div>
            <div className="kpi-sub">DART: {dartCases.length}</div>
          </div>
        </div>

        <div className="charts-grid">
          {pieData.length > 0 && (
            <div className="chart-card">
              <h3>Incident Breakdown</h3>
              <PieChart width={300} height={250}>
                <Pie
                  data={pieData}
                  cx={150}
                  cy={110}
                  outerRadius={90}
                  innerRadius={50}
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          )}
          <div className="chart-card">
            <h3>TRIR vs DART vs Industry</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
                <XAxis dataKey="name" stroke="#8a94a6" />
                <YAxis stroke="#8a94a6" />
                <Tooltip />
                <Bar dataKey="yours" fill="#378add" name="Your Rate" radius={[4,4,0,0]} />
                <Bar dataKey="industry" fill="#c8d0dc" name="Industry Avg" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dash-section-block">
        <div className="section-header">
          <div className="section-header-left">
            <h2>Incident Insights</h2>
            <p>Near miss trends and incident patterns over time</p>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card amber">
            <div className="kpi-label">Near Miss Rate</div>
            <div className="kpi-value amber">{nearMissRate ?? '—'}%</div>
            <div className="kpi-sub">{nearMisses.length} of {filtered.length} events</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Total Injuries</div>
            <div className="kpi-value blue">{injuries.length}</div>
            <div className="kpi-sub">Injury type incidents</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Near Misses</div>
            <div className="kpi-value green">{nearMisses.length}</div>
            <div className="kpi-sub">Reported this period</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Incident to Near Miss</div>
            <div className="kpi-value red">
              {nearMisses.length > 0
                ? `1:${(nearMisses.length / Math.max(injuries.length, 1)).toFixed(1)}`
                : '—'}
            </div>
            <div className="kpi-sub">Higher ratio is better</div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Incident Trends</h3>
            <div className="toggle-group">
              <button className={`toggle-btn ${trendView === 'month' ? 'active' : ''}`} onClick={() => setTrendView('month')}>Monthly</button>
              <button className={`toggle-btn ${trendView === 'quarter' ? 'active' : ''}`} onClick={() => setTrendView('quarter')}>Quarterly</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf2" />
              <XAxis dataKey="period" stroke="#8a94a6" tick={{fontSize: 11}} />
              <YAxis stroke="#8a94a6" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="incidents" stroke="#e24b4a" strokeWidth={2} dot={true} name="Injuries" />
              <Line type="monotone" dataKey="nearMiss" stroke="#ef9f27" strokeWidth={2} dot={true} name="Near Miss" />
              <Line type="monotone" dataKey="total" stroke="#378add" strokeWidth={2} dot={true} name="Total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <AIInsights incidents={incidents} />

    </div>
  );
}