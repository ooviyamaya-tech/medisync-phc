import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeftRight, Bell, Boxes, Building2, ClipboardCheck, ClipboardList, Command, FileSpreadsheet, FlaskConical, LayoutDashboard, LogOut, Map, Menu, Pill, ShieldCheck, Stethoscope, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useOfflineQueue } from './hooks/useOfflineQueue.js';
import { api, endpoints, itemsOf } from './services/api.js';
import { Loading, UrgencyBadge } from './components/UI.jsx';
import Login from './pages/Login.jsx';
import { ApprovalsPage, AlertsPage, DashboardPage, EmergencyPage, ForecastPage, IndentPage, MapPage, StockPage, UrgencyPage } from './pages/Workspace.jsx';

const iconMap = { Dashboard: LayoutDashboard, 'Stock management': Boxes, Forecast: Activity, 'Alerts centre': Bell, 'Centre urgency': AlertTriangle, 'Redistribution map': Map, 'Emergency request': ArrowLeftRight, 'Smart indent': FileSpreadsheet, Approvals: ClipboardCheck };
const roleTitles = { PHARMACIST: 'Pharmacist', MEDICAL_OFFICER: 'Medical Officer', DISTRICT_ADMIN: 'District Admin' };

function Protected({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="screen-center"><Loading label="Checking your session" /></div>;
  return user ? children || <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pending, online } = useOfflineQueue();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [phcName, setPhcName] = useState('');
  const links = useMemo(() => {
    const base = [
      { label: 'Dashboard', path: '/', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Stock management', path: '/stock', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Forecast', path: '/forecast', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Alerts centre', path: '/alerts', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Redistribution map', path: '/map', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Emergency request', path: '/emergency', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Smart indent', path: '/indent', roles: ['PHARMACIST', 'MEDICAL_OFFICER', 'DISTRICT_ADMIN'] },
      { label: 'Centre urgency', path: '/urgency', roles: ['DISTRICT_ADMIN'] },
      { label: 'Approvals', path: '/approvals', roles: ['MEDICAL_OFFICER'] },
    ];
    return base.filter(link => link.roles.includes(user.role));
  }, [user.role]);

  useEffect(() => {
    if (!user) return;
    Promise.all([endpoints.alerts({ status: 'OPEN' }), user.phc_id ? endpoints.phcs() : Promise.resolve(null)]).then(([alerts, phcs]) => {
      setUnread(itemsOf(alerts).length);
      if (phcs) setPhcName(itemsOf(phcs)[0]?.name || 'Assigned PHC');
    }).catch(() => {});
  }, [user]);

  return <div className="app-shell">
    {mobileOpen && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Command size={20} /></div><div><strong>MediSync</strong><small>PRIMARY HEALTH CARE</small></div><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-pill"><span className="pulse-dot" />{user.role === 'DISTRICT_ADMIN' ? 'Khordha district' : phcName || 'Health centre'}</div>
      <nav className="side-nav" aria-label="Main navigation"><div className="nav-caption">WORKSPACE</div>{links.map(link => { const Icon = iconMap[link.label]; return <NavLink key={link.path} to={link.path} end={link.path === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}><Icon size={18} /><span>{link.label}</span>{link.label === 'Alerts centre' && unread > 0 && <i className="nav-count">{unread}</i>}</NavLink>; })}</nav>
      <div className="sidebar-footer"><div className="profile"><div className="avatar">{user.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="profile-copy"><strong>{user.name}</strong><span>{roleTitles[user.role]}</span></div><button className="icon-button" title="Sign out" onClick={() => { logout(); navigate('/login'); }}><LogOut size={17} /></button></div><div className="secure-note"><ShieldCheck size={15} /> Secure clinical workspace</div></div>
    </aside>
    <main className="main-column"><header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumb"><span>{roleTitles[user.role]}</span><b>/</b><strong>{links.find(link => link.path === location.pathname)?.label || 'Workspace'}</strong></div><div className="topbar-right"><span className={`connection ${online ? 'is-online' : 'is-offline'}`}><i />{online ? 'Connected' : 'Offline'}</span><button className="notification-button" onClick={() => navigate('/alerts')} title="Open alerts"><Bell size={19} />{unread > 0 && <span>{unread}</span>}</button><div className="topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</div></div></header>
      {!online && <div className="offline-banner"><span><Activity size={16} /> Offline mode</span><strong>{pending} {pending === 1 ? 'entry' : 'entries'} pending sync</strong></div>}
      <div className="page-content"><Routes><Route path="/" element={<DashboardPage />} /><Route path="/stock" element={<StockPage />} /><Route path="/forecast" element={<ForecastPage />} /><Route path="/alerts" element={<AlertsPage />} /><Route path="/urgency" element={<RoleRoute role="DISTRICT_ADMIN"><UrgencyPage /></RoleRoute>} /><Route path="/map" element={<MapPage />} /><Route path="/emergency" element={<EmergencyPage />} /><Route path="/indent" element={<IndentPage />} /><Route path="/approvals" element={<RoleRoute role="MEDICAL_OFFICER"><ApprovalsPage /></RoleRoute>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div>
      <footer className="app-footer"><span><Stethoscope size={14} /> MediSync PHC</span><span>Medicine continuity, coordinated.</span></footer>
    </main>
  </div>;
}

function RoleRoute({ role, children }) {
  const { user } = useAuth();
  return user.role === role ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { checking } = useAuth();
  if (checking) return <div className="screen-center"><Loading label="Starting MediSync" /></div>;
  return <Routes><Route path="/login" element={<Login />} /><Route element={<Protected />}><Route path="/*" element={<Shell />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}