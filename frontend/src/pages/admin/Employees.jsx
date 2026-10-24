import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Employees.css';

const API = 'http://localhost:8000/api/hrms/employees/';
const EMPLOYEES_API = 'http://localhost:8000/api/hrms/employees/options/';
const DEPARTMENTS_API = 'http://localhost:8000/api/hrms/departments/';
const EMPLOYEE_STATUSES = ['active', 'inactive', 'notice', 'resigned', 'terminated'];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const GENDERS = ['male', 'female', 'other'];
const EMPTY = { employee_id: '', employee_code: '', first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', department: '', designation: '', joining_date: '', employment_type: 'full_time', salary: '', manager: '', employee_status: 'active' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

function label(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [filters, setFilters] = useState({ q: '', employee_status: '', department: '' });
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
    } catch (err) { setError(err.message || 'Could not load employees.'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => {
    (async () => {
      try {
        const [departmentResponse, employeeResponse] = await Promise.all([apiFetch(DEPARTMENTS_API), apiFetch(EMPLOYEES_API)]);
        const [departmentData, employeeData] = await Promise.all([readJson(departmentResponse), readJson(employeeResponse)]);
        setDepartments(departmentData);
        setManagers(employeeData);
      } catch (err) { setError(err.message || 'Could not load department or manager options.'); }
    })();
  }, []);

  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  const create = () => { setEditing(null); setForm(EMPTY); setError(''); setMessage(''); setShow(true); };
  const edit = (row) => {
    setEditing(row.id);
    setForm({ employee_id: row.employee_id || '', employee_code: row.employee_code || '', first_name: row.first_name || '', last_name: row.last_name || '', email: row.email || '', phone: row.phone || '', date_of_birth: row.date_of_birth || '', gender: row.gender || '', address: row.address || '', department: String(row.department), designation: row.designation || '', joining_date: row.joining_date || '', employment_type: row.employment_type || 'full_time', salary: row.salary || '', manager: row.manager ? String(row.manager) : '', employee_status: row.employee_status || 'active' });
    setError(''); setMessage(''); setShow(true);
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...form, department: Number(form.department), manager: form.manager ? Number(form.manager) : null, salary: form.salary };
      let url = API; let method = 'POST';
      if (editing) { url += editing + '/'; method = 'PUT'; }
      await readJson(await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setMessage(editing ? 'Employee updated.' : 'Employee created.');
      setShow(false); setEditing(null); setForm(EMPTY); await loadRows();
    } catch (err) { setError(err.message || 'Could not save employee.'); }
    finally { setSaving(false); }
  };

  return <main className="employees-page">
    
    <header className="em-head"><div><h1>Employees</h1><p>Manage employee details, departments, and employment status.</p></div><button className="em-btn" onClick={create}>Add employee</button></header>
    {error && <div className="em-alert em-error" role="alert">{error}</div>}
    {message && <div className="em-alert em-success">{message}</div>}
    <section className="em-panel">
      <div className="em-field"><label htmlFor="em-search">Search</label><input id="em-search" placeholder="Name, employee code, ID, or email" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}/></div>
      <div className="em-field"><label htmlFor="em-filter-status">Status</label><select id="em-filter-status" value={filters.employee_status} onChange={(e) => setFilters({ ...filters, employee_status: e.target.value })}><option value="">All statuses</option>{EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-filter-department">Department</label><select id="em-filter-department" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}</select></div>
      <button className="em-btn em-alt" onClick={() => setFilters({ q: '', employee_status: '', department: '' })}>Clear filters</button>
    </section>
    {show && <form className="em-panel" onSubmit={save}>
      <h2 className="em-title">{editing ? 'Edit employee' : 'Add employee'}</h2>
      <div className="em-field"><label htmlFor="em-id">Employee ID *</label><input id="em-id" name="employee_id" required value={form.employee_id} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-code">Employee code *</label><input id="em-code" name="employee_code" required value={form.employee_code} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-first">First name *</label><input id="em-first" name="first_name" required value={form.first_name} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-last">Last name *</label><input id="em-last" name="last_name" required value={form.last_name} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-email">Email *</label><input id="em-email" name="email" type="email" required value={form.email} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-phone">Phone *</label><input id="em-phone" name="phone" required value={form.phone} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-department">Department *</label><select id="em-department" name="department" required value={form.department} onChange={change}><option value="">Select department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-designation">Designation *</label><input id="em-designation" name="designation" required value={form.designation} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-joining">Joining date *</label><input id="em-joining" name="joining_date" type="date" required value={form.joining_date} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-type">Employment type *</label><select id="em-type" name="employment_type" required value={form.employment_type} onChange={change}>{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-salary">Salary *</label><input id="em-salary" name="salary" type="number" min="0" step="0.01" required value={form.salary} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-dob">Date of birth</label><input id="em-dob" name="date_of_birth" type="date" value={form.date_of_birth} onChange={change}/></div>
      <div className="em-field"><label htmlFor="em-gender">Gender</label><select id="em-gender" name="gender" value={form.gender} onChange={change}><option value="">Select gender</option>{GENDERS.map((g) => <option key={g} value={g}>{label(g)}</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-manager">Manager</label><select id="em-manager" name="manager" value={form.manager} onChange={change}><option value="">No manager</option>{managers.filter((m) => m.id !== editing).map((m) => <option key={m.id} value={m.id}>{m.employee_name} ({m.employee_code})</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-status">Employee status</label><select id="em-status" name="employee_status" value={form.employee_status} onChange={change}>{EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      <div className="em-field"><label htmlFor="em-address">Address</label><textarea id="em-address" name="address" value={form.address} onChange={change}/></div>
      <div className="em-actions"><button className="em-btn" disabled={saving}>{saving ? 'Saving…' : 'Save employee'}</button><button className="em-btn em-alt" type="button" onClick={() => setShow(false)}>Cancel</button></div>
    </form>}
    <div className="em-wrap"><table className="em-table"><thead><tr><th>Employee</th><th>Code / ID</th><th>Email</th><th>Department</th><th>Designation</th><th>Joining date</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="9" className="em-empty">Loading employees…</td></tr> : rows.length === 0 ? <tr><td colSpan="9" className="em-empty">No employees found.</td></tr> : rows.map((row) => <tr key={row.id}><td>{row.first_name} {row.last_name}</td><td>{row.employee_code} / {row.employee_id}</td><td>{row.email}</td><td>{row.department_name}</td><td>{row.designation}</td><td>{row.joining_date}</td><td>{row.salary}</td><td>{label(row.employee_status)}</td><td><button className="em-edit" onClick={() => edit(row)}>Edit</button><DeleteButton url={`${API}${row.id}/`} label={`${row.first_name} ${row.last_name}`} /></td></tr>)}
    </tbody></table></div>
  </main>;
}

