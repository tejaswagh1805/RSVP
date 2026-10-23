import { useState } from 'react';
import { Check, Search, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { dateLabel } from '../lib/constants.js';
import { getInfluencerCategory, INFLUENCER_CATEGORIES } from '../lib/influencerCategory.js';

export default function Applications({ rows, query, setQuery, act }) {
  const [filter, setFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const creators = rows.filter((row) => row.track === 'Creators' || String(row.track).toLowerCase() === 'influencer' || String(row.sourceTrack).toLowerCase() === 'influencer');
  const shown = rows.filter((row) => {
    const matchesStatus = filter === 'all' || row.status === filter;
    const category = getInfluencerCategory(row.followers);
    const matchesCategory = categoryFilter === 'all' || (categoryFilter === 'uncategorized' ? !category : category?.id === categoryFilter);
    const matchesSearch = `${row.name} ${row.email} ${row.track} ${row.city} ${row.handle}`.toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesSearch && (categoryFilter === 'all' || (creators.includes(row) && matchesCategory));
  });
  const removeApplication = (row) => {
    const confirmed = window.confirm(`Permanently delete ${row.name}${row.email ? ` (${row.email})` : ''} and any linked member account from the database? This cannot be undone.`);
    if (confirmed) act(() => api.deleteApplication(row.id), `${row.name} and linked member account deleted`);
  };
  return <>
    <PageIntro title="Review member applications" detail="Review profile details before activating a member account." action={<div className="search-box section-search"><Search size={15} /><input placeholder="Search applications" value={query} onChange={(e) => setQuery(e.target.value)} /></div>} />
    <div className="filter-tabs">{['pending', 'approved', 'rejected', 'all'].map((name) => <button className={filter === name ? 'selected' : ''} onClick={() => setFilter(name)} key={name}>{name[0].toUpperCase() + name.slice(1)} <span>{name === 'all' ? rows.length : rows.filter((row) => row.status === name).length}</span></button>)}</div>
    <div className="filter-tabs category-filter-tabs" aria-label="Filter creator applications by influencer category">
      <button className={categoryFilter === 'all' ? 'selected' : ''} onClick={() => setCategoryFilter('all')}>All applications <span>{rows.length}</span></button>
      {INFLUENCER_CATEGORIES.map((category) => <button className={categoryFilter === category.id ? 'selected' : ''} onClick={() => setCategoryFilter(category.id)} key={category.id}>{category.id} · {category.name} <span>{creators.filter((row) => getInfluencerCategory(row.followers)?.id === category.id).length}</span></button>)}
      <button className={categoryFilter === 'uncategorized' ? 'selected' : ''} onClick={() => setCategoryFilter('uncategorized')}>Uncategorized <span>{creators.filter((row) => !getInfluencerCategory(row.followers)).length}</span></button>
    </div>
    <div className="application-list">{shown.map((row) => <article className="panel application-card" key={row.id}>
      <div className="avatar avatar-large avatar-soft">{row.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div className="application-main"><div className="application-title"><h3>{row.name}</h3><span className={`track-tag ${row.track === 'Private Circle' ? 'tag-red' : ''}`}>{row.track}</span>{creators.includes(row) && (() => { const category = getInfluencerCategory(row.followers); return <span className="influencer-category-tag" title={category ? `${category.name} · ${category.range} followers` : 'Follower count below 1,000 or unavailable'}>{category ? `${category.id} · ${category.name}` : 'Uncategorized'}</span>; })()}<span className={`status-tag status-${row.status}`}>{row.status}</span></div>
        <p>{row.detail || row.role || row.email}</p>
        <div className="application-meta"><span>{row.email}</span><i /><span>{row.city}</span><i /><span>Reach {row.followers || '0'}</span><i /><span>Applied {dateLabel(row.submitted)}</span></div>
        {(row.mobile || row.platform || row.handle || row.outlet || row.profileUrl) && <div className="application-meta"><span>{row.mobile || 'No mobile'}</span><i /><span>{[row.platform, row.handle].filter(Boolean).join(' · ') || 'No social profile'}</span>{row.outlet && <><i /><span>{row.outlet}</span></>}{/^https?:\/\//i.test(row.profileUrl || '') && <><i /><a href={row.profileUrl} target="_blank" rel="noreferrer">Open profile</a></>}</div>}
        {row.allProfiles && <details className="application-profiles"><summary>Additional profile links</summary><p>{row.allProfiles}</p></details>}
      </div>
      <div className="application-actions">{row.status === 'pending' ? <><button className="button button-approve" onClick={() => act(() => api.decideApplication(row.id, 'approved'), `${row.name} approved`)}><Check size={15} /> Approve</button><button className="button button-danger-outline" onClick={() => act(() => api.decideApplication(row.id, 'rejected'), `${row.name} rejected`)}>Reject</button></> : <span className="muted-text">{row.status === 'approved' ? 'Member account active' : 'Application rejected'}</span>}<button className="button button-danger-outline" onClick={() => removeApplication(row)}><Trash2 size={14} /> Delete</button></div>
    </article>)}{shown.length === 0 && <EmptyState title="No applications in this view" detail="Try another status or search term." />}</div>
  </>;
}
