import { apiFetch } from '../../apiFetch';
import DeleteButton from '../../components/DeleteButton';
import { useCallback, useEffect, useState } from 'react';
import './Interviews.css';

const API = 'http://localhost:8000/api/hrms/interviews/';
const APPLICATIONS_API = 'http://localhost:8000/api/hrms/applications/';
const TYPES = ['online', 'offline', 'phone', 'technical', 'hr', 'managerial'];
const STATUSES = ['scheduled', 'completed', 'cancelled', 'rescheduled'];

const EMPTY = {
  application: '',
  interview_type: 'technical',
  interview_date: '',
  interview_time: '',
  meeting_link: '',
  location: '',
  feedback: '',
  rating: '',
  interview_status: 'scheduled',
};

async function responseData(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Request failed.');
  }

  return data;
}

export default function Interviews() {
  const [rows, setRows] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState({
    q: '',
    interview_status: '',
    interview_type: '',
  });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
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
      setRows(await responseData(response));
    } catch (err) {
      setError(err.message || 'Could not load interviews.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    async function loadApplications() {
      try {
        const response = await apiFetch(APPLICATIONS_API);
        setApplications(await responseData(response));
      } catch (err) {
        setError(err.message || 'Could not load applications.');
      }
    }

    loadApplications();
  }, []);

  const changeForm = (event) => {
    setForm((oldForm) => ({
      ...oldForm,
      [event.target.name]: event.target.value,
    }));
  };

  const newInterview = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const editInterview = (row) => {
    setEditing(row.id);
    setForm({
      application: String(row.application),
      interview_type: row.interview_type || 'technical',
      interview_date: row.interview_date || '',
      interview_time: (row.interview_time || '').slice(0, 5),
      meeting_link: row.meeting_link || '',
      location: row.location || '',
      feedback: row.feedback || '',
      rating: row.rating ?? '',
      interview_status: row.interview_status || 'scheduled',
    });
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        interview_type: form.interview_type,
        interview_date: form.interview_date,
        interview_time: form.interview_time,
        meeting_link: form.meeting_link,
        location: form.location,
        feedback: form.feedback,
        rating: form.rating === '' ? null : form.rating,
        interview_status: form.interview_status,
      };

      let url = API;
      let method = 'POST';

      if (editing) {
        url += `${editing}/`;
        method = 'PUT';
      } else {
        const application = applications.find(
          (item) => String(item.id) === form.application
        );

        if (!application) {
          throw new Error('Select an application first.');
        }

        payload.application = Number(form.application);
        payload.candidate = Number(application.candidate);
      }

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      await responseData(response);

      setMessage(editing ? 'Interview updated.' : 'Interview scheduled.');
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not save interview.');
    } finally {
      setSaving(false);
    }
  };

  const selected = applications.find(
    (item) => String(item.id) === form.application
  );

  return (
    <main className="interviews-page">
      

      <header className="iv-head">
        <div>
          <h1>Interviews</h1>
          <p>Schedule and manage candidate interviews.</p>
        </div>

        <button className="iv-btn" onClick={newInterview}>
          Schedule interview
        </button>
      </header>

      {error && (
        <div className="iv-alert iv-error" role="alert">
          {error}
        </div>
      )}

      {message && <div className="iv-alert iv-success">{message}</div>}

      <section className="iv-panel">
        <div className="iv-field">
          <label htmlFor="iv-q">Search</label>
          <input
            id="iv-q"
            placeholder="Candidate or interviewer"
            value={filters.q}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
          />
        </div>

        <div className="iv-field">
          <label htmlFor="iv-status-filter">Status</label>
          <select
            id="iv-status-filter"
            value={filters.interview_status}
            onChange={(event) =>
              setFilters({
                ...filters,
                interview_status: event.target.value,
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

        <div className="iv-field">
          <label htmlFor="iv-type-filter">Type</label>
          <select
            id="iv-type-filter"
            value={filters.interview_type}
            onChange={(event) =>
              setFilters({
                ...filters,
                interview_type: event.target.value,
              })
            }
          >
            <option value="">All types</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <button
          className="iv-btn alt"
          onClick={() =>
            setFilters({
              q: '',
              interview_status: '',
              interview_type: '',
            })
          }
        >
          Clear filters
        </button>
      </section>

      {showForm && (
        <form className="iv-panel" onSubmit={save}>
          <h2 className="iv-title">
            {editing ? 'Edit interview' : 'Schedule an interview'}
          </h2>

          {!editing && (
            <div className="iv-field">
              <label htmlFor="iv-application">Application *</label>
              <select
                id="iv-application"
                name="application"
                required
                value={form.application}
                onChange={changeForm}
              >
                <option value="">Choose an application</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.candidate_name} — {application.job_title} (#
                    {application.id})
                  </option>
                ))}
              </select>
              {selected && (
                <small>Candidate: {selected.candidate_name}</small>
              )}
            </div>
          )}

          <div className="iv-field">
            <label htmlFor="iv-type">Interview type *</label>
            <select
              id="iv-type"
              name="interview_type"
              required
              value={form.interview_type}
              onChange={changeForm}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="iv-field">
            <label htmlFor="iv-date">Date *</label>
            <input
              id="iv-date"
              name="interview_date"
              type="date"
              required
              value={form.interview_date}
              onChange={changeForm}
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-time">Time *</label>
            <input
              id="iv-time"
              name="interview_time"
              type="time"
              required
              value={form.interview_time}
              onChange={changeForm}
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-status">Status</label>
            <select
              id="iv-status"
              name="interview_status"
              value={form.interview_status}
              onChange={changeForm}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="iv-field">
            <label htmlFor="iv-link">Meeting link</label>
            <input
              id="iv-link"
              name="meeting_link"
              type="url"
              value={form.meeting_link}
              onChange={changeForm}
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-location">Location</label>
            <input
              id="iv-location"
              name="location"
              value={form.location}
              onChange={changeForm}
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-rating">Rating</label>
            <input
              id="iv-rating"
              name="rating"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={form.rating}
              onChange={changeForm}
            />
          </div>

          <div className="iv-field">
            <label htmlFor="iv-feedback">Feedback</label>
            <textarea
              id="iv-feedback"
              name="feedback"
              value={form.feedback}
              onChange={changeForm}
            />
          </div>

          <div className="iv-actions">
            <button className="iv-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save interview'}
            </button>
            <button
              className="iv-btn alt"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="iv-table-wrap">
        <table className="iv-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Interview</th>
              <th>Date and time</th>
              <th>Interviewer</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="iv-empty">
                  Loading interviews…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="iv-empty">
                  No interviews found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.candidate_name || '—'}</td>
                  <td>{row.interview_type || '—'}</td>
                  <td>
                    {row.interview_date || '—'}{' '}
                    {row.interview_time
                      ? row.interview_time.slice(0, 5)
                      : ''}
                  </td>
                  <td>{row.interviewer_name || '—'}</td>
                  <td>{row.interview_status || '—'}</td>
                  <td>{row.rating ?? '—'}</td>
                  <td>
                    <button
                      className="iv-edit"
                      onClick={() => editInterview(row)}
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