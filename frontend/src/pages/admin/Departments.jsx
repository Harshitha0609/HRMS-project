import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Departments.css';

const API = 'http://localhost:8000/api/hrms/departments/';
const STATUSES = ['active', 'inactive'];
const EMPTY = { department_name: '', department_code: '', description: '', status: 'active' };

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Request failed.');
  return data;
}

export default function Departments() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      setRows(await readJson(await apiFetch(API + '?' + params.toString())));
    } catch (err) {
      setError(err.message || 'Could not load departments.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const change = (event) => {
    setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  };

  const create = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setMessage('');
    setShow(true);
  };

  const edit = (row) => {
    setEditing(row.id);
    setForm({
      department_name: row.department_name || '',
      department_code: row.department_code || '',
      description: row.description || '',
      status: row.status || 'active',
    });
    setError('');
    setMessage('');
    setShow(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const url = editing ? API + editing + '/' : API;
      const method = editing ? 'PUT' : 'POST';
      await readJson(await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }));

      setMessage(editing ? 'Department updated.' : 'Department created.');
      setShow(false);
      setEditing(null);
      setForm(EMPTY);
      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not save department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="departments-page">
      

      <header className="dp-head">
        <div>
          <h1>Departments</h1>
          <p>Create and manage company departments.</p>
        </div>
        <button className="dp-btn" onClick={create}>Add department</button>
      </header>

      {error && <div className="dp-alert dp-error" role="alert">{error}</div>}
      {message && <div className="dp-alert dp-success">{message}</div>}

      <section className="dp-panel">
        <div className="dp-field">
          <label htmlFor="dp-search">Search</label>
          <input
            id="dp-search"
            placeholder="Department name or code"
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
          />
        </div>
        <div className="dp-field">
          <label htmlFor="dp-filter-status">Status</label>
          <select
            id="dp-filter-status"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <button
          className="dp-btn dp-alt"
          onClick={() => setFilters({ q: '', status: '' })}
        >
          Clear filters
        </button>
      </section>

      {show && (
        <form className="dp-panel" onSubmit={save}>
          <h2 className="dp-title">
            {editing ? 'Edit department' : 'Add department'}
          </h2>
          <div className="dp-field">
            <label htmlFor="dp-name">Department name *</label>
            <input
              id="dp-name"
              name="department_name"
              required
              value={form.department_name}
              onChange={change}
            />
          </div>
          <div className="dp-field">
            <label htmlFor="dp-code">Department code *</label>
            <input
              id="dp-code"
              name="department_code"
              required
              value={form.department_code}
              onChange={change}
            />
          </div>
          <div className="dp-field">
            <label htmlFor="dp-status">Status</label>
            <select
              id="dp-status"
              name="status"
              value={form.status}
              onChange={change}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="dp-field">
            <label htmlFor="dp-description">Description</label>
            <textarea
              id="dp-description"
              name="description"
              value={form.description}
              onChange={change}
            />
          </div>
          <div className="dp-actions">
            <button className="dp-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save department'}
            </button>
            <button
              className="dp-btn dp-alt"
              type="button"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="dp-wrap">
        <table className="dp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="dp-empty">Loading departments…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="dp-empty">No departments found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td>{row.department_name}</td>
                <td>{row.department_code}</td>
                <td>{row.description || '—'}</td>
                <td>{row.status}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
                <td><button className="dp-edit" onClick={() => edit(row)}>Edit</button><DeleteButton url={`${API}${row.id}/`} label={row.department_name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

