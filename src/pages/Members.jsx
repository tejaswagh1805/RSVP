import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Download, Filter, Search, X } from 'lucide-react';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { TRACKS, dateLabel } from '../lib/constants.js';
import { downloadExcel } from '../lib/downloadExcel.js';

const memberFields = [
  ['Email', 'email'], ['Mobile', 'mobile'], ['Profile', 'profileUrl'], ['Handle', 'handle'], ['Platform', 'platform'],
  ['Followers', 'followers'], ['City', 'city'], ['Outlet', 'outlet'], ['Role', 'role'], ['All profiles', 'allProfiles'],
  ['Original track', 'sourceTrack'], ['Status', 'status'], ['Joined', 'joined'],
];

export default function Members({ rows, query, setQuery }) {
  const [track, setTrack] = useState('All tracks');
  const [selected, setSelected] = useState(null);
  const searchFields = (row) => [row.name, row.email, row.city, row.track, row.sourceTrack, row.handle, row.platform, row.mobile, row.outlet, row.role].join(' ').toLowerCase();
  const filtered = rows.filter((row) => (track === 'All tracks' || row.track === track) && searchFields(row).includes(query.toLowerCase()));
  const exportExcel = () => downloadExcel('rsvp-dxb-members.xlsx', ['Name', 'Track', 'Profile', 'Handle', 'Platform', 'Followers', 'Email', 'Mobile', 'City', 'Outlet', 'Role', 'All profiles', 'Tier', 'Points', 'Status', 'Joined'], filtered.map((row) => [row.name, row.sourceTrack || row.track, row.profileUrl, row.handle, row.platform, row.followers, row.email, row.mobile, row.city, row.outlet, row.role, row.allProfiles, row.rank, row.points, row.status, row.joined]));

  return <>
    <div className="member-stat-grid">{TRACKS.map((name, index) => <div className="member-stat" key={name}><span className={`track-indicator track-${index}`} /><div><span>{name}</span><strong>{rows.filter((row) => row.track === name).length.toLocaleString()}</strong></div><ArrowUpRight size={14} /></div>)}</div>
    <PageIntro title="Member directory" detail="Imported profiles, registration details, engagement, points and status." action={<button className="button button-secondary" onClick={exportExcel}><Download size={15} /> Export Excel</button>} />
    <div className="toolbar panel"><div className="filter-select"><Filter size={15} /><select value={track} onChange={(e) => setTrack(e.target.value)}><option>All tracks</option>{TRACKS.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div><div className="search-box section-search"><Search size={15} /><input placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} /></div><span className="toolbar-total">{filtered.length} members</span></div>
    <div className="panel table-panel table-scroll"><table><thead><tr><th>MEMBER</th><th>TRACK</th><th>TIER</th><th>PLATFORM</th><th>FOLLOWERS</th><th>POINTS</th><th>MOBILE</th><th>STATUS</th><th>CITY</th><th>JOINED</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><div className="member-cell"><div className="avatar avatar-soft">{row.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div><strong>{row.name}</strong><span>{row.email}</span></div></div></td><td><span className={`track-tag ${row.track === 'Private Circle' ? 'tag-red' : ''}`}>{row.track}</span></td><td><span className={`rank-tag rank-${row.rank?.toLowerCase()}`}>{row.rank || 'Bronze'}</span></td><td>{row.platform || '—'}</td><td>{Number(row.followers || 0).toLocaleString()}</td><td className="points-cell">{Number(row.points || 0).toLocaleString()} <span>pts</span></td><td>{row.mobile || '—'}</td><td><span className={`status-tag status-${row.status || 'approved'}`}>{row.status || 'approved'}</span></td><td>{row.city || '—'}</td><td>{dateLabel(row.joined)}</td><td><button className="icon-button row-more" onClick={() => setSelected(row)} aria-label={`View ${row.name}`}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title="No members found" detail="Members appear here after an application is approved or the existing member list is imported." />}</div>
    {selected && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="modal-card member-modal"><div className="modal-header"><div><div className="eyebrow">MEMBER PROFILE</div><h2>{selected.name}</h2><p>{selected.city || 'City not set'} · {selected.track}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close profile"><X size={18} /></button></div><div className="member-profile-stats"><div><span>Current tier</span><strong>{selected.rank || 'Bronze'}</strong></div><div><span>Points balance</span><strong>{Number(selected.points || 0).toLocaleString()}</strong></div><div><span>Events attended</span><strong>{Number(selected.events || 0).toLocaleString()}</strong></div></div><div className="member-detail-grid">{memberFields.map(([label, key]) => <div key={key}><span>{label}</span>{key === 'profileUrl' && /^https?:\/\//i.test(selected[key] || '') ? <a href={selected[key]} target="_blank" rel="noreferrer">Open profile</a> : <strong>{selected[key] || '—'}</strong>}</div>)}</div><div className="modal-footer"><button className="button button-secondary" onClick={() => setSelected(null)}>Close profile</button></div></section></div>}
  </>;
}
