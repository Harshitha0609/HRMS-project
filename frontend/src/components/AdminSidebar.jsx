import { apiFetch } from '../apiFetch';
import { NavLink, useNavigate } from 'react-router-dom';

function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiFetch('http://localhost:8000/api/accounts/logout/', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      navigate('/', { replace: true });
      window.location.reload();
    }
  };

  return (
    <aside className="admin-sidebar">
      <h2>HRMS</h2>
      <nav>
        <NavLink to="/admin-dashboard" end>Dashboard</NavLink>
        <NavLink to="/admin-dashboard/candidates">Candidates</NavLink>
        <NavLink to="/admin-dashboard/jobs">Jobs</NavLink>
        <NavLink to="/admin-dashboard/applications">Applications</NavLink>
        <NavLink to="/admin-dashboard/interviews">Interviews</NavLink>
        <NavLink to="/admin-dashboard/placements">Placements</NavLink>
        <NavLink to="/admin-dashboard/employees">Employees</NavLink>
        <NavLink to="/admin-dashboard/departments">Departments</NavLink>
        <NavLink to="/admin-dashboard/courses">Courses</NavLink>
        <NavLink to="/admin-dashboard/attendance">Attendance</NavLink>
        <NavLink to="/admin-dashboard/leave">Leave</NavLink>
        <NavLink to="/admin-dashboard/payroll">Payroll</NavLink>
        <NavLink to="/admin-dashboard/reports">Reports</NavLink>
        <button type="button" onClick={handleLogout}>Logout</button>
      </nav>
    </aside>
  );
}

export default AdminSidebar;


