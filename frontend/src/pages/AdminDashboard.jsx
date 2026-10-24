import { apiFetch } from '../apiFetch';
import { useCallback, useEffect, useState } from 'react';
import './AdminDashboard.css';

const ANALYTICS_URL = 'http://localhost:8000/api/hrms/reports/dashboard/';

const summaryCards = [
  { key: 'total_employees', label: 'Employees', detailKey: 'active_employees', detailLabel: 'active', mark: 'PE', tone: 'violet' },
  { key: 'total_candidates', label: 'Candidates', mark: 'CA', tone: 'coral' },
  { key: 'open_jobs', label: 'Open positions', totalKey: 'total_jobs', totalLabel: 'total jobs', mark: 'JO', tone: 'blue' },
  { key: 'total_applications', label: 'Applications', mark: 'AP', tone: 'violet' },
  { key: 'scheduled_upcoming_interviews', label: 'Upcoming interviews', mark: 'IN', tone: 'teal' },
  { key: 'placed_candidates', label: 'Placed candidates', detail: 'Accepted offers and joined candidates', mark: 'PL', tone: 'coral' },
  { key: 'pending_leaves', label: 'Pending leave', mark: 'LV', tone: 'blue' },
  { key: 'total_departments', label: 'Departments', mark: 'DP', tone: 'teal' },
  { key: 'total_revenue', label: 'Course fee revenue', detail: 'Course fees collected', valueType: 'currency', mark: '₹', tone: 'teal' },
  { key: 'total_due_amount', label: 'Course fees due', detail: 'Remaining candidate balances', valueType: 'currency', mark: '₹', tone: 'coral' },
];

const statusSections = [
  { key: 'candidates_by_status', title: 'Candidates', field: 'profile_status', mark: 'CA' },
  { key: 'jobs_by_status', title: 'Jobs', field: 'status', mark: 'JO' },
  { key: 'applications_by_status', title: 'Applications' },
  { key: 'interviews_by_status', title: 'Interviews' },
  { key: 'placements_by_status', title: 'Placements' },
  { key: 'leaves_by_status', title: 'Leave requests', field: 'status', mark: 'LV' },
];

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function AdminDashboard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(ANALYTICS_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setReport(data);
    } catch (requestError) {
      setError(
        requestError.message === 'Failed to fetch'
          ? 'Could not connect to the HRMS server. Make sure Django is running.'
          : requestError.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);
  if (loading) {
    return <section className="dashboard-state" role="status">Loading dashboard...</section>;
  }

  if (error) {
    return (
      <section className="dashboard-state dashboard-error" role="alert">
        <div>
          <h1>Dashboard unavailable</h1>
          <p>{error}</p>
          <button className="dashboard-button" onClick={loadReport} type="button">
            Try again
          </button>
        </div>
      </section>
    );
  }

  const overview = report.overview || {};
  const progressRows = report.placement_progress || [];
  const progressTotal = progressRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  let progressCursor = 0;
  const progressColors = ['#ed9b59', '#6959cf', '#31a990', '#d96778', '#8790a8'];
  const progressGradient = progressTotal
    ? `conic-gradient(${progressRows.map((row, index) => {
      const start = progressCursor;
      progressCursor += progressTotal ? (Number(row.count) || 0) / progressTotal * 100 : 0;
      return `${progressColors[index % progressColors.length]} ${start}% ${progressCursor}%`;
    }).join(', ')})`
    : 'conic-gradient(#ebe9f2 0% 100%)';
  const monthlyIncome = report.monthly_income || [];
  const monthlyIncomeMax = Math.max(...monthlyIncome.map((item) => Number(item.income) || 0), 1);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">HRMS OVERVIEW</p>
          <h1>Admin dashboard</h1>
          <p className="dashboard-subtitle">A current snapshot of your workforce and hiring activity.</p>
        </div>
        <button className="dashboard-button" onClick={loadReport} type="button">
          Refresh data
        </button>
      </header>

      <section className="dashboard-summary-heading">
        <div>
          <p className="dashboard-eyebrow">AT A GLANCE</p>
          <h2>People and hiring</h2>
        </div>
        <span className="dashboard-summary-caption">A live view of your HR operations</span>
      </section>

      <section className="dashboard-cards" aria-label="HRMS summary">
        {summaryCards.map((card) => (
          <article className={`dashboard-card dashboard-card--${card.tone}${card.valueType ? ' dashboard-card--currency' : ''}`} key={card.key}>
            <span className="dashboard-card-mark" aria-hidden="true">{card.mark}</span>
            <span className="dashboard-card-label">{card.label}</span>
            <strong className="dashboard-card-value">{card.valueType === 'currency' ? formatCurrency(overview[card.key]) : overview[card.key] ?? 0}</strong>
            <span className="dashboard-card-detail">
              {card.detail
                ? card.detail
                : card.detailKey
                ? `${overview[card.detailKey] ?? 0} ${card.detailLabel}`
                : card.totalKey
                  ? `${overview[card.totalKey] ?? 0} ${card.totalLabel}`
                  : 'Across your organization'}
            </span>
          </article>
        ))}
      </section>

      <section className="dashboard-visualizations" aria-label="Business and placement analytics">
        <article className="dashboard-panel visualization-panel">
          <div className="dashboard-panel-heading">
            <div><p className="dashboard-eyebrow">PLACEMENT OVERVIEW</p><h2>Company progress</h2></div>
            <span className="dashboard-count">{progressTotal} records</span>
          </div>
          <div className="placement-chart-layout">
            <div className="placement-donut" role="img" aria-label={`Placement progress: ${progressRows.map((row) => `${row.label} ${row.count}`).join(', ') || 'no placement records'}`} style={{ '--placement-chart': progressGradient }}>
              <div><strong>{progressTotal}</strong><span>placements</span></div>
            </div>
            <div className="placement-legend">
              {progressRows.map((row, index) => (
                <div className="placement-legend-row" key={row.label}>
                  <span className="placement-legend-swatch" style={{ '--legend-color': progressColors[index % progressColors.length] }} />
                  <span>{row.label}</span><strong>{row.count}</strong>
                </div>
              ))}
              {!progressRows.length && <p className="dashboard-empty">No placement data yet.</p>}
            </div>
          </div>
          <p className="chart-caption">All placement outcomes are included. Accepted offers and joined candidates are tracked separately.</p>
        </article>

        <article className="dashboard-panel visualization-panel income-panel">
          <div className="dashboard-panel-heading">
            <div><p className="dashboard-eyebrow">COURSE FEE COLLECTIONS</p><h2>Monthly income</h2></div>
            <span className="dashboard-count">Last 6 months</span>
          </div>
          {monthlyIncome.length ? (
            <div className="income-chart" role="img" aria-label={`Monthly course fee income: ${monthlyIncome.map((item) => `${item.label} ${formatCurrency(item.course_fee_collected ?? item.income)}`).join(', ')}`}>
              {monthlyIncome.map((item) => {
                const amount = Number(item.course_fee_collected ?? item.income) || 0;
                const height = amount > 0 ? Math.max(8, amount / monthlyIncomeMax * 100) : 3;
                return <div className="income-column" key={`${item.year}-${item.month}`}>
                  <span className="income-value">{amount ? formatCurrency(amount) : '—'}</span>
                  <div className="income-bar-track"><span className="income-bar" style={{ height: `${height}%` }} /></div>
                  <span className="income-month">{item.label}</span>
                </div>;
              })}
            </div>
          ) : <p className="dashboard-empty">No monthly fee collection data yet.</p>}
          <div className="income-summary"><span>Course fees collected this month</span><strong>{formatCurrency(monthlyIncome.at(-1)?.course_fee_collected ?? monthlyIncome.at(-1)?.income)}</strong></div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">PEOPLE</p>
              <h2>Departments</h2>
            </div>
            <span className="dashboard-count">{report.departments?.length ?? 0}</span>
          </div>
          {report.departments?.length ? (
            <div className="department-list">
              {report.departments.map((department) => (
                <article className="department-row" key={department.id}>
                  <div>
                    <strong>{department.department_name}</strong>
                    <span>{department.employee_count} employees</span>
                  </div>
                  <span className="department-jobs">{department.job_count} jobs</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No department data available.</p>
          )}
        </section>

        <section className="dashboard-panel attendance-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">TODAY</p>
              <h2>Attendance</h2>
            </div>
            <span className="dashboard-count">{report.attendance_today?.total_records ?? 0} records</span>
          </div>
          <p className="attendance-date">
            {report.attendance_today?.date
              ? new Date(`${report.attendance_today.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Today'}
          </p>
          {report.attendance_today?.by_status?.length ? (
            <div className="attendance-statuses">
              {report.attendance_today.by_status.map((item) => {
                const statusKey = Object.keys(item).find((key) => key !== 'count');
                return <div className="attendance-status" key={item[statusKey]}>
                  <span className="attendance-status-dot" aria-hidden="true" />
                  <span>{formatLabel(item[statusKey])}</span>
                  <strong>{item.count}</strong>
                </div>;
              })}
            </div>
          ) : (
            <p className="dashboard-empty">No attendance has been recorded today.</p>
          )}
        </section>

        <section className="dashboard-panel payroll-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">PAYROLL</p>
              <h2>Paid this month</h2>
            </div>
            <span className="payroll-period">{report.payroll?.month}/{report.payroll?.year}</span>
          </div>
          <strong className="payroll-total">
            {formatCurrency(report.payroll?.paid_this_month_total)}
          </strong>
          <p className="dashboard-subtitle">{report.payroll?.paid_this_month_record_count ?? 0} payroll records paid in this calendar month, including records for other payroll periods.</p>
          <div className="payroll-status-row payroll-period-total-row">
            <span>Payroll-period net total ({report.payroll?.month}/{report.payroll?.year})</span>
            <div className="payroll-status-detail"><strong>{formatCurrency(report.payroll?.current_month_net_salary_total)}</strong></div>
          </div>
          <p className="dashboard-subtitle">Payroll records overall: {overview.total_payroll_records ?? 0}</p>
          <div className="payroll-status-list">
            <p className="dashboard-eyebrow">Payroll payments this month by status</p>
            {(report.payroll?.by_status || []).map((item) => (
              <div className="payroll-status-row" key={item.payment_status}>
                <span>{formatLabel(item.payment_status)}</span>
                <div className="payroll-status-detail">
                  <strong>{item.record_count} records</strong>
                  <span>{formatCurrency(item.net_salary_total)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {statusSections.map((section) => (
          <section className="dashboard-panel status-panel" key={section.key}>
            <div className="dashboard-panel-heading">
              <div>
                <p className="dashboard-eyebrow">STATUS BREAKDOWN</p>
                <h2>{section.title}</h2>
              </div>
            </div>
            {report[section.key]?.length ? (
              <div className="status-list">
                {(() => {
                  const rows = report[section.key];
                  const total = rows.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
                  return rows.map((item) => {
                  const statusKey = section.field || Object.keys(item).find((key) => key !== 'count');
                  const count = Number(item.count) || 0;
                  const percentage = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div className="status-row" key={item[statusKey]}>
                      <div className="status-row-label">
                        <span>{formatLabel(item[statusKey])}</span>
                        <small>{percentage}%</small>
                      </div>
                      <strong>{count}</strong>
                      <span className="status-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span>
                    </div>
                  );
                  });
                })()}
              </div>
            ) : (
              <p className="dashboard-empty">No records yet.</p>
            )}
          </section>
        ))}
      </div>

      <p className="dashboard-updated">
        <span className="dashboard-live-dot" aria-hidden="true" />
        Updated {report.generated_at ? new Date(report.generated_at).toLocaleString() : 'just now'}
      </p>
    </div>
  );
}

export default AdminDashboard;
