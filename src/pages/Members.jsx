import { Fragment, useState } from 'react';
import { ArrowUpRight, ChevronDown, Download, Filter, Search } from 'lucide-react';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { TRACKS, dateLabel } from '../lib/constants.js';
import { downloadExcel } from '../lib/downloadExcel.js';

const memberFields = [
  ['Email', 'email'], ['Mobile', 'mobile'], ['Profile', 'profileUrl'], ['Handle', 'handle'], ['Platform', 'platform'],
  ['Followers', 'followers'], ['City', 'city'], ['Outlet', 'outlet'], ['Role', 'role'], ['All profiles', 'allProfiles'],
  ['Original track', 'sourceTrack'], ['Tier', 'rank'], ['Points', 'points'], ['Events attended', 'events'],
  ['Status', 'status'], ['Joined', 'joined'],
];

function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function MemberDetail({ member, label, field }) {
  const value = field === 'joined' ? dateLabel(member[field]) : member[field];
  const text = value === null || value === undefined || value === '' ? '—' : String(value);

  return <div className={`member-accordion-field${field === 'allProfiles' ? ' member-accordion-field-wide' : ''}`}>
    <span>{label}</span>
    {field === 'profileUrl' && /^https?:\/\//i.test(text)
      ? <a href={text} target="_blank" rel="noreferrer">{text}</a>
      : <strong>{text}</strong>}
  </div>;
}

export default function Members({ rows, query, setQuery }) {
  const [track, setTrack] = useState('All tracks');
  const [expandedId, setExpandedId] = useState(null);
  const searchFields = (row) => [row.name, row.email, row.city, row.track, row.sourceTrack, row.handle, row.platform, row.mobile, row.outlet, row.role, row.allProfiles].join(' ').toLowerCase();
  const filtered = rows.filter((row) => (track === 'All tracks' || row.track === track) && searchFields(row).includes(query.toLowerCase()));
  const exportExcel = () => downloadExcel('rsvp-dxb-members.xlsx', ['Name', 'Track', 'Profile', 'Handle', 'Platform', 'Followers', 'Email', 'Mobile', 'City', 'Outlet', 'Role', 'All profiles', 'Tier', 'Points', 'Status', 'Joined'], filtered.map((row) => [row.name, row.sourceTrack || row.track, row.profileUrl, row.handle, row.platform, row.followers, row.email, row.mobile, row.city, row.outlet, row.role, row.allProfiles, row.rank, row.points, row.status, row.joined]));

  return <>
    <div className="member-stat-grid">{TRACKS.map((name, index) => <div className="member-stat" key={name}><span className={`track-indicator track-${index}`} /><div><span>{name}</span><strong>{rows.filter((row) => row.track === name).length.toLocaleString()}</strong></div><ArrowUpRight size={14} /></div>)}</div>
    <PageIntro title="Member directory" detail="Imported profiles, registration details, engagement, points and status." action={<button className="button button-secondary" onClick={exportExcel}><Download size={15} /> Export Excel</button>} />
    <div className="toolbar panel"><div className="filter-select"><Filter size={15} /><select value={track} onChange={(e) => setTrack(e.target.value)}><option>All tracks</option>{TRACKS.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div><div className="search-box section-search"><Search size={15} /><input placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} /></div><span className="toolbar-total">{filtered.length} members</span></div>
    <div className="panel table-panel table-scroll member-table-panel"><table className="member-table"><thead><tr><th>MEMBER</th><th>TRACK</th><th>TIER</th><th>PLATFORM</th><th>FOLLOWERS</th><th>POINTS</th><th>MOBILE</th><th>STATUS</th><th>CITY</th><th>JOINED</th><th aria-label="Expand member" /></tr></thead><tbody>{filtered.map((row) => {
      const isExpanded = expandedId === row.id;
      const toggle = () => setExpandedId((current) => current === row.id ? null : row.id);
      return <Fragment key={row.id}>
        <tr className={`member-table-row${isExpanded ? ' member-table-row-open' : ''}`}>
          <td><button className="member-summary-button" onClick={toggle} aria-expanded={isExpanded} aria-controls={`member-details-${row.id}`}>
            <span className="member-avatar" aria-hidden="true">{initials(row.name)}</span>
            <span className="member-summary-copy"><strong>{row.name}</strong><span>{row.email}</span></span>
          </button></td>
          <td><span className={`track-tag ${row.track === 'Private Circle' ? 'tag-red' : ''}`}>{row.track}</span></td>
          <td><span className={`rank-tag rank-${row.rank?.toLowerCase()}`}>{row.rank || 'Bronze'}</span></td>
          <td>{row.platform || '—'}</td>
          <td>{Number(row.followers || 0).toLocaleString()}</td>
          <td className="points-cell">{Number(row.points || 0).toLocaleString()} <span>pts</span></td>
          <td>{row.mobile || '—'}</td>
          <td><span className={`status-tag status-${row.status || 'approved'}`}>{row.status || 'approved'}</span></td>
          <td>{row.city || '—'}</td>
          <td>{dateLabel(row.joined)}</td>
          <td><button className={`member-expand-button${isExpanded ? ' is-open' : ''}`} onClick={toggle} aria-label={`${isExpanded ? 'Hide' : 'Show'} ${row.name} details`} aria-expanded={isExpanded}><ChevronDown size={16} /></button></td>
        </tr>
        {isExpanded && <tr className="member-details-row"><td colSpan="11"><section className="member-accordion" id={`member-details-${row.id}`} aria-label={`${row.name} details`}>
          <div className="member-accordion-heading"><div><span className="eyebrow">MEMBER DETAILS</span><h3>{row.name}</h3></div><span className={`track-tag ${row.track === 'Private Circle' ? 'tag-red' : ''}`}>{row.track}</span></div>
          <div className="member-accordion-grid">{memberFields.map(([label, field]) => <MemberDetail key={field} member={row} label={label} field={field} />)}</div>
        </section></td></tr>}
      </Fragment>;
    })}</tbody></table>{filtered.length === 0 && <EmptyState title="No members found" detail="Members appear here after an application is approved or the existing member list is imported." />}</div>
  </>;
}
