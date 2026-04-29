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
import Tasks from './Tasks';
import './App.css';

function Sidebar({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();

  const topNav = [
    { path: '/home', icon: '⌂', label: 'Home' },
    { path: '/submit', icon: '＋', label: 'New Submission' },
    { path: '/incidents', icon: '☰', label: 'Incidents' },
    { path: '/tasks', icon: '✓', label: 'My Tasks' },
    { path: '/workflows', icon: '⚡', label: 'Workflows' },
    { path: '/dashboard', icon: '▦', label: 'Dashboard' },
  ];

  const bottomNav = [
    { path: '/settings', icon: '⚙', label: 'Settings' },
  ];

  const initials = user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate('/home')}>
        <div className="sidebar-logo-icon">EHS</div>
      </div>

      <div className="sidebar-top">
        {topNav.map(item => (
          <div
            key={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        {bottomNav.map(item => (
          <div
            key={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-email">{user?.email}</div>
            <button className="sidebar-signout" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
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
    <div className="app-layout">
      <Sidebar user={user} onSignOut={handleSignOut} />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<Home user={user} />} />
          <Route path="/submit" element={<Submit user={user} />} />
          <Route path="/incidents" element={<Incidents user={user} />} />
          <Route path="/tasks" element={<Tasks user={user} />} />
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