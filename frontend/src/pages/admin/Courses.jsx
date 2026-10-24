import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import './Courses.css';

const API = 'http://localhost:8000/api/hrms/courses/';
const EMPTY = { course_name: '', description: '', duration: '', course_fee: '0', status: 'active' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

function rupees(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value) || 0);
}

export default function Courses() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      const data = await readJson(await apiFetch(`${API}?${params}`));
      setRows(data);
    } catch (err) {
      setError(err.message || 'Could not load courses.');
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  function createCourse() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function editCourse(course) {
    setEditing(course.id);
    setForm({
      course_name: course.course_name || '',
      description: course.description || '',
      duration: course.duration || '',
      course_fee: String(course.course_fee || '0'),
      status: course.status || 'active',
    });
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  async function saveCourse(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const url = editing ? `${API}${editing}/` : API;
      await readJson(await apiFetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, course_fee: Number(form.course_fee || 0) }),
      }));
      setNotice(editing ? 'Course updated successfully.' : 'Course added to the catalog.');
      setFormOpen(false);
      setForm(EMPTY);
      setEditing(null);
      await loadCourses();
    } catch (err) {
      setError(err.message || 'Could not save course.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="courses-page">
      <header className="course-head">
        <div><p className="course-eyebrow">PROGRAM CATALOG</p><h1>Courses</h1><p>Set up courses and their fees. Assign a course to a candidate from the Candidates page.</p></div>
        <button className="course-primary" type="button" onClick={createCourse}>Add course</button>
      </header>

      {error && <div className="course-alert course-error" role="alert">{error}</div>}
      {notice && <div className="course-alert course-success" role="status">{notice}</div>}

      <section className="course-toolbar">
        <label><span>Search courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course name, duration, or description" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All courses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <span className="course-count">{rows.length} course{rows.length === 1 ? '' : 's'}</span>
      </section>

      {formOpen && <form className="course-form" onSubmit={saveCourse}>
        <div className="course-form-heading"><div><p className="course-eyebrow">COURSE DETAILS</p><h2>{editing ? 'Edit course' : 'Add a course'}</h2></div><button className="course-close" type="button" onClick={() => setFormOpen(false)}>Close</button></div>
        <label><span>Course name *</span><input required maxLength="160" value={form.course_name} onChange={(event) => setForm({ ...form, course_name: event.target.value })} placeholder="e.g. Full Stack Development" /></label>
        <label><span>Course fee (₹) *</span><input required type="number" min="0" step="0.01" value={form.course_fee} onChange={(event) => setForm({ ...form, course_fee: event.target.value })} /></label>
        <label><span>Duration</span><input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} placeholder="e.g. 6 months" /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="course-wide"><span>Description</span><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this course covers" /></label>
        <div className="course-form-actions course-wide"><button className="course-close" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="course-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add course'}</button></div>
      </form>}

      <section className="course-table-panel">
        <div className="course-table-heading"><div><p className="course-eyebrow">AVAILABLE PROGRAMS</p><h2>Course catalog</h2></div><button className="course-close" type="button" onClick={loadCourses}>Refresh</button></div>
        {loading ? <p className="course-empty">Loading courses…</p> : rows.length === 0 ? <div className="course-empty"><strong>No courses in the catalog yet.</strong><span>Add the courses your organization offers and set each fee here.</span></div> : <div className="course-scroll"><table className="course-table"><thead><tr><th>Course</th><th>Duration</th><th>Course fee</th><th>Candidates</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((course) => <tr key={course.id}><td><strong>{course.course_name}</strong>{course.description && <span className="course-description">{course.description}</span>}</td><td>{course.duration || '—'}</td><td className="course-fee-cell">{rupees(course.course_fee)}</td><td>{course.candidate_count}</td><td><span className={`course-status course-status-${course.status}`}>{course.status}</span></td><td className="course-actions"><button className="course-edit" type="button" onClick={() => editCourse(course)}>Edit</button><DeleteButton url={`${API}${course.id}/`} label={`course ${course.course_name}`} onDeleted={loadCourses} /></td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
