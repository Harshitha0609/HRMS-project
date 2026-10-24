import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Applications.css';

const API = 'http://localhost:8000/api/hrms/applications/';
const CANDIDATES_API = 'http://localhost:8000/api/hrms/candidates/';
const JOBS_API = 'http://localhost:8000/api/hrms/jobs/';
const STATUSES = ['applied', 'under_review', 'shortlisted', 'interview', 'selected', 'rejected', 'withdrawn'];

function Applications() {
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ q: '', application_status: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ candidate: '', job: '', cover_letter: '', resume: null });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ application_status: '', recruiter_remarks: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadApplications = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
      const response = await apiFetch(`${API}?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setApplications(data);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadApplications(); }, [loadApplications]);
  useEffect(() => {
    Promise.all([apiFetch(CANDIDATES_API), apiFetch(JOBS_API)])
      .then(async ([candidateResponse, jobResponse]) => {
        const [candidateData, jobData] = await Promise.all([candidateResponse.json(), jobResponse.json()]);
        if (!candidateResponse.ok) throw new Error(candidateData.error || 'Could not load candidates.');
        if (!jobResponse.ok) throw new Error(jobData.error || 'Could not load jobs.');
        setCandidates(candidateData);
        setJobs(jobData);
      })
      .catch((err) => setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message));
  }, []);

  function updateFilters(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function updateCreate(event) { setCreateForm((current) => ({ ...current, [event.target.name]: event.target.name === 'resume' ? event.target.files[0] : event.target.value })); }

  async function createApplication(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const body = new FormData();
    body.append('candidate', createForm.candidate);
    body.append('job', createForm.job);
    body.append('cover_letter', createForm.cover_letter);
    if (createForm.resume) body.append('resume', createForm.resume);
    try {
      const response = await apiFetch(API, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setCreateForm({ candidate: '', job: '', cover_letter: '', resume: null });
      setFormOpen(false);
      setNotice('Application created successfully.');
      await loadApplications(filters);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally { setSaving(false); }
  }

  function startEdit(application) {
    setEditing(application.id);
    setEditForm({ application_status: application.application_status, recruiter_remarks: application.recruiter_remarks || '' });
    setError(''); setNotice('');
  }

  async function updateApplication(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(`${API}${editing}/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setEditing(null); setNotice('Application updated successfully.');
      await loadApplications(filters);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally { setSaving(false); }
  }

  function clearFilters() {
    const empty = { q: '', application_status: '' };
    setFilters(empty); loadApplications(empty);
  }

  return <div className="applications-page">
    
    <header className="applications-head"><div><p className="applications-eyebrow">RECRUITMENT PIPELINE</p><h1>Applications</h1><p className="applications-sub">Review applications and update recruitment progress.</p></div><button className="applications-primary" type="button" onClick={() => { setFormOpen((open) => !open); setError(''); }}>New application</button></header>
    {notice && <p className="applications-notice" role="status">{notice}</p>}{error && <p className="applications-error" role="alert">{error}</p>}
    <form className="applications-filter" onSubmit={(event) => { event.preventDefault(); loadApplications(filters); }}>
      <label className="applications-search"><span>Search</span><input name="q" value={filters.q} onChange={updateFilters} placeholder="Candidate name, email, or job title" /></label>
      <label><span>Status</span><select name="application_status" value={filters.application_status} onChange={updateFilters}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>
      <div className="applications-buttons"><button className="applications-primary" type="submit">Apply</button><button className="applications-secondary" type="button" onClick={clearFilters}>Clear</button></div>
    </form>
    {formOpen && <section className="applications-form-panel"><div className="applications-heading"><div><p className="applications-eyebrow">SUBMISSION</p><h2>Create application</h2></div><button className="applications-secondary" type="button" onClick={() => setFormOpen(false)}>Close</button></div>
      <form className="applications-form" onSubmit={createApplication}>
        <label><span>Candidate *</span><select name="candidate" required value={createForm.candidate} onChange={updateCreate}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name} — {candidate.email}</option>)}</select></label>
        <label><span>Open job *</span><select name="job" required value={createForm.job} onChange={updateCreate}><option value="">Select open job</option>{jobs.filter((job) => job.status === 'open').map((job) => <option key={job.id} value={job.id}>{job.job_title}</option>)}</select></label>
        <label className="applications-wide"><span>Cover letter</span><textarea name="cover_letter" rows="3" value={createForm.cover_letter} onChange={updateCreate} /></label>
        <label className="applications-wide"><span>Resume (optional)</span><input name="resume" type="file" accept=".pdf,.doc,.docx" onChange={updateCreate} /></label>
        <div className="applications-form-buttons applications-wide"><button className="applications-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="applications-primary" type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Create application'}</button></div>
      </form>
    </section>}
    <section className="applications-table-panel"><div className="applications-heading"><div><p className="applications-eyebrow">APPLICATION RECORDS</p><h2>All applications <span className="applications-count">{applications.length}</span></h2></div><button className="applications-secondary" type="button" onClick={() => loadApplications(filters)}>Refresh</button></div>
      {loading ? <p className="applications-empty">Loading applications...</p> : applications.length === 0 ? <p className="applications-empty">No applications match these filters.</p> : <div className="applications-scroll"><table className="applications-table"><thead><tr><th>Candidate</th><th>Job</th><th>Applied</th><th>Status</th><th>Cover letter</th><th>Manage</th></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td><strong>{application.candidate_name}</strong><span className="applications-muted">{application.candidate_email}</span></td><td>{application.job_title}</td><td>{new Date(application.applied_date).toLocaleDateString()}</td><td><span className="applications-status">{application.application_status.replaceAll('_',' ')}</span></td><td>{application.cover_letter || '—'}{application.resume && <a href={`http://localhost:8000${application.resume}`} target="_blank" rel="noreferrer">View resume</a>}</td><td>{editing === application.id ? <div className="applications-editor"><form className="applications-inline-form" onSubmit={updateApplication}><label><span>Status</span><select value={editForm.application_status} onChange={(event) => setEditForm((current) => ({ ...current, application_status: event.target.value }))}>{STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label><label><span>Recruiter remarks</span><textarea rows="2" value={editForm.recruiter_remarks} onChange={(event) => setEditForm((current) => ({ ...current, recruiter_remarks: event.target.value }))} /></label><button className="applications-primary" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save'}</button><button className="applications-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button></form></div> : <button className="applications-edit" type="button" onClick={() => startEdit(application)}>Update</button>}<DeleteButton url={`${API}${application.id}/`} label={`application ${application.id}`} /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

export default Applications;