import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import Home from './Home';
import Login from './Login';
import Submit from './Submit';
import Incidents from './Incidents';
import Dashboard from './Dashboard';
import Workflows from './Workflows';
import Settings from './Settings';
import './App.css';
import Tasks from './Tasks';

function Navigation({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: '/tasks', label: 'My Tasks', icon: '✓' },
    { path: '/home', label: 'Home', icon: '⌂' },
    { path: '/submit', label: 'Submit Incident', icon: '＋' },
    { path: '/incidents', label: 'Incidents', icon: '☰' },
    { path: '/dashboard', label: 'Dashboard', icon: '▦' },
    { path: '/workflows', label: 'Workflows', icon: '⚡' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <div className="nav">
      <div className="nav-brand">
        <div className="nav-logo">EHS</div>
        <div className="nav-brand-text">
          <span className="nav-title">SafetyIQ</span>
          <span className="nav-sub">EHS Platform</span>
        </div>
      </div>
      <div className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab.path}
            className={`nav-tab ${location.pathname === tab.path ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="nav-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="nav-user">
        <span className="nav-user-email">{user?.email}</span>
        <button className="nav-signout" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

function AppShell() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Navigation user={user} onSignOut={handleSignOut} />
      <div className="page-content">
        <Routes>
          <Route path="/tasks" element={<Tasks user={user} />} />
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<Home user={user} />} />
          <Route path="/submit" element={<Submit user={user} />} />
          <Route path="/incidents" element={<Incidents user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/workflows" element={<Workflows user={user} />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}