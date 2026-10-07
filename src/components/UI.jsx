import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';

export function PageIntro({ title, detail, action }) {
  return <div className="section-intro"><div><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}

export function StatCard({ label, value, note, icon: Icon, trend, accent = '' }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${accent}`}><Icon size={17} strokeWidth={1.8} /></span></div><div className="stat-value">{value}</div><div className="stat-note">{trend && <span className="trend"><ArrowUpRight size={13} />{trend}</span>}{note}</div></article>;
}

export function Attention({ label, value, icon: Icon, onClick }) {
  return <button className="attention-row" onClick={onClick}><span className="attention-icon"><Icon size={16} /></span><span>{label}</span><b className={value ? 'attention-value' : ''}>{value}</b><ChevronRight size={14} /></button>;
}

export function EmptyState({ title, detail }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={19} /></div><strong>{title}</strong><span>{detail}</span></div>;
}

export function PackageCard({ name, price, desc, tags }) {
  return <article className="panel package-card"><span className="eyebrow">BRAND PACKAGE</span><h3>{name}</h3><div className="package-price">from <strong>{price}</strong></div><p>{desc}</p><div className="package-tags">{tags.split(' · ').map((tag) => <span key={tag}>{tag}</span>)}</div></article>;
}
