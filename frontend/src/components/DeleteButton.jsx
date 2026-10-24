import { useState } from 'react';
import { apiFetch } from '../apiFetch';
import './DeleteButton.css';

export default function DeleteButton({ url, label, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (!window.confirm(`Delete ${label}? This cannot be undone. Linked records may also be affected.`)) return;

    setDeleting(true);
    setError('');
    try {
      const response = await apiFetch(url, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || `Delete failed (${response.status}).`);
      if (onDeleted) await onDeleted(data);
      else window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not delete this record.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="delete-action">
      <button className="delete-action-button" type="button" onClick={remove} disabled={deleting}>
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="delete-action-error" role="alert">{error}</span>}
    </span>
  );
}
