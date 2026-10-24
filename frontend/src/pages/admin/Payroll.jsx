import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './Payroll.css';

const API = 'http://localhost:8000/api/hrms/payroll/';
const EMPLOYEES_API = 'http://localhost:8000/api/hrms/employees/options/';
const STATUSES = ['pending', 'paid', 'failed'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const EMPTY = { employee: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()), basic_salary: '', allowances: '0', bonuses: '0', deductions: '0', tax: '0', payment_date: '', payment_status: 'pending' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

export default function Payroll() {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ q: '', payment_status: '', month: '', year: '' });
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
    } catch (err) { setError(err.message || 'Could not load payroll records.'); }
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
    setForm({ employee: String(row.employee), month: String(row.month), year: String(row.year), basic_salary: row.basic_salary, allowances: row.allowances, bonuses: row.bonuses, deductions: row.deductions, tax: row.tax, payment_date: row.payment_date || '', payment_status: row.payment_status });
    setError(''); setMessage(''); setShow(true);
  };

  const netSalary = useMemo(() => {
    const amount = (value) => Number(value || 0);
    return amount(form.basic_salary) + amount(form.allowances) + amount(form.bonuses) - amount(form.deductions) - amount(form.tax);
  }, [form]);

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = { employee: Number(form.employee), month: Number(form.month), year: Number(form.year), basic_salary: form.basic_salary, allowances: form.allowances || 0, bonuses: form.bonuses || 0, deductions: form.deductions || 0, tax: form.tax || 0, payment_status: form.payment_status, payment_date: form.payment_date || null };
      let url = API; let method = 'POST';
      if (editing) { url += editing + '/'; method = 'PUT'; }
      await readJson(await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setMessage(editing ? 'Payroll record updated.' : 'Payroll record created.');
      setShow(false); setEditing(null); setForm(EMPTY); await loadRows();
    } catch (err) { setError(err.message || 'Could not save payroll record.'); }
    finally { setSaving(false); }
  };

  return <main className="payroll-page">
    
    <header className="py-head"><div><h1>Payroll</h1><p>Create and manage monthly employee payroll records.</p></div><button className="py-btn" onClick={create}>Add payroll</button></header>
    {error && <div className="py-alert py-error" role="alert">{error}</div>}
    {message && <div className="py-alert py-success">{message}</div>}
    <section className="py-panel">
      <div className="py-field"><label htmlFor="py-search">Search employee</label><input id="py-search" placeholder="Name or employee code" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}/></div>
      <div className="py-field"><label htmlFor="py-filter-status">Payment status</label><select id="py-filter-status" value={filters.payment_status} onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="py-field"><label htmlFor="py-filter-month">Month</label><select id="py-filter-month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })}><option value="">All months</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
      <div className="py-field"><label htmlFor="py-filter-year">Year</label><input id="py-filter-year" type="number" min="1" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}/></div>
      <button className="py-btn py-alt" onClick={() => setFilters({ q: '', payment_status: '', month: '', year: '' })}>Clear filters</button>
    </section>
    {show && <form className="py-panel" onSubmit={save}>
      <h2 className="py-title">{editing ? 'Edit payroll record' : 'Add payroll record'}</h2>
      <div className="py-field"><label htmlFor="py-employee">Employee *</label><select id="py-employee" name="employee" required value={form.employee} onChange={change}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_name} ({employee.employee_code})</option>)}</select></div>
      <div className="py-field"><label htmlFor="py-month">Month *</label><select id="py-month" name="month" required value={form.month} onChange={change}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
      <div className="py-field"><label htmlFor="py-year">Year *</label><input id="py-year" name="year" type="number" min="1" required value={form.year} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-basic">Basic salary *</label><input id="py-basic" name="basic_salary" type="number" min="0" step="0.01" required value={form.basic_salary} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-allowances">Allowances</label><input id="py-allowances" name="allowances" type="number" min="0" step="0.01" value={form.allowances} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-bonuses">Bonuses</label><input id="py-bonuses" name="bonuses" type="number" min="0" step="0.01" value={form.bonuses} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-deductions">Deductions</label><input id="py-deductions" name="deductions" type="number" min="0" step="0.01" value={form.deductions} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-tax">Tax</label><input id="py-tax" name="tax" type="number" min="0" step="0.01" value={form.tax} onChange={change}/></div>
      <div className="py-field"><label htmlFor="py-payment-status">Payment status</label><select id="py-payment-status" name="payment_status" value={form.payment_status} onChange={change}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="py-field"><label htmlFor="py-payment-date">Payment date</label><input id="py-payment-date" name="payment_date" type="date" value={form.payment_date} onChange={change}/></div>
      <div className="py-summary">Calculated net salary: <strong>{Number.isFinite(netSalary) ? netSalary.toFixed(2) : '0.00'}</strong></div>
      <div className="py-actions"><button className="py-btn" disabled={saving}>{saving ? 'Saving…' : 'Save payroll'}</button><button className="py-btn py-alt" type="button" onClick={() => setShow(false)}>Cancel</button></div>
    </form>}
    <div className="py-wrap"><table className="py-table"><thead><tr><th>Employee</th><th>Period</th><th>Basic</th><th>Allowances</th><th>Bonuses</th><th>Deductions</th><th>Tax</th><th>Net salary</th><th>Status</th><th>Payment date</th><th>Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="11" className="py-empty">Loading payroll records…</td></tr> : rows.length === 0 ? <tr><td colSpan="11" className="py-empty">No payroll records found.</td></tr> : rows.map((row) => <tr key={row.id}><td>{row.employee_name} ({row.employee_code})</td><td>{MONTHS[row.month - 1]} {row.year}</td><td>{row.basic_salary}</td><td>{row.allowances}</td><td>{row.bonuses}</td><td>{row.deductions}</td><td>{row.tax}</td><td>{row.net_salary}</td><td>{row.payment_status}</td><td>{row.payment_date || '—'}</td><td><button className="py-edit" onClick={() => edit(row)}>Edit</button><DeleteButton url={`${API}${row.id}/`} label={row.id} /></td></tr>)}
    </tbody></table></div>
  </main>;
}

