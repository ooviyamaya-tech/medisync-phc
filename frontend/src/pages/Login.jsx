import { useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Stethoscope } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const demos = [
  { label: 'Pharmacist', email: 'pharmacist@medisync.demo', role: 'PHARMACIST' },
  { label: 'Medical officer', email: 'officer@medisync.demo', role: 'MEDICAL_OFFICER' },
  { label: 'District admin', email: 'admin@medisync.demo', role: 'DISTRICT_ADMIN' },
];
const password = 'MediSyncDemo2026!';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const fill = demo => { setEmail(demo.email); setSecret(password); };
  const submit = async event => {
    event.preventDefault(); setBusy(true);
    try { await login({ email, password: secret }); navigate(location.state?.from?.pathname || '/', { replace: true }); }
    catch (error) { toast(error.response?.data?.error?.message || 'Unable to sign in. Check the API connection.', 'error'); }
    finally { setBusy(false); }
  };
  return <main className="login-page"><div className="login-art"><div className="login-brand"><div className="brand-mark"><Stethoscope size={20} /></div><span>MediSync PHC</span></div><div className="art-content"><span className="art-kicker"><i /> CARE THAT STAYS IN STOCK</span><h1>Right medicine.<br /><em>Right place.</em><br />Right on time.</h1><p>Connect medicine availability across primary health centres, and move essential stock where it can make the biggest difference.</p><div className="art-metric"><div className="metric-icon"><Activity size={19} /></div><div><strong>One coordinated view</strong><span>Stock, demand and urgency in one place</span></div></div></div><div className="art-graphic" aria-hidden="true"><div className="graphic-ring ring-one" /><div className="graphic-ring ring-two" /><div className="graphic-cross">+</div><div className="graphic-point point-a" /><div className="graphic-point point-b" /><div className="graphic-point point-c" /></div><small className="login-copyright">MEDISYNC · PRIMARY HEALTH CARE NETWORK</small></div>
    <section className="login-panel"><div className="login-form-wrap"><div className="mobile-login-brand"><div className="brand-mark"><Stethoscope size={20} /></div><span>MediSync PHC</span></div><span className="form-eyebrow">SECURE ACCESS</span><h2>Welcome back</h2><p className="login-subtitle">Sign in to your health centre workspace.</p><form onSubmit={submit} className="login-form"><label>Email address<div className="field-icon"><Mail size={17} /><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@healthcentre.org" /></div></label><label>Password<div className="field-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={secret} onChange={event => setSecret(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in...' : <>Sign in <ArrowRight size={18} /></>}</button></form><div className="demo-separator"><span />DEMO ACCESS<span /></div><p className="demo-caption">Choose a role to fill its local demo credentials.</p><div className="demo-buttons">{demos.map(demo => <button key={demo.email} className={`demo-button ${email === demo.email ? 'demo-selected' : ''}`} onClick={() => fill(demo)}><span className={`demo-dot dot-${demo.role.toLowerCase()}`} /><span>{demo.label}</span><small>Fill</small></button>)}</div><div className="login-security"><ShieldCheck size={16} /><span>Protected with secure, role-based access</span></div></div><div className="login-panel-footer">For authorised MediSync PHC users only</div></section></main>;
}