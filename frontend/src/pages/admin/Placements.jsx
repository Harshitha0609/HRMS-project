import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Placements.css';

const API = 'http://localhost:8000/api/hrms/placements/';
const APPS =
  'http://localhost:8000/api/hrms/applications/?application_status=selected';

const STATUSES = ['offered', 'accepted', 'rejected', 'joined', 'withdrawn'];

const EMPTY = {
  application: '',
  offer_date: '',
  joining_date: '',
  offered_salary: '',
  placement_status: 'offered',
  remarks: '',
};

async function readJson(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Request failed.');
  }

  return data;
}

export default function Placements() {
  const [rows, setRows] = useState([]);
  const [apps, setApps] = useState([]);
  const [filters, setFilters] = useState({
    q: '',
    placement_status: '',
  });
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
        if (value) {
          params.set(key, value);
        }
      });

      const response = await apiFetch(`${API}?${params.toString()}`);
      setRows(await readJson(response));
    } catch (err) {
      setError(err.message || 'Could not load placements.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadApps = useCallback(async () => {
    try {
      const response = await apiFetch(APPS);
      setApps(await readJson(response));
    } catch (err) {
      setError(err.message || 'Could not load selected applications.');
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const change = (event) => {
    setForm((oldForm) => ({
      ...oldForm,
      [event.target.name]: event.target.value,
    }));
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
      application: String(row.application),
      offer_date: row.offer_date || '',
      joining_date: row.joining_date || '',
      offered_salary: row.offered_salary ?? '',
      placement_status: row.placement_status || 'offered',
      remarks: row.remarks || '',
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
      const payload = {
        offer_date: form.offer_date || null,
        joining_date: form.joining_date || null,
        offered_salary:
          form.offered_salary === '' ? null : form.offered_salary,
        placement_status: form.placement_status,
        remarks: form.remarks,
      };

      let url = API;
      let method = 'POST';

      if (editing) {
        url += `${editing}/`;
        method = 'PUT';
      } else {
        if (!form.application) {
          throw new Error('Select a selected application first.');
        }

        payload.application = Number(form.application);
      }

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      await readJson(response);

      setMessage(editing ? 'Placement updated.' : 'Placement created.');
      setShow(false);
      setEditing(null);
      setForm(EMPTY);

      await loadRows();
      await loadApps();
    } catch (err) {
      setError(err.message || 'Could not save placement.');
    } finally {
      setSaving(false);
    }
  };

  const selected = apps.find(
    (item) => String(item.id) === form.application
  );

  return (
    <main className="placements-page">
      

      <header className="pl-head">
        <div>
          <h1>Placements</h1>
          <p>Track offers, salaries, and candidate joining status.</p>
        </div>

        <button className="pl-btn" onClick={create}>
          Create placement
        </button>
      </header>

      {error && (
        <div className="pl-alert pl-error" role="alert">
          {error}
        </div>
      )}

      {message && <div className="pl-alert pl-success">{message}</div>}

      <section className="pl-panel">
        <div className="pl-field">
          <label htmlFor="pl-search">Search</label>
          <input
            id="pl-search"
            placeholder="Candidate or job title"
            value={filters.q}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
          />
        </div>

        <div className="pl-field">
          <label htmlFor="pl-filter">Status</label>
          <select
            id="pl-filter"
            value={filters.placement_status}
            onChange={(event) =>
              setFilters({
                ...filters,
                placement_status: event.target.value,
              })
            }
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <button
          className="pl-btn pl-alt"
          onClick={() => setFilters({ q: '', placement_status: '' })}
        >
          Clear filters
        </button>
      </section>

      {show && (
        <form className="pl-panel" onSubmit={save}>
          <h2 className="pl-title">
            {editing ? 'Edit placement' : 'Create placement'}
          </h2>

          {!editing && (
            <div className="pl-field">
              <label htmlFor="pl-app">Selected application *</label>
              <select
                id="pl-app"
                name="application"
                required
                value={form.application}
                onChange={change}
              >
                <option value="">Choose a selected application</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.candidate_name} — {app.job_title} (#{app.id})
                  </option>
                ))}
              </select>
              {selected && (
                <small>
                  Only selected applications can become placements.
                </small>
              )}
            </div>
          )}

          <div className="pl-field">
            <label htmlFor="pl-offer">Offer date</label>
            <input
              id="pl-offer"
              name="offer_date"
              type="date"
              value={form.offer_date}
              onChange={change}
            />
          </div>

          <div className="pl-field">
            <label htmlFor="pl-joining">Joining date</label>
            <input
              id="pl-joining"
              name="joining_date"
              type="date"
              value={form.joining_date}
              onChange={change}
            />
          </div>

          <div className="pl-field">
            <label htmlFor="pl-salary">Offered salary</label>
            <input
              id="pl-salary"
              name="offered_salary"
              type="number"
              min="0"
              step="0.01"
              value={form.offered_salary}
              onChange={change}
            />
          </div>

          <div className="pl-field">
            <label htmlFor="pl-status">Placement status</label>
            <select
              id="pl-status"
              name="placement_status"
              value={form.placement_status}
              onChange={change}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="pl-field">
            <label htmlFor="pl-remarks">Remarks</label>
            <textarea
              id="pl-remarks"
              name="remarks"
              value={form.remarks}
              onChange={change}
            />
          </div>

          <div className="pl-actions">
            <button className="pl-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save placement'}
            </button>
            <button
              className="pl-btn pl-alt"
              type="button"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="pl-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job</th>
              <th>Offer date</th>
              <th>Joining date</th>
              <th>Offered salary</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="pl-empty">
                  Loading placements…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="pl-empty">
                  No placements found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.candidate_name || '—'}</td>
                  <td>{row.job_title || '—'}</td>
                  <td>{row.offer_date || '—'}</td>
                  <td>{row.joining_date || '—'}</td>
                  <td>{row.offered_salary ?? '—'}</td>
                  <td>{row.placement_status || '—'}</td>
                  <td>{row.remarks || '—'}</td>
                  <td>
                    <button
                      className="pl-edit"
                      onClick={() => edit(row)}
                    >
                      Edit
                    </button><DeleteButton url={`${API}${row.id}/`} label={row.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}