import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useEffect, useState } from 'react';
import './Jobs.css';

const JOBS_API = 'http://localhost:8000/api/hrms/jobs/';
const DEPARTMENTS_API = 'http://localhost:8000/api/hrms/departments/';
const TYPES = [['full_time', 'Full time'], ['part_time', 'Part time'], ['internship', 'Internship'], ['contract', 'Contract'], ['remote', 'Remote'], ['hybrid', 'Hybrid']];
const STATUSES = ['draft', 'open', 'closed'];
const EMPTY = { job_title: '', department: '', job_type: 'full_time', location: '', experience_required: '', qualification: '', skills_required: '', salary_range: '', job_description: '', responsibilities: '', vacancies: '1', application_deadline: '', status: 'draft' };

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', job_type: '', department_code: '' });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadJobs(activeFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
      const response = await apiFetch(`${JOBS_API}?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setJobs(data);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => {
    apiFetch(DEPARTMENTS_API).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load departments.');
      setDepartments(data);
    }).catch((err) => setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message));
  }, []);

  function changeFilters(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function changeForm(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function createJob() { setEditing(null); setForm({ ...EMPTY, department: departments[0] ? String(departments[0].id) : '' }); setError(''); setNotice(''); setFormOpen(true); }
  function editJob(job) { setEditing(job.id); setForm({ ...EMPTY, ...job, department: String(job.department), vacancies: String(job.vacancies) }); setError(''); setNotice(''); setFormOpen(true); }

  async function saveJob(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const body = { ...form, department: Number(form.department), vacancies: Number(form.vacancies) };
    try {
      const response = await apiFetch(editing ? `${JOBS_API}${editing}/` : JOBS_API, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setFormOpen(false); setForm(EMPTY); setEditing(null);
      setNotice(editing ? 'Job updated successfully.' : 'Job created successfully.');
      await loadJobs(filters);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally { setSaving(false); }
  }

  function clearFilters() { const empty = { q: '', status: '', job_type: '', department_code: '' }; setFilters(empty); loadJobs(empty); }

  return <div className="jobs-page">
    
    <header className="jobs-head"><div><p className="jobs-eyebrow">HIRING MANAGEMENT</p><h1>Jobs</h1><p className="jobs-sub">Manage job openings and hiring timelines.</p></div><button className="jobs-primary" type="button" onClick={createJob}>Add job</button></header>
    {notice && <p className="jobs-notice" role="status">{notice}</p>}{error && <p className="jobs-error" role="alert">{error}</p>}
    <form className="jobs-filter" onSubmit={(event) => { event.preventDefault(); loadJobs(filters); }}>
      <label className="jobs-search"><span>Search</span><input name="q" value={filters.q} onChange={changeFilters} placeholder="Title, location, skills, qualification" /></label>
      <label><span>Status</span><select name="status" value={filters.status} onChange={changeFilters}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <label><span>Job type</span><select name="job_type" value={filters.job_type} onChange={changeFilters}><option value="">All types</option>{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label><span>Department</span><select name="department_code" value={filters.department_code} onChange={changeFilters}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.department_code}>{d.department_name} ({d.department_code})</option>)}</select></label>
      <div className="jobs-buttons"><button className="jobs-primary" type="submit">Apply</button><button className="jobs-secondary" type="button" onClick={clearFilters}>Clear</button></div>
    </form>
    {formOpen && <section className="jobs-form-panel"><div className="jobs-heading"><div><p className="jobs-eyebrow">JOB DETAILS</p><h2>{editing ? 'Edit job' : 'Create job'}</h2></div><button className="jobs-secondary" type="button" onClick={() => setFormOpen(false)}>Close</button></div>
      <form className="jobs-form" onSubmit={saveJob}>
        <label><span>Job title *</span><input name="job_title" required value={form.job_title} onChange={changeForm} /></label>
        <label><span>Department *</span><select name="department" required value={form.department} onChange={changeForm}><option value="">Select department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}</select></label>
        <label><span>Job type *</span><select name="job_type" value={form.job_type} onChange={changeForm}>{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label><span>Location *</span><input name="location" required value={form.location} onChange={changeForm} /></label>
        <label><span>Experience required *</span><input name="experience_required" required value={form.experience_required} onChange={changeForm} placeholder="e.g. 1-3 years" /></label>
        <label><span>Qualification *</span><input name="qualification" required value={form.qualification} onChange={changeForm} /></label>
        <label><span>Salary range</span><input name="salary_range" value={form.salary_range} onChange={changeForm} /></label>
        <label><span>Vacancies *</span><input name="vacancies" type="number" min="1" required value={form.vacancies} onChange={changeForm} /></label>
        <label><span>Application deadline *</span><input name="application_deadline" type="date" required value={form.application_deadline} onChange={changeForm} /></label>
        <label><span>Status</span><select name="status" value={form.status} onChange={changeForm}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="jobs-wide"><span>Skills required *</span><textarea name="skills_required" required rows="2" value={form.skills_required} onChange={changeForm} /></label>
        <label className="jobs-wide"><span>Job description *</span><textarea name="job_description" required rows="3" value={form.job_description} onChange={changeForm} /></label>
        <label className="jobs-wide"><span>Responsibilities</span><textarea name="responsibilities" rows="2" value={form.responsibilities} onChange={changeForm} /></label>
        <div className="jobs-form-buttons jobs-wide"><button className="jobs-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="jobs-primary" disabled={saving} type="submit">{saving ? 'Saving...' : editing ? 'Save changes' : 'Create job'}</button></div>
      </form>
    </section>}
    <section className="jobs-table-panel"><div className="jobs-heading"><div><p className="jobs-eyebrow">JOB RECORDS</p><h2>All jobs <span className="jobs-count">{jobs.length}</span></h2></div><button className="jobs-secondary" type="button" onClick={() => loadJobs(filters)}>Refresh</button></div>
      {loading ? <p className="jobs-empty">Loading jobs...</p> : jobs.length === 0 ? <p className="jobs-empty">No jobs match these filters.</p> : <div className="jobs-scroll"><table className="jobs-table"><thead><tr><th>Role</th><th>Department</th><th>Type</th><th>Location</th><th>Deadline</th><th>Vacancies</th><th>Status</th><th>Action</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.job_title}</strong><span className="jobs-muted">ID #{job.id}</span></td><td>{job.department_name}</td><td>{job.job_type.replaceAll('_',' ')}</td><td>{job.location}</td><td>{job.application_deadline}</td><td>{job.vacancies}</td><td><span className={`jobs-status jobs-status-${job.status}`}>{job.status}</span></td><td><button className="jobs-edit" type="button" onClick={() => editJob(job)}>Edit</button><DeleteButton url={`${JOBS_API}${job.id}/`} label={job.job_title} /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

export default Jobs;
