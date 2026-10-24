import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Candidates.css';

const API = 'http://localhost:8000/api/hrms/candidates/';
const JOBS_API = 'http://localhost:8000/api/hrms/jobs/';
const COURSES_API = 'http://localhost:8000/api/hrms/courses/';
const PAYMENTS_API = 'http://localhost:8000/api/hrms/candidate-payments/';
const BLANK = { first_name: '', last_name: '', email: '', phone: '', city: '', skills: '', experience: '0', profile_status: 'new', target_job: '', course: '', course_fee: '0', initial_payment: '0' };
const STATUSES = ['new', 'shortlisted', 'interview', 'selected', 'rejected', 'hired'];

function Candidates() {
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({ q: '', profile_status: '', gender: '', city: '' });
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentCandidate, setPaymentCandidate] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: '', note: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadCandidates = useCallback(async (queryFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      Object.entries(queryFilters).forEach(([key, value]) => {
        if (value.trim()) query.set(key, value.trim());
      });
      const response = await apiFetch(`${API}?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setItems(data);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  useEffect(() => {
    apiFetch(JOBS_API)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (response.ok && Array.isArray(data)) setJobs(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch(COURSES_API)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (response.ok && Array.isArray(data)) setCourses(data);
      })
      .catch(() => {});
  }, []);

  const updateFilters = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updateCourse = (event) => {
    const courseId = event.target.value;
    const course = courses.find((item) => String(item.id) === courseId);
    setForm((current) => ({
      ...current,
      course: courseId,
      course_fee: course ? String(course.course_fee) : '0',
    }));
  };

  function editCandidate(candidate) {
    setEditingId(candidate.id);
    setForm({ ...BLANK, ...candidate, target_job: candidate.target_job ? String(candidate.target_job) : '', course: candidate.course ? String(candidate.course) : '', course_fee: String(candidate.course_fee ?? candidate.total_fee ?? '0'), initial_payment: '0', experience: String(candidate.experience ?? 0) });
    setNotice('');
    setError('');
    setFormOpen(true);
  }

  function newCandidate() {
    setEditingId(null);
    setForm(BLANK);
    setNotice('');
    setError('');
    setFormOpen(true);
  }

  async function saveCandidate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const candidateBody = {
        ...form,
        course: form.course || null,
        target_job: form.target_job || null,
        course_fee: Number(form.course_fee || 0),
        experience: Number(form.experience || 0),
      };
      if (editingId) delete candidateBody.initial_payment;
      else candidateBody.initial_payment = Number(form.initial_payment || 0);
      const response = await apiFetch(editingId ? `${API}${editingId}/` : API, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setFormOpen(false);
      setNotice(editingId ? 'Candidate updated successfully.' : 'Candidate created successfully.');
      setForm(BLANK);
      setEditingId(null);
      await loadCandidates();
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally {
      setSaving(false);
    }
  }

  function openPayment(candidate) {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setPaymentCandidate(candidate);
    setPaymentForm({ amount: '', payment_date: localDate, note: '' });
    setError('');
    setNotice('');
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!paymentCandidate) return;
    setPaymentSaving(true);
    setError('');
    try {
      const response = await apiFetch(PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: paymentCandidate.id, ...paymentForm, amount: Number(paymentForm.amount) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setPaymentCandidate(null);
      setNotice(data.message || 'Payment recorded successfully.');
      await loadCandidates();
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    } finally {
      setPaymentSaving(false);
    }
  }

  async function approveCandidate(candidate) {
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${API}${candidate.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve_account: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setNotice('Candidate account approved. They can now sign in.');
      await loadCandidates();
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not connect to Django. Make sure the backend is running.' : err.message);
    }
  }

  function search(event) {
    event.preventDefault();
    loadCandidates(filters);
  }

  function clearFilters() {
    const emptyFilters = { q: '', profile_status: '', gender: '', city: '' };
    setFilters(emptyFilters);
    loadCandidates(emptyFilters);
  }

  return (
    <div className="candidates-page">
      
      <header className="candidates-header">
        <div><p className="candidate-eyebrow">TALENT ACQUISITION</p><h1>Candidates</h1><p className="candidate-subtitle">Search candidate profiles and manage recruitment status.</p></div>
        <button className="candidate-primary" type="button" onClick={newCandidate}>Add candidate</button>
      </header>

      {notice && <p className="candidate-notice" role="status">{notice}</p>}
      {error && <p className="candidate-error" role="alert">{error}</p>}

      <form className="candidate-filter-bar" onSubmit={search}>
        <label className="candidate-search"><span>Search</span><input name="q" value={filters.q} onChange={updateFilters} placeholder="Name, email, phone, or city" /></label>
        <label><span>Status</span><select name="profile_status" value={filters.profile_status} onChange={updateFilters}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label><span>Gender</span><select name="gender" value={filters.gender} onChange={updateFilters}><option value="">All genders</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
        <label><span>City</span><input name="city" value={filters.city} onChange={updateFilters} placeholder="Exact city" /></label>
        <div className="candidate-actions"><button className="candidate-primary" type="submit">Apply</button><button className="candidate-secondary" type="button" onClick={clearFilters}>Clear</button></div>
      </form>

      {formOpen && <section className="candidate-form-panel">
        <div className="candidate-panel-heading"><div><p className="candidate-eyebrow">PROFILE</p><h2>{editingId ? 'Edit candidate' : 'Add candidate'}</h2></div><button className="candidate-close" type="button" onClick={() => setFormOpen(false)} aria-label="Close">×</button></div>
        <form className="candidate-form" onSubmit={saveCandidate}>
          <label><span>First name *</span><input name="first_name" required value={form.first_name} onChange={updateForm} /></label>
          <label><span>Last name *</span><input name="last_name" required value={form.last_name} onChange={updateForm} /></label>
          <label><span>Email *</span><input name="email" type="email" required value={form.email} onChange={updateForm} /></label>
          <label><span>Phone *</span><input name="phone" required value={form.phone} onChange={updateForm} /></label>
          <label><span>City</span><input name="city" value={form.city} onChange={updateForm} /></label>
          <label><span>Gender</span><select name="gender" value={form.gender} onChange={updateForm}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
          <label><span>Role</span><select name="target_job" value={form.target_job} onChange={updateForm}><option value="">Select role</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.job_title} · {job.department_name}</option>)}</select></label>
          <label><span>Department</span><input value={jobs.find((job) => String(job.id) === String(form.target_job))?.department_name || ''} readOnly placeholder="Selected from role" /></label>
          <label><span>Course</span><select name="course" value={form.course} onChange={updateCourse}><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.course_name}{course.status === 'inactive' ? ' (inactive)' : ''} · ₹{Number(course.course_fee).toLocaleString('en-IN')}</option>)}</select><small>Add courses from the Courses page if the list is empty.</small></label>
          <label><span>Course fee (₹)</span><input name="course_fee" type="number" min="0" step="0.01" value={form.course_fee} onChange={updateForm} readOnly={Boolean(form.course)} /><small>{form.course ? 'Fee captured from the course catalog.' : 'Select a course to fill this automatically, or enter a fee manually.'}</small></label>
          {!editingId ? <label><span>Paid amount (₹)</span><input name="initial_payment" type="number" min="0" max={form.course_fee || undefined} step="0.01" value={form.initial_payment} onChange={updateForm} /></label> : <label><span>Paid amount (₹)</span><input value={form.paid_amount || '0.00'} readOnly /><small>Record further payments from the candidate list.</small></label>}
          <label><span>Due amount (₹)</span><input value={Math.max(0, Number(form.course_fee || 0) - Number(editingId ? (form.paid_amount || 0) : (form.initial_payment || 0))).toFixed(2)} readOnly /></label>
          <label><span>Experience (years)</span><input name="experience" type="number" min="0" step="0.1" value={form.experience} onChange={updateForm} /></label>
          <label><span>Profile status</span><select name="profile_status" value={form.profile_status} onChange={updateForm}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="candidate-wide"><span>Skills</span><textarea name="skills" rows="3" value={form.skills} onChange={updateForm} placeholder="Separate skills with commas" /></label>
          <div className="candidate-form-actions candidate-wide"><button className="candidate-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="candidate-primary" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create candidate'}</button></div>
        </form>
      </section>}

      <section className="candidate-table-panel">
        <div className="candidate-panel-heading"><div><p className="candidate-eyebrow">CANDIDATE RECORDS</p><h2>All candidates <span className="candidate-total">{items.length}</span></h2></div><button className="candidate-secondary" type="button" onClick={() => loadCandidates(filters)}>Refresh</button></div>
        {loading ? <p className="candidate-empty">Loading candidates...</p> : items.length === 0 ? <p className="candidate-empty">No candidates match these filters.</p> : (
          <div className="candidate-table-scroll"><table className="candidate-table"><thead><tr><th>Candidate</th><th>Course</th><th>Role / Department</th><th>Contact</th><th>Course fee</th><th>Paid</th><th>Due</th><th>Profile status</th><th>Account approval</th><th>Actions</th></tr></thead><tbody>
            {items.map((candidate) => <tr key={candidate.id}><td><strong>{`${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unnamed candidate'}</strong><span className="candidate-muted">ID #{candidate.id}</span></td><td>{candidate.course_name || 'Not assigned'}{candidate.course_duration && <span className="candidate-muted">{candidate.course_duration}</span>}</td><td><strong>{candidate.role || 'No role selected'}</strong><span className="candidate-muted">{candidate.department || '—'}</span></td><td><span>{candidate.email || 'No email'}</span><span className="candidate-muted">{candidate.phone || 'No phone'}</span></td><td>₹{Number(candidate.course_fee ?? candidate.total_fee ?? 0).toLocaleString('en-IN')}</td><td className="candidate-paid">₹{Number(candidate.paid_amount || 0).toLocaleString('en-IN')}</td><td className={Number(candidate.due_amount || 0) > 0 ? 'candidate-due' : 'candidate-paid'}>₹{Number(candidate.due_amount || 0).toLocaleString('en-IN')}</td><td><span className={`candidate-status candidate-status-${candidate.profile_status}`}>{candidate.profile_status}</span></td><td>{candidate.account_status === 'pending' ? <button className="candidate-primary" type="button" onClick={() => approveCandidate(candidate)}>Approve</button> : <span className={`candidate-status ${candidate.account_status === 'approved' ? 'candidate-status-selected' : ''}`}>{candidate.account_status === 'approved' ? 'Approved' : 'No account'}</span>}</td><td className="candidate-row-actions"><button className="candidate-edit" type="button" onClick={() => editCandidate(candidate)}>Edit</button><button className="candidate-payment-button" type="button" disabled={Number(candidate.due_amount || 0) <= 0} onClick={() => openPayment(candidate)}>Record payment</button><DeleteButton url={`${API}${candidate.id}/`} label={`${candidate.first_name || ''} ${candidate.last_name || ''}`} /></td></tr>)}
          </tbody></table></div>
        )}
      </section>

      {paymentCandidate && <div className="candidate-payment-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentCandidate(null); }}>
        <section className="candidate-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="candidate-payment-title">
          <div className="candidate-panel-heading"><div><p className="candidate-eyebrow">PAYMENT COLLECTION</p><h2 id="candidate-payment-title">Record a payment</h2><p className="candidate-muted">{paymentCandidate.first_name} {paymentCandidate.last_name} · ₹{Number(paymentCandidate.due_amount || 0).toLocaleString('en-IN')} due</p></div><button className="candidate-close" type="button" onClick={() => setPaymentCandidate(null)} aria-label="Close">×</button></div>
          {error && <div className="candidate-error" role="alert">{error}</div>}
          <form className="candidate-payment-form" onSubmit={recordPayment}>
            <label><span>Amount (₹) *</span><input required type="number" min="0.01" max={paymentCandidate.due_amount} step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} /></label>
            <label><span>Payment date *</span><input required type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} /></label>
            <label className="candidate-wide"><span>Note</span><input value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional receipt or payment note" /></label>
            <div className="candidate-form-actions candidate-wide"><button className="candidate-secondary" type="button" onClick={() => setPaymentCandidate(null)}>Cancel</button><button className="candidate-primary" disabled={paymentSaving} type="submit">{paymentSaving ? 'Saving…' : 'Save payment'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

export default Candidates;


