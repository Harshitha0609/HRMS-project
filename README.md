# HRMS Platform

HRMS platform for recruitment, candidate management, interviews, placements, employee records, attendance, leave, payroll, course-fee tracking, and analytics.

## Local setup

### Backend

1. Open PowerShell in `backend`.
2. Create and activate a virtual environment if needed:

   ```powershell
   python -m venv ..\venv
   ..\venv\Scripts\Activate.ps1
   ```

3. Install backend packages and create your local settings file:

   ```powershell
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

4. Update `backend/.env` with your local MySQL database details and a private Django secret key, then run:

   ```powershell
   python manage.py migrate
   python manage.py runserver
   ```

### Frontend

In a second terminal, open `frontend` and run:

```powershell
npm install
npm run dev
```

The local frontend uses Vite at `http://localhost:5173` and the Django API at `http://localhost:8000`.

## GitHub and hosting

GitHub stores this project's source code. Hosting the working application also requires a Django host, a MySQL database, and a frontend host. Keep production secrets and database credentials in the hosting provider's environment settings; do not commit `backend/.env`, database files, candidate data, or uploaded resumes.
