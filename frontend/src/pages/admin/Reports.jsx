import { apiFetch } from '../../apiFetch';
import { useCallback, useEffect, useState } from 'react';
import './Reports.css';

const API = 'http://localhost:8000/api/hrms/reports/dashboard/';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Could not load report.');
  return data;
}

function csvCell(value) {
  const text = String(value ?? '');
  return '"' + text.replaceAll('"', '""') + '"';
}

function downloadReport(data) {
  const records = [['Section', 'Name', 'Value']];

  Object.entries(data.overview || {}).filter(([key]) => key !== 'total_candidate_fees').forEach(([key, value]) => {
    records.push(['Overview', key, value]);
  });

  [
    ['Candidates by status', data.candidates_by_status, 'profile_status'],
    ['Jobs by status', data.jobs_by_status, 'status'],
    ['Applications by status', data.applications_by_status, 'application_status'],
    ['Interviews by status', data.interviews_by_status, 'interview_status'],
    ['Placements by status', data.placements_by_status, 'placement_status'],
    ['Leaves by status', data.leaves_by_status, 'status'],
  ].forEach(([section, rows, labelKey]) => {
    (rows || []).forEach((row) => records.push([section, row[labelKey], row.count]));
  });

  (data.departments || []).forEach((department) => {
    records.push(['Department employees', department.department_name, department.employee_count]);
    records.push(['Department jobs', department.department_name, department.job_count]);
  });

  (data.payroll?.by_status || []).forEach((row) => {
    records.push(['Payroll records', row.payment_status, row.record_count]);
    records.push(['Payroll net total', row.payment_status, row.net_salary_total]);
  });
  records.push(['Payroll paid in current calendar month', `${data.payroll?.month}/${data.payroll?.year}`, data.payroll?.paid_this_month_total ?? '0.00']);
  records.push(['Payroll paid record count in current calendar month', `${data.payroll?.month}/${data.payroll?.year}`, data.payroll?.paid_this_month_record_count ?? 0]);

  const content = records.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hrms-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function formatLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await readJson(await apiFetch(API)));
    } catch (err) {
      setError(err.message || 'Could not load report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  if (loading) {
    return <main className="reports-page"><p>Loading report…</p></main>;
  }

  if (error) {
    return (
      <main className="reports-page">
        <h1>Reports</h1>
        <div className="rp-error" role="alert">{error}</div>
        <button className="rp-button" onClick={loadReport}>Try again</button>
      </main>
    );
  }

  const overview = report?.overview || {};
  const statusGroups = [
    ['Candidates', report?.candidates_by_status || [], 'profile_status'],
    ['Jobs', report?.jobs_by_status || [], 'status'],
    ['Applications', report?.applications_by_status || [], 'application_status'],
    ['Interviews', report?.interviews_by_status || [], 'interview_status'],
    ['Placements', report?.placements_by_status || [], 'placement_status'],
    ['Leave requests', report?.leaves_by_status || [], 'status'],
  ];

  return (
    <main className="reports-page">
      

      <header className="rp-header">
        <div>
          <h1>Reports</h1>
          <p>HRMS totals and status summaries.</p>
          {report?.generated_at && (
            <div className="rp-small">
              Generated {new Date(report.generated_at).toLocaleString()}
            </div>
          )}
        </div>
        <button className="rp-button" onClick={() => downloadReport(report)}>
          Download CSV
        </button>
      </header>

      <h2>Overview</h2>
      <section className="rp-grid">
        {Object.entries(overview).filter(([key]) => key !== 'total_candidate_fees').map(([key, value]) => (
          <article className="rp-card" key={key}>
            <span>{formatLabel(key)}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="rp-sections">
        {statusGroups.map(([title, rows, labelKey]) => (
          <article className="rp-section" key={title}>
            <h2>{title} by status</h2>
            {rows.length === 0 ? (
              <div className="rp-empty">No records to show.</div>
            ) : rows.map((row, index) => (
              <div className="rp-row" key={index}>
                <span>{formatLabel(row[labelKey])}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </article>
        ))}

        <article className="rp-section">
          <h2>Departments</h2>
          {(report?.departments || []).length === 0 ? (
            <div className="rp-empty">No departments to show.</div>
          ) : report.departments.map((department) => (
            <div className="rp-row" key={department.id}>
              <span>{department.department_name}</span>
              <strong>{department.employee_count} employees · {department.job_count} jobs</strong>
            </div>
          ))}
        </article>

        <article className="rp-section">
          <h2>Payroll summary</h2>
          <div className="rp-row"><span>Month</span><strong>{report?.payroll?.month} / {report?.payroll?.year}</strong></div>
          <div className="rp-row"><span>Net total for this payroll period</span><strong>{report?.payroll?.current_month_net_salary_total ?? '0.00'}</strong></div>
          <div className="rp-row"><span>Paid during this calendar month</span><strong>{report?.payroll?.paid_this_month_total ?? '0.00'}</strong></div>
          <div className="rp-row"><span>Paid payroll records this month</span><strong>{report?.payroll?.paid_this_month_record_count ?? 0}</strong></div>
          <h3>Payroll payments this month by status</h3>
          {(report?.payroll?.by_status || []).map((row) => (
            <div className="rp-row" key={row.payment_status}>
              <span>{formatLabel(row.payment_status)} ({row.record_count})</span>
              <strong>{row.net_salary_total}</strong>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
