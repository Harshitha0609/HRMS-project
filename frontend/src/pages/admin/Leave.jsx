import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Leave.css';

const API = 'http://localhost:8000/api/hrms/leaves/';
const EMPLOYEES_API = 'http://localhost:8000/api/hrms/employees/options/';
const TYPES = ['casual', 'sick', 'earned', 'emergency', 'maternity', 'paternity'];
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const EMPTY = { employee: '', leave_type: 'casual', start_date: '', end_date: '', number_of_days: '', reason: '', status: 'pending', remarks: '' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

export default function Leave() {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', leave_type: '' });
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
    } catch (err) { setError(err.message || 'Could not load leave requests.'); }
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
    setForm({ employee: String(row.employee), leave_type: row.leave_type, start_date: row.start_date, end_date: row.end_date, number_of_days: row.number_of_days, reason: row.reason || '', status: row.status, remarks: row.remarks || '' });
    setError(''); setMessage(''); setShow(true);
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { employee: Number(form.employee), leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, number_of_days: form.number_of_days, reason: form.reason, status: form.status, remarks: form.remarks };
      let url = API; let method = 'POST';
      if (editing) { url += editing + '/'; method = 'PUT'; }
      else payload.employee = Number(form.employee);
      await readJson(await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setMessage(editing ? 'Leave request updated.' : 'Leave request created.');
      setShow(false); setEditing(null); setForm(EMPTY); await loadRows();
    } catch (err) { setError(err.message || 'Could not save leave request.'); }
    finally { setSaving(false); }
  };

  return <main className="leave-page">
    
    <header className="lv-head"><div><h1>Leave</h1><p>Review employee leave requests and update their status.</p></div><button className="lv-btn" onClick={create}>Add leave request</button></header>
    {error && <div className="lv-alert lv-error" role="alert">{error}</div>}
    {message && <div className="lv-alert lv-success">{message}</div>}
    <section className="lv-panel">
      <div className="lv-field"><label htmlFor="lv-search">Search employee</label><input id="lv-search" placeholder="Name or employee code" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}/></div>
      <div className="lv-field"><label htmlFor="lv-filter-status">Status</label><select id="lv-filter-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="lv-field"><label htmlFor="lv-filter-type">Leave type</label><select id="lv-filter-type" value={filters.leave_type} onChange={(e) => setFilters({ ...filters, leave_type: e.target.value })}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      <button className="lv-btn lv-alt" onClick={() => setFilters({ q: '', status: '', leave_type: '' })}>Clear filters</button>
    </section>
    {show && <form className="lv-panel" onSubmit={save}>
      <h2 className="lv-title">{editing ? 'Edit leave request' : 'Add leave request'}</h2>
      <div className="lv-field"><label htmlFor="lv-employee">Employee *</label><select id="lv-employee" name="employee" required value={form.employee} onChange={change}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_name} ({employee.employee_code})</option>)}</select></div>
      <div className="lv-field"><label htmlFor="lv-type">Leave type *</label><select id="lv-type" name="leave_type" required value={form.leave_type} onChange={change}>{TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
      <div className="lv-field"><label htmlFor="lv-start">Start date *</label><input id="lv-start" name="start_date" type="date" required value={form.start_date} onChange={change}/></div>
      <div className="lv-field"><label htmlFor="lv-end">End date *</label><input id="lv-end" name="end_date" type="date" required value={form.end_date} onChange={change}/></div>
      <div className="lv-field"><label htmlFor="lv-days">Number of days *</label><input id="lv-days" name="number_of_days" type="number" min="0.1" max="366" step="0.1" required value={form.number_of_days} onChange={change}/></div>
      {editing && <div className="lv-field"><label htmlFor="lv-status">Status</label><select id="lv-status" name="status" value={form.status} onChange={change}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>}
      <div className="lv-field"><label htmlFor="lv-reason">Reason *</label><textarea id="lv-reason" name="reason" required value={form.reason} onChange={change}/></div>
      {editing && <div className="lv-field"><label htmlFor="lv-remarks">Admin remarks</label><textarea id="lv-remarks" name="remarks" value={form.remarks} onChange={change}/></div>}
      <div className="lv-actions"><button className="lv-btn" disabled={saving}>{saving ? 'Saving…' : 'Save leave request'}</button><button className="lv-btn lv-alt" type="button" onClick={() => setShow(false)}>Cancel</button></div>
    </form>}
    <div className="lv-wrap"><table className="lv-table"><thead><tr><th>Employee</th><th>Leave type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="8" className="lv-empty">Loading leave requests…</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="lv-empty">No leave requests found.</td></tr> : rows.map((row) => <tr key={row.id}><td>{row.employee_name} ({row.employee_code})</td><td>{row.leave_type}</td><td>{row.start_date} – {row.end_date}</td><td>{row.number_of_days}</td><td>{row.reason}</td><td>{row.status}</td><td>{row.remarks || '—'}</td><td><button className="lv-edit" onClick={() => edit(row)}>Edit</button><DeleteButton url={`${API}${row.id}/`} label={row.id} /></td></tr>)}
    </tbody></table></div>
  </main>;
}


