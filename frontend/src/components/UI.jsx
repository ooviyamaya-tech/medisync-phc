import { useEffect } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="header-actions">{actions}</div>}</div>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'teal' }) {
  return <article className="stat-card"><div className={`stat-icon tone-${tone}`}><Icon size={19} /></div><div className="stat-label">{label}</div><div className="stat-value">{value ?? <span className="skeleton skeleton-value" />}</div>{detail && <div className="stat-detail">{detail}</div>}</article>;
}

export function UrgencyBadge({ value = 'LOW' }) {
  const key = String(value).toUpperCase();
  return <span className={`urgency urgency-${key.toLowerCase()}`}>{key}</span>;
}

export function DataTable({ columns, rows, rowKey = 'id', empty = 'Nothing to show yet', loading = false }) {
  if (loading) return <div className="table-skeleton">{[1, 2, 3, 4].map(row => <div className="skeleton skeleton-row" key={row} />)}</div>;
  if (!rows?.length) return <div className="empty-state"><span className="empty-mark">0</span><strong>{empty}</strong><p>Results will appear here when data is available.</p></div>;
  return <div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[rowKey] || index}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}

export function ChartCard({ title, detail, children, action }) {
  return <section className="panel chart-panel"><div className="panel-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>{children}</section>;
}

export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', close); document.body.classList.remove('modal-open'); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>{children}</section></div>;
}

export function SearchInput({ value, onChange, placeholder = 'Search' }) {
  return <label className="search-input"><Search size={17} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function Loading({ label = 'Loading' }) { return <div className="loading-state"><LoaderCircle className="spin" size={20} />{label}</div>; }