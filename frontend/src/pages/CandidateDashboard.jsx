import { apiFetch } from '../apiFetch';
import { useCallback, useEffect, useState } from 'react';
import './CandidateDashboard.css';

const JOBS_API = 'http://localhost:8000/api/hrms/jobs/?status=open';
const APPLICATIONS_API = 'http://localhost:8000/api/hrms/applications/';
const PROFILE_API = 'http://localhost:8000/api/accounts/profile/';
const INTERVIEWS_API = 'http://localhost:8000/api/accounts/interviews/';
const OFFERS_API = 'http://localhost:8000/api/accounts/offers/';
const NOTIFICATIONS_API = 'http://localhost:8000/api/accounts/notifications/';
const FEES_API = 'http://localhost:8000/api/accounts/fees/';
const COURSES_API = 'http://localhost:8000/api/accounts/courses/';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || 'Could not load jobs.');
  return data;
}

function pretty(value) {
  return String(value || '').replaceAll('_', ' ');
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function CandidateDashboard() {
  const logout = async () => {
    try {
      await apiFetch('http://localhost:8000/api/accounts/logout/', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      window.location.assign('/');
    }
  };
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('jobs');
  const [applyingJob, setApplyingJob] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [resume, setResume] = useState(null);
  const [profile, setProfile] = useState(null);
  const [fees, setFees] = useState(null);
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [profileResume, setProfileResume] = useState(null);
  const [removeResume, setRemoveResume] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setJobs(await readJson(await apiFetch(JOBS_API)));
    } catch (err) {
      setError(err.message || 'Could not load open jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setApplications(await readJson(await apiFetch(APPLICATIONS_API)));
    } catch (err) {
      setError(err.message || 'Could not load your applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile(await readJson(await apiFetch(PROFILE_API)));
      setProfileResume(null);
      setRemoveResume(false);
    } catch (err) {
      setError(err.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [feeData, courseData] = await Promise.all([
        apiFetch(FEES_API).then(readJson),
        apiFetch(COURSES_API).then(readJson),
      ]);
      setFees(feeData);
      setCatalogCourses(courseData);
    } catch (err) {
      setError(err.message || 'Could not load your fee details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInterviews(await readJson(await apiFetch(INTERVIEWS_API)));
    } catch (err) {
      setError(err.message || 'Could not load your interviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOffers(await readJson(await apiFetch(OFFERS_API)));
    } catch (err) {
      setError(err.message || 'Could not load your offers.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readJson(await apiFetch(NOTIFICATIONS_API));
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function markNotificationRead(notificationId) {
    try {
      const response = await apiFetch(`${NOTIFICATIONS_API}${notificationId}/read/`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not mark notification as read.');
      await loadNotifications();
    } catch (err) {
      setError(err.message || 'Could not update the notification.');
    }
  }

  async function markAllNotificationsRead() {
    try {
      const response = await apiFetch(`${NOTIFICATIONS_API}read-all/`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not mark notifications as read.');
      await loadNotifications();
    } catch (err) {
      setError(err.message || 'Could not update notifications.');
    }
  }

  async function respondToOffer(offer, responseStatus) {
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${OFFERS_API}${offer.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement_status: responseStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setNotice(data.message || `Offer ${responseStatus}.`);
      await loadOffers();
    } catch (err) {
      setError(err.message || 'Could not submit your offer response.');
    }
  }

  function updateProfile(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setError('');
    setNotice('');
    const formData = new FormData();
    [
      'first_name', 'last_name', 'phone', 'date_of_birth', 'gender', 'address',
      'city', 'state', 'education', 'college', 'degree', 'graduation_year',
      'skills', 'experience',
    ].forEach((field) => formData.append(field, profile[field] ?? ''));
    if (profileResume) formData.append('resume', profileResume);
    if (removeResume) formData.append('remove_resume', 'true');
    try {
      const response = await apiFetch(PROFILE_API, { method: 'PUT', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setNotice('Your profile was updated successfully.');
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function withdrawApplication(application) {
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${APPLICATIONS_API}${application.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_status: 'withdrawn' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setNotice('Your application was withdrawn.');
      await loadApplications();
    } catch (err) {
      setError(err.message || 'Could not withdraw your application.');
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!applyingJob) return;
    setSubmittingApplication(true);
    setError('');
    setNotice('');
    const formData = new FormData();
    formData.append('job', String(applyingJob.id));
    formData.append('cover_letter', coverLetter);
    if (resume) formData.append('resume', resume);
    try {
      const response = await apiFetch(APPLICATIONS_API, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setNotice('Your application was submitted successfully.');
      setApplyingJob(null);
      setCoverLetter('');
      setResume(null);
      await loadApplications();
      setActiveTab('applications');
    } catch (err) {
      setError(err.message || 'Could not submit your application.');
    } finally {
      setSubmittingApplication(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const visibleJobs = jobs.filter((job) => {
    const searchable = [
      job.job_title,
      job.department_name,
      job.location,
      job.skills_required,
      job.qualification,
    ].join(' ').toLowerCase();
    return searchable.includes(query.toLowerCase());
  });
  const feeTotal = Number(fees?.course_fee ?? fees?.total_fee ?? 0);
  const feePaid = Number(fees?.paid_amount || 0);
  const feeDue = Number(fees?.due_amount || 0);
  const feeProgress = feeTotal > 0 ? Math.min(100, Math.round((feePaid / feeTotal) * 100)) : 0;

  return (
    <main className="candidate-jobs-page">
      

      <section className="cj-hero"><button className="cj-logout" onClick={logout}>Logout</button>
        <h1>Find your next opportunity</h1>
        <p>Browse current openings and explore roles across the company.</p>
      </section>

      {notice && <div className="cj-success" role="status">{notice}</div>}
      <nav className="cj-tabs" aria-label="Candidate pages">
        <button className={activeTab === 'jobs' ? 'active' : ''} onClick={() => { setActiveTab('jobs'); loadJobs(); }}>Open jobs</button>
        <button className={activeTab === 'applications' ? 'active' : ''} onClick={() => { setActiveTab('applications'); loadApplications(); }}>My applications</button>
        <button className={activeTab === 'interviews' ? 'active' : ''} onClick={() => { setActiveTab('interviews'); loadInterviews(); }}>My interviews</button>
        <button className={activeTab === 'offers' ? 'active' : ''} onClick={() => { setActiveTab('offers'); loadOffers(); }}>My offers</button>
        <button className={activeTab === 'fees' ? 'active' : ''} onClick={() => { setActiveTab('fees'); loadFees(); }}>Course fee</button>
        <button className={activeTab === 'notifications' ? 'active' : ''} onClick={() => { setActiveTab('notifications'); loadNotifications(); }}>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => { setActiveTab('profile'); loadProfile(); }}>My profile</button>
      </nav>

      {activeTab === 'jobs' && <>
      <div className="cj-toolbar">
        <input
          className="cj-search"
          aria-label="Search open jobs"
          placeholder="Search by title, department, skill, or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {!loading && <span className="cj-count">{visibleJobs.length} open {visibleJobs.length === 1 ? 'position' : 'positions'}</span>}
      </div>

      {error && (
        <div className="cj-error" role="alert">
          <p>{error}</p>
          <button className="cj-retry" onClick={loadJobs}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="cj-empty">Loading open jobs…</div>
      ) : !error && visibleJobs.length === 0 ? (
        <div className="cj-empty">
          {query ? 'No open jobs match your search.' : 'There are no open positions right now.'}
        </div>
      ) : (
        <section className="cj-grid">
          {visibleJobs.map((job) => (
            <article className="cj-card" key={job.id}>
              <div className="cj-dept">{job.department_name}</div>
              <h2>{job.job_title}</h2>
              <div className="cj-meta">
                <span className="cj-chip">{pretty(job.job_type)}</span>
                <span className="cj-chip">{job.location}</span>
              </div>
              <p>{job.job_description}</p>
              <div className="cj-details">
                <div><strong>Experience:</strong> {job.experience_required}</div>
                <div><strong>Qualification:</strong> {job.qualification}</div>
                {job.salary_range && <div><strong>Salary range:</strong> {job.salary_range}</div>}
                <div><strong>Vacancies:</strong> {job.vacancies}</div>
                <div><strong>Apply by:</strong> {job.application_deadline}</div>
              </div>
              {job.skills_required && <p><strong>Skills:</strong> {job.skills_required}</p>}
              <button className="cj-apply" onClick={() => { setApplyingJob(job); setError(''); setNotice(''); }}>Apply now</button>
            </article>
          ))}
        </section>
      )}
      </>}

      {activeTab === 'applications' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadApplications}>Try again</button></div> : loading ? <div className="cj-empty">Loading your applications…</div> : applications.length === 0 ? <div className="cj-empty">You have not applied for any jobs yet.</div> : <section className="cj-grid">{applications.map((application) => <article className="cj-card" key={application.id}><div className="cj-dept">{application.candidate_name}</div><h2>{application.job_title}</h2><div className="cj-meta"><span className="cj-chip">{pretty(application.application_status)}</span></div><div className="cj-details"><strong>Applied:</strong> {new Date(application.applied_date).toLocaleDateString()}</div>{application.cover_letter && <p>{application.cover_letter}</p>}{['applied', 'under_review'].includes(application.application_status) && <button className="cj-cancel" onClick={() => withdrawApplication(application)}>Withdraw application</button>}</article>)}</section>)}

      {activeTab === 'interviews' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadInterviews}>Try again</button></div> : loading ? <div className="cj-empty">Loading your interviews…</div> : interviews.length === 0 ? <div className="cj-empty">No interviews have been scheduled for you yet.</div> : <section className="cj-grid">{interviews.map((interview) => <article className="cj-card" key={interview.id}><div className="cj-dept">{pretty(interview.interview_type)} interview</div><h2>{interview.job_title}</h2><div className="cj-meta"><span className="cj-chip">{pretty(interview.interview_status)}</span></div><div className="cj-details"><div><strong>Date:</strong> {new Date(`${interview.interview_date}T${interview.interview_time}`).toLocaleString()}</div>{interview.interviewer_name && <div><strong>Interviewer:</strong> {interview.interviewer_name}</div>}{interview.location && <div><strong>Location:</strong> {interview.location}</div>}{interview.meeting_link && <div><strong>Meeting:</strong> <a href={interview.meeting_link} target="_blank" rel="noreferrer">Join interview</a></div>}{interview.interview_status === 'completed' && interview.feedback && <div><strong>Feedback:</strong> {interview.feedback}</div>}{interview.interview_status === 'completed' && interview.rating && <div><strong>Rating:</strong> {interview.rating}</div>}</div></article>)}</section>)}

      {activeTab === 'offers' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadOffers}>Try again</button></div> : loading ? <div className="cj-empty">Loading your offers…</div> : offers.length === 0 ? <div className="cj-empty">No offers are available yet.</div> : <section className="cj-grid">{offers.map((offer) => <article className="cj-card" key={offer.id}><div className="cj-dept">Offer details</div><h2>{offer.job_title}</h2><div className="cj-meta"><span className="cj-chip">{pretty(offer.placement_status)}</span></div><div className="cj-details">{offer.offer_date && <div><strong>Offer date:</strong> {offer.offer_date}</div>}{offer.joining_date && <div><strong>Joining date:</strong> {offer.joining_date}</div>}{offer.offered_salary && <div><strong>Offered salary:</strong> {offer.offered_salary}</div>}</div>{offer.placement_status === 'offered' && <div className="cj-meta"><button className="cj-apply" onClick={() => respondToOffer(offer, 'accepted')}>Accept offer</button><button className="cj-cancel" onClick={() => { if (window.confirm('Are you sure you want to decline this offer?')) respondToOffer(offer, 'rejected'); }}>Decline offer</button></div>}</article>)}</section>)}

      {activeTab === 'fees' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadFees}>Try again</button></div> : loading || !fees ? <div className="cj-empty">Loading your fee details…</div> : <section className="cj-fees-page">
        <header className="cj-fees-header">
          <div><p className="cj-fees-eyebrow">YOUR ACCOUNT</p><h2>Course fee and payment tracking</h2><p>Review your course fee, payments received, and remaining balance.</p></div>
          <div className="cj-fees-role">
            <strong>{fees.candidate.course?.name || 'Course not assigned'}</strong>
            {fees.candidate.course?.duration && <span>{fees.candidate.course.duration}</span>}
            {(fees.candidate.role || fees.candidate.department) && <span>{[fees.candidate.role, fees.candidate.department].filter(Boolean).join(' · ')}</span>}
          </div>
        </header>
        <div className="cj-fee-summary">
          <article className="cj-fee-card cj-fee-total"><span>Course fee</span><strong>{money(feeTotal)}</strong><small>Full course fee assigned to your account</small></article>
          <article className="cj-fee-card cj-fee-paid"><span>Paid so far</span><strong>{money(feePaid)}</strong><small>{fees.payments.length} payment{fees.payments.length === 1 ? '' : 's'} recorded</small></article>
          <article className="cj-fee-card cj-fee-due"><span>Balance due</span><strong>{money(feeDue)}</strong><small>{feeDue <= 0 && feeTotal > 0 ? 'Your fee is fully paid' : 'Remaining amount'}</small></article>
        </div>
        <section className="cj-fee-progress-panel" aria-label="Fee payment progress">
          <div className="cj-fee-progress-heading"><div><strong>Course fee payment progress</strong><span>{feeProgress}% of your course fee paid</span></div><strong>{money(feePaid)} <small>of {money(feeTotal)}</small></strong></div>
          <div className="cj-fee-progress-track"><span style={{ width: `${feeProgress}%` }} /></div>
        </section>
        <section className="cj-payment-history">
          <div className="cj-fee-section-heading"><div><p className="cj-fees-eyebrow">PAYMENT RECORDS</p><h3>Payment history</h3></div><span>{fees.payments.length} total</span></div>
          {fees.payments.length ? <div className="cj-payment-table-scroll"><table className="cj-payment-table"><thead><tr><th>Date</th><th>Amount paid</th><th>Note</th></tr></thead><tbody>{fees.payments.map((payment) => <tr key={payment.id}><td>{new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{money(payment.amount)}</td><td>{payment.note || '—'}</td></tr>)}</tbody></table></div> : <p className="cj-fees-empty">No payments have been recorded yet.</p>}
          <p className="cj-fees-footnote">Payment records are maintained by HR. Contact your administrator if you have a question about your balance.</p>
        </section>
        <section className="cj-course-catalog">
          <div className="cj-fee-section-heading"><div><p className="cj-fees-eyebrow">AVAILABLE COURSES</p><h3>Courses and fees</h3></div><span>{catalogCourses.length} available</span></div>
          {catalogCourses.length ? <div className="cj-course-catalog-grid">{catalogCourses.map((course) => {
            const assigned = fees.candidate.course?.id === course.id;
            return <article className={`cj-course-card${assigned ? ' assigned' : ''}`} key={course.id}>
              <div className="cj-course-card-top"><h4>{course.course_name}</h4>{assigned && <span className="cj-course-assigned">Your course</span>}</div>
              {course.duration && <p className="cj-course-duration">{course.duration}</p>}
              {course.description && <p className="cj-course-description">{course.description}</p>}
              <strong className="cj-course-price">{money(course.course_fee)}</strong>
            </article>;
          })}</div> : <p className="cj-fees-empty">No courses are listed yet. Please check with HR for course details.</p>}
        </section>
      </section>)}

      {activeTab === 'notifications' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadNotifications}>Try again</button></div> : loading ? <div className="cj-empty">Loading notifications…</div> : notifications.length === 0 ? <div className="cj-empty">You have no notifications yet.</div> : <section><div className="cj-toolbar"><strong>{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</strong>{unreadCount > 0 && <button className="cj-cancel" onClick={markAllNotificationsRead}>Mark all as read</button>}</div>{notifications.map((notification) => <article className={`cj-notification${notification.is_read ? '' : ' unread'}`} key={notification.id}><div className="cj-notification-head"><strong>{notification.title}</strong><time>{new Date(notification.created_at).toLocaleString()}</time></div><p>{notification.message}</p><div className="cj-notification-head"><span className="cj-chip">{pretty(notification.category)}</span>{!notification.is_read && <button onClick={() => markNotificationRead(notification.id)}>Mark as read</button>}</div></article>)}</section>)}

      {activeTab === 'profile' && (error ? <div className="cj-error" role="alert">{error}<button className="cj-retry" onClick={loadProfile}>Try again</button></div> : loading || !profile ? <div className="cj-empty">Loading your profile…</div> : <form className="cj-profile-form" onSubmit={saveProfile}>
        <h2 className="cj-profile-wide">My candidate profile</h2>
        <label>First name<input name="first_name" required value={profile.first_name || ''} onChange={updateProfile} /></label>
        <label>Last name<input name="last_name" required value={profile.last_name || ''} onChange={updateProfile} /></label>
        <label>Email<input value={profile.email || ''} readOnly /></label>
        <label>Phone<input name="phone" required value={profile.phone || ''} onChange={updateProfile} /></label>
        <label>Date of birth<input name="date_of_birth" type="date" value={profile.date_of_birth || ''} onChange={updateProfile} /></label>
        <label>Gender<select name="gender" value={profile.gender || ''} onChange={updateProfile}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
        <label>City<input name="city" value={profile.city || ''} onChange={updateProfile} /></label>
        <label>State<input name="state" value={profile.state || ''} onChange={updateProfile} /></label>
        <label className="cj-profile-wide">Address<textarea name="address" rows="2" value={profile.address || ''} onChange={updateProfile} /></label>
        <label>Education<input name="education" value={profile.education || ''} onChange={updateProfile} /></label>
        <label>College<input name="college" value={profile.college || ''} onChange={updateProfile} /></label>
        <label>Degree<input name="degree" value={profile.degree || ''} onChange={updateProfile} /></label>
        <label>Graduation year<input name="graduation_year" type="number" min="1" value={profile.graduation_year || ''} onChange={updateProfile} /></label>
        <label>Experience (years)<input name="experience" type="number" min="0" max="999.9" step="0.1" value={profile.experience || '0'} onChange={updateProfile} /></label>
        <label className="cj-profile-wide">Skills<textarea name="skills" rows="3" value={profile.skills || ''} onChange={updateProfile} placeholder="Separate skills with commas" /></label>
        <label className="cj-profile-wide">Resume (PDF, DOC, or DOCX; max 5 MB)<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => { setProfileResume(event.target.files?.[0] || null); setRemoveResume(false); }} />{profile.resume && <span>Current resume: <a href={`http://localhost:8000${profile.resume}`} target="_blank" rel="noreferrer">Open resume</a><button className="cj-cancel" type="button" onClick={() => { setRemoveResume(true); setProfileResume(null); }}>Remove current resume</button></span>}{removeResume && <span>Current resume will be removed when you save.</span>}</label>
        <div className="cj-profile-wide"><button className="cj-apply" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button></div>
      </form>)}

      {applyingJob && <div className="cj-modal-backdrop" role="presentation"><section className="cj-modal" role="dialog" aria-modal="true" aria-labelledby="apply-title"><h2 id="apply-title">Apply for {applyingJob.job_title}</h2><form onSubmit={submitApplication}><label>Cover letter (optional)<textarea rows="5" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Tell us why you are a good fit" /></label><label>Resume (optional)<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setResume(event.target.files?.[0] || null)} /></label><div className="cj-modal-actions"><button className="cj-cancel" type="button" onClick={() => setApplyingJob(null)}>Cancel</button><button className="cj-apply" type="submit" disabled={submittingApplication}>{submittingApplication ? 'Submitting…' : 'Submit application'}</button></div></form></section></div>}
    </main>
  );
}





