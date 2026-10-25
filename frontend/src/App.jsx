import { apiFetch } from './apiFetch';
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import AdminDashboard from './pages/AdminDashboard';
import CandidateDashboard from './pages/CandidateDashboard';
import AdminLayout from './AdminLayout';

import Candidates from './pages/admin/Candidates';
import Jobs from './pages/admin/Jobs';
import Applications from './pages/admin/Applications';
import Interviews from './pages/admin/Interviews';
import Placements from './pages/admin/Placements';
import Employees from './pages/admin/Employees';
import Departments from './pages/admin/Departments';
import Courses from './pages/admin/Courses';
import Attendance from './pages/admin/Attendance';
import Leave from './pages/admin/Leave';
import Payroll from './pages/admin/Payroll';
import Reports from './pages/admin/Reports';
import './App.css';

const ACCOUNTS_API = 'http://localhost:8000/api/accounts/';

function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <div className="login-password-control">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder="Enter password"
        />
        <button
          className="login-password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

function Login({ onAuthenticated }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [education, setEducation] = useState('');
  const [college, setCollege] = useState('');
  const [degree, setDegree] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('0');
  const [message, setMessage] = useState('');
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!registering) return undefined;
    let active = true;
    setCoursesLoading(true);
    setCoursesError('');

    apiFetch(ACCOUNTS_API + 'courses/')
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data.error || 'Could not load available courses.');
        return data;
      })
      .then((data) => {
        if (active) setCourses(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active) setCoursesError(error.message || 'Could not load available courses.');
      })
      .finally(() => {
        if (active) setCoursesLoading(false);
      });

    return () => { active = false; };
  }, [registering]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    if (registering) {
      formData.append('email', email);
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('phone', phone);
      formData.append('course', courseId);
      formData.append('password_confirm', passwordConfirm);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('gender', gender);
      formData.append('date_of_birth', dateOfBirth);
      formData.append('address', address);
      formData.append('education', education);
      formData.append('college', college);
      formData.append('degree', degree);
      formData.append('graduation_year', graduationYear);
      formData.append('skills', skills);
      formData.append('experience', experience);
    }

    try {
      const response = await apiFetch(ACCOUNTS_API + (registering ? 'register/' : 'login/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessageSuccess(false);
        setMessage(data.error || 'Unable to log in.');
        return;
      }

      if (registering) {
        setMessageSuccess(true);
        setMessage(data.message || 'Registration submitted. Your account is waiting for admin approval.');
        setRegistering(false);
        setPassword('');
        setPasswordConfirm('');
        setCourseId('');
        setShowPassword(false);
        setShowPasswordConfirm(false);
        return;
      }

      onAuthenticated(data);
      if (data.role === 'admin') navigate('/admin-dashboard');
      else if (data.role === 'candidate') navigate('/candidate-dashboard');
      else setMessage('This account has no valid role.');
    } catch {
      setMessage('Unable to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setRegistering((value) => !value);
    setMessage('');
    setMessageSuccess(false);
    setPassword('');
    setPasswordConfirm('');
    setCourseId('');
    setShowPassword(false);
    setShowPasswordConfirm(false);
  };

  return (
    <main className="login-page">
      
      <section className="login-card">
        <h1>{registering ? 'Candidate Registration' : 'HRMS Login'}</h1>
        <p>{registering ? 'Create a candidate account to continue.' : 'Sign in with your account.'}</p>
        <form onSubmit={handleLogin}>
          {registering && <>
            <div className="login-field"><label htmlFor="register-first-name">First name</label><input id="register-first-name" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-last-name">Last name</label><input id="register-last-name" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-email">Email</label><input id="register-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-phone">Phone</label><input id="register-phone" type="tel" required autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
            <div className="login-field">
              <label htmlFor="register-course">Choose a course</label>
              <select id="register-course" required value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={coursesLoading || Boolean(coursesError) || courses.length === 0}>
                <option value="">{coursesLoading ? 'Loading courses…' : 'Select a course'}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_name} · ₹{Number(course.course_fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
              {coursesError ? <small className="login-course-message error">{coursesError}</small> : courses.length === 0 && !coursesLoading ? <small className="login-course-message">No active courses are available yet. Please contact the administrator.</small> : courseId && <small className="login-course-message">Your selected course fee is ₹{Number(courses.find((course) => String(course.id) === courseId)?.course_fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.</small>}
            </div>
            <div className="login-field"><label htmlFor="register-city">City</label><input id="register-city" value={city} onChange={(event) => setCity(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-state">State</label><input id="register-state" value={state} onChange={(event) => setState(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-gender">Gender</label><select id="register-gender" value={gender} onChange={(event) => setGender(event.target.value)}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>
            <div className="login-field"><label htmlFor="register-dob">Date of birth</label><input id="register-dob" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-address">Address</label><textarea id="register-address" rows="2" value={address} onChange={(event) => setAddress(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-education">Education</label><input id="register-education" value={education} onChange={(event) => setEducation(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-college">College</label><input id="register-college" value={college} onChange={(event) => setCollege(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-degree">Degree</label><input id="register-degree" value={degree} onChange={(event) => setDegree(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-graduation-year">Graduation year</label><input id="register-graduation-year" type="number" min="1" value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-experience">Experience (years)</label><input id="register-experience" type="number" min="0" max="999.9" step="0.1" value={experience} onChange={(event) => setExperience(event.target.value)} /></div>
            <div className="login-field"><label htmlFor="register-skills">Skills</label><textarea id="register-skills" rows="3" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Separate skills with commas" /></div>
          </>}
          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input id="login-username" type="text" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter username" />
          </div>
          <PasswordField id="login-password" label="Password" value={password} onChange={(event) => setPassword(event.target.value)} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} autoComplete={registering ? 'new-password' : 'current-password'} />
          {registering && <PasswordField id="register-password-confirm" label="Confirm password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} visible={showPasswordConfirm} onToggle={() => setShowPasswordConfirm((visible) => !visible)} autoComplete="new-password" />}
          {message && <div className={messageSuccess ? 'login-success' : 'login-error'} role={messageSuccess ? 'status' : 'alert'}>{message}</div>}
          <button className="login-submit" type="submit" disabled={submitting || (registering && (coursesLoading || Boolean(coursesError) || courses.length === 0 || !courseId))}>{submitting ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create candidate account' : 'Sign in')}</button>
        </form>
        <div className="login-toggle">{registering ? 'Already registered? ' : 'New candidate? '}<button type="button" onClick={toggleMode}>{registering ? 'Sign in' : 'Create an account'}</button></div>
      </section>
    </main>
  );
}

function RequireRole({ user, role, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin-dashboard' : '/candidate-dashboard'} replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(ACCOUNTS_API + 'session/', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => { if (active) setUser(data?.authenticated ? data : null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setCheckingSession(false); });

    return () => { active = false; };
  }, []);

  if (checkingSession) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Checking login…</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Login onAuthenticated={setUser} />}
        />

        <Route
          path="/admin-dashboard"
          element={
            <RequireRole user={user} role="admin">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="applications" element={<Applications />} />
          <Route path="interviews" element={<Interviews />} />
          <Route path="placements" element={<Placements />} />
          <Route path="employees" element={<Employees />} />
          <Route path="departments" element={<Departments />} />
          <Route path="courses" element={<Courses />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="leave" element={<Leave />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/candidate-dashboard"
          element={
            <RequireRole user={user} role="candidate">
              <CandidateDashboard />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


