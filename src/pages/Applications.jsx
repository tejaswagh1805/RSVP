import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { dateLabel } from '../lib/constants.js';

export default function Applications({ rows, query, setQuery, act }) {
  const [filter, setFilter] = useState('pending');
  const shown = rows.filter((row) => (filter === 'all' || row.status === filter) && `${row.name} ${row.email} ${row.track} ${row.city} ${row.handle}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageIntro title="Review member applications" detail="Review profile details before activating a member account." action={<div className="search-box section-search"><Search size={15} /><input placeholder="Search applications" value={query} onChange={(e) => setQuery(e.target.value)} /></div>} />
    <div className="filter-tabs">{['pending', 'approved', 'rejected', 'all'].map((name) => <button className={filter === name ? 'selected' : ''} onClick={() => setFilter(name)} key={name}>{name[0].toUpperCase() + name.slice(1)} <span>{name === 'all' ? rows.length : rows.filter((row) => row.status === name).length}</span></button>)}</div>
    <div className="application-list">{shown.map((row) => <article className="panel application-card" key={row.id}>
      <div className="avatar avatar-large avatar-soft">{row.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div className="application-main"><div className="application-title"><h3>{row.name}</h3><span className={`track-tag ${row.track === 'Private Circle' ? 'tag-red' : ''}`}>{row.track}</span><span className={`status-tag status-${row.status}`}>{row.status}</span></div>
        <p>{row.detail || row.role || row.email}</p>
        <div className="application-meta"><span>{row.email}</span><i /><span>{row.city}</span><i /><span>Reach {row.followers || '0'}</span><i /><span>Applied {dateLabel(row.submitted)}</span></div>
        {(row.mobile || row.platform || row.handle || row.outlet || row.profileUrl) && <div className="application-meta"><span>{row.mobile || 'No mobile'}</span><i /><span>{[row.platform, row.handle].filter(Boolean).join(' · ') || 'No social profile'}</span>{row.outlet && <><i /><span>{row.outlet}</span></>}{/^https?:\/\//i.test(row.profileUrl || '') && <><i /><a href={row.profileUrl} target="_blank" rel="noreferrer">Open profile</a></>}</div>}
        {row.allProfiles && <details className="application-profiles"><summary>Additional profile links</summary><p>{row.allProfiles}</p></details>}
      </div>
      {row.status === 'pending' ? <div className="application-actions"><button className="button button-approve" onClick={() => act(() => api.decideApplication(row.id, 'approved'), `${row.name} approved`)}><Check size={15} /> Approve</button><button className="button button-danger-outline" onClick={() => act(() => api.decideApplication(row.id, 'rejected'), `${row.name} rejected`)}>Reject</button></div> : <span className="muted-text">{row.status === 'approved' ? 'Member account active' : 'Application rejected'}</span>}
    </article>)}{shown.length === 0 && <EmptyState title="No applications in this view" detail="Try another status or search term." />}</div>
  </>;
}
