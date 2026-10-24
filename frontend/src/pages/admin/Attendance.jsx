import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Attendance.css';

const API = 'http://localhost:8000/api/hrms/attendance/';
const EMPLOYEES_API = 'http://localhost:8000/api/hrms/employees/options/';
const STATUSES = ['present', 'absent', 'late', 'half_day', 'work_from_home', 'leave'];
const EMPTY = { employee: '', date: '', check_in: '', check_out: '', working_hours: '', status: 'present', remarks: '' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

export default function Attendance() {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', date: '' });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      setRows(await readJson(await apiFetch(API + '?' + params.toString())));
    } catch (err) { setError(err.message || 'Could not load attendance.'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => {
    (async () => {
      try { setEmployees(await readJson(await apiFetch(EMPLOYEES_API))); }
      catch (err) { setError(err.message || 'Could not load employees.'); }
    })();
  }, []);

  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  const create = () => { setEditing(null); setForm(EMPTY); setError(''); setMessage(''); setShow(true); };
  const edit = (row) => {
    setEditing(row.id);
    setForm({ employee: String(row.employee), date: row.date || '', check_in: (row.check_in || '').slice(0, 5), check_out: (row.check_out || '').slice(0, 5), working_hours: row.working_hours ?? '', status: row.status || 'present', remarks: row.remarks || '' });
    setError(''); setMessage(''); setShow(true);
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { date: form.date, check_in: form.check_in || null, check_out: form.check_out || null, working_hours: form.working_hours === '' ? null : form.working_hours, status: form.status, remarks: form.remarks };
      let url = API; let method = 'POST';
      if (editing) { url += editing + '/'; method = 'PUT'; }
      else payload.employee = Number(form.employee);
      await readJson(await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setMessage(editing ? 'Attendance updated.' : 'Attendance recorded.');
      setShow(false); setEditing(null); setForm(EMPTY); await loadRows();
    } catch (err) { setError(err.message || 'Could not save attendance.'); }
    finally { setSaving(false); }
  };

  return <main className="attendance-page">
    
    <header className="at-head"><div><h1>Attendance</h1><p>Record and manage daily employee attendance.</p></div><button className="at-btn" onClick={create}>Record attendance</button></header>
    {error && <div className="at-alert at-error" role="alert">{error}</div>}
    {message && <div className="at-alert at-success">{message}</div>}
    <section className="at-panel">
      <div className="at-field"><label htmlFor="at-search">Search employee</label><input id="at-search" placeholder="Name or employee code" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}/></div>
      <div className="at-field"><label htmlFor="at-filter-status">Status</label><select id="at-filter-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></div>
      <div className="at-field"><label htmlFor="at-filter-date">Date</label><input id="at-filter-date" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })}/></div>
      <button className="at-btn at-alt" onClick={() => setFilters({ q: '', status: '', date: '' })}>Clear filters</button>
    </section>
    {show && <form className="at-panel" onSubmit={save}>
      <h2 className="at-title">{editing ? 'Edit attendance' : 'Record attendance'}</h2>
      {!editing && <div className="at-field"><label htmlFor="at-employee">Employee *</label><select id="at-employee" name="employee" required value={form.employee} onChange={change}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_name} ({employee.employee_code})</option>)}</select></div>}
      <div className="at-field"><label htmlFor="at-date">Date *</label><input id="at-date" name="date" type="date" required value={form.date} onChange={change}/></div>
      <div className="at-field"><label htmlFor="at-status">Status *</label><select id="at-status" name="status" required value={form.status} onChange={change}>{STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></div>
      <div className="at-field"><label htmlFor="at-checkin">Check-in</label><input id="at-checkin" name="check_in" type="time" value={form.check_in} onChange={change}/></div>
      <div className="at-field"><label htmlFor="at-checkout">Check-out</label><input id="at-checkout" name="check_out" type="time" value={form.check_out} onChange={change}/></div>
      <div className="at-field"><label htmlFor="at-hours">Working hours</label><input id="at-hours" name="working_hours" type="number" min="0" max="24" step="0.01" value={form.working_hours} onChange={change}/></div>
      <div className="at-field"><label htmlFor="at-remarks">Remarks</label><textarea id="at-remarks" name="remarks" value={form.remarks} onChange={change}/></div>
      <div className="at-actions"><button className="at-btn" disabled={saving}>{saving ? 'Saving…' : 'Save attendance'}</button><button className="at-btn at-alt" type="button" onClick={() => setShow(false)}>Cancel</button></div>
    </form>}
    <div className="at-wrap"><table className="at-table"><thead><tr><th>Employee</th><th>Date</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="8" className="at-empty">Loading attendance…</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="at-empty">No attendance records found.</td></tr> : rows.map((row) => <tr key={row.id}><td>{row.employee_name} ({row.employee_code})</td><td>{row.date}</td><td>{row.check_in ? row.check_in.slice(0, 5) : '—'}</td><td>{row.check_out ? row.check_out.slice(0, 5) : '—'}</td><td>{row.working_hours ?? '—'}</td><td>{row.status.replaceAll('_', ' ')}</td><td>{row.remarks || '—'}</td><td><button className="at-edit" onClick={() => edit(row)}>Edit</button><DeleteButton url={`${API}${row.id}/`} label={row.id} /></td></tr>)}
    </tbody></table></div>
  </main>;
}

