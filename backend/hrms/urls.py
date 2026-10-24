from django.urls import path

from .views import (
    department_api,
    department_detail_api,
    course_api,
    course_detail_api,
    candidate_api,
    candidate_detail_api,
    job_api,
    job_detail_api,
    application_api,
    application_detail_api,
    interview_api,
    interview_detail_api,
    placement_api,
    placement_detail_api,
    payroll_api,
    payroll_detail_api,
    reports_dashboard_api,
    candidate_payments_api,
)

urlpatterns = [
    path('departments/', department_api, name='department-api'),
    path('courses/', course_api, name='course-api'),
    path('courses/<int:course_id>/', course_detail_api, name='course-detail-api'),
    path(
        'departments/<int:department_id>/',
        department_detail_api,
        name='department-detail-api'
    ),

    path('candidates/', candidate_api, name='candidate-api'),
    path('candidate-payments/', candidate_payments_api, name='candidate-payments-api'),
    path(
        'candidates/<int:candidate_id>/',
        candidate_detail_api,
        name='candidate-detail-api'
    ),

    path('jobs/', job_api, name='job-api'),
    path('jobs/<int:job_id>/', job_detail_api, name='job-detail-api'),

    path('applications/', application_api, name='application-api'),
    path(
        'applications/<int:application_id>/',
        application_detail_api,
        name='application-detail-api'
    ),

    path('interviews/', interview_api, name='interview-api'),
    path(
        'interviews/<int:interview_id>/',
        interview_detail_api,
        name='interview-detail-api'
    ),
    path(
    'reports/dashboard/',
    reports_dashboard_api,
    name='reports-dashboard-api'
),
    path('placements/', placement_api, name='placement-api'),
    path('placements/<int:placement_id>/',
         placement_detail_api, name='placement-detail-api'
),
path('payroll/', payroll_api, name='payroll-api'),
path(
    'payroll/<int:payroll_id>/',
    payroll_detail_api,
    name='payroll-detail-api'
),
]
from .views import attendance_api, attendance_detail_api, employee_options_api
urlpatterns += [
    path('employees/options/', employee_options_api, name='employee-options-api'),
    path('attendance/', attendance_api, name='attendance-api'),
    path('attendance/<int:attendance_id>/', attendance_detail_api, name='attendance-detail-api'),
]
from .views import leave_api, leave_detail_api
urlpatterns += [
    path('leaves/', leave_api, name='leave-api'),
    path('leaves/<int:leave_id>/', leave_detail_api, name='leave-detail-api'),
]

from .views import employee_api, employee_detail_api
urlpatterns += [
    path('employees/', employee_api, name='employee-api'),
    path('employees/<int:employee_id>/', employee_detail_api, name='employee-detail-api'),
]
