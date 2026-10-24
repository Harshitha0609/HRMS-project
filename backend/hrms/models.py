from django.db import models
from django.utils import timezone


class Department(models.Model):

    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    )

    department_name = models.CharField(max_length=100)

    department_code = models.CharField(
        max_length=20,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.department_name


class Course(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    )

    course_name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True)
    duration = models.CharField(max_length=80, blank=True)
    course_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course_name']

    def __str__(self):
        return self.course_name


class Candidate(models.Model):

    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    )

    STATUS_CHOICES = (
        ('new', 'New'),
        ('shortlisted', 'Shortlisted'),
        ('interview', 'Interview'),
        ('selected', 'Selected'),
        ('rejected', 'Rejected'),
        ('hired', 'Hired'),
    )

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100
    )

    email = models.EmailField(
        unique=True
    )

    phone = models.CharField(
        max_length=20
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name='candidates',
        null=True,
        blank=True,
    )

    target_job = models.ForeignKey(
        'Job',
        on_delete=models.SET_NULL,
        related_name='target_candidates',
        null=True,
        blank=True,
    )

    course_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    gender = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        blank=True
    )

    address = models.TextField(
        blank=True
    )

    city = models.CharField(
        max_length=100,
        blank=True
    )

    state = models.CharField(
        max_length=100,
        blank=True
    )

    education = models.CharField(
        max_length=200,
        blank=True
    )

    college = models.CharField(
        max_length=200,
        blank=True
    )

    degree = models.CharField(
        max_length=100,
        blank=True
    )

    graduation_year = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    skills = models.TextField(
        blank=True
    )

    experience = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=0
    )

    resume = models.FileField(
        upload_to='resumes/',
        blank=True,
        null=True
    )

    profile_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class CandidatePayment(models.Model):
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.PROTECT,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.localdate)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-id']

    def __str__(self):
        return f'{self.candidate} - {self.amount} - {self.payment_date}'


class Job(models.Model):

    JOB_TYPE_CHOICES = (
        ('full_time', 'Full Time'),
        ('part_time', 'Part Time'),
        ('internship', 'Internship'),
        ('contract', 'Contract'),
        ('remote', 'Remote'),
        ('hybrid', 'Hybrid'),
    )

    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('closed', 'Closed'),
    )

    job_title = models.CharField(
        max_length=200
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='jobs'
    )

    job_type = models.CharField(
        max_length=30,
        choices=JOB_TYPE_CHOICES
    )

    location = models.CharField(
        max_length=200
    )

    experience_required = models.CharField(
        max_length=100
    )

    qualification = models.CharField(
        max_length=200
    )

    skills_required = models.TextField()

    salary_range = models.CharField(
        max_length=100,
        blank=True
    )

    job_description = models.TextField()

    responsibilities = models.TextField(
        blank=True
    )

    vacancies = models.PositiveIntegerField(
        default=1
    )

    application_deadline = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.job_title


class Application(models.Model):

    STATUS_CHOICES = (
        ('applied', 'Applied'),
        ('under_review', 'Under Review'),
        ('shortlisted', 'Shortlisted'),
        ('interview', 'Interview'),
        ('selected', 'Selected'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    )

    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='applications'
    )

    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name='applications'
    )

    applied_date = models.DateTimeField(
        auto_now_add=True
    )

    resume = models.FileField(
        upload_to='application_resumes/',
        blank=True,
        null=True
    )

    cover_letter = models.TextField(
        blank=True
    )

    application_status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='applied'
    )

    recruiter_remarks = models.TextField(
        blank=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.candidate} - {self.job}"


class Employee(models.Model):

    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    )

    EMPLOYMENT_TYPE_CHOICES = (
        ('full_time', 'Full Time'),
        ('part_time', 'Part Time'),
        ('contract', 'Contract'),
        ('intern', 'Intern'),
    )

    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('notice', 'On Notice'),
        ('resigned', 'Resigned'),
        ('terminated', 'Terminated'),
    )

    employee_id = models.CharField(
        max_length=30,
        unique=True
    )

    employee_code = models.CharField(
        max_length=30,
        unique=True
    )

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100
    )

    email = models.EmailField(
        unique=True
    )

    phone = models.CharField(
        max_length=20
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    gender = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        blank=True
    )

    address = models.TextField(
        blank=True
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='employees'
    )

    designation = models.CharField(
        max_length=100
    )

    joining_date = models.DateField()

    employment_type = models.CharField(
        max_length=30,
        choices=EMPLOYMENT_TYPE_CHOICES
    )

    salary = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='team_members'
    )

    employee_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.employee_code} - {self.first_name} {self.last_name}"


class Interview(models.Model):

    INTERVIEW_TYPE_CHOICES = (
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('phone', 'Phone'),
        ('technical', 'Technical'),
        ('hr', 'HR'),
        ('managerial', 'Managerial'),
    )

    STATUS_CHOICES = (
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('rescheduled', 'Rescheduled'),
    )

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='interviews'
    )

    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='interviews'
    )

    interviewer = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_interviews'
    )

    interview_type = models.CharField(
        max_length=30,
        choices=INTERVIEW_TYPE_CHOICES
    )

    interview_date = models.DateField()

    interview_time = models.TimeField()

    meeting_link = models.URLField(
        blank=True
    )

    location = models.CharField(
        max_length=200,
        blank=True
    )

    interview_status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='scheduled'
    )

    feedback = models.TextField(
        blank=True
    )

    rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.candidate} - {self.interview_date}"


class Attendance(models.Model):

    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
        ('work_from_home', 'Work From Home'),
        ('leave', 'Leave'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )

    date = models.DateField()

    check_in = models.TimeField(
        null=True,
        blank=True
    )

    check_out = models.TimeField(
        null=True,
        blank=True
    )

    working_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='present'
    )

    remarks = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.employee} - {self.date}"


class Leave(models.Model):

    LEAVE_TYPE_CHOICES = (
        ('casual', 'Casual'),
        ('sick', 'Sick'),
        ('earned', 'Earned'),
        ('emergency', 'Emergency'),
        ('maternity', 'Maternity'),
        ('paternity', 'Paternity'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )

    leave_type = models.CharField(
        max_length=30,
        choices=LEAVE_TYPE_CHOICES
    )

    start_date = models.DateField()

    end_date = models.DateField()

    number_of_days = models.DecimalField(
        max_digits=5,
        decimal_places=1
    )

    reason = models.TextField()

    applied_date = models.DateTimeField(
        auto_now_add=True
    )

    approved_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leaves'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    remarks = models.TextField(
        blank=True
    )

    def __str__(self):
        return f"{self.employee} - {self.leave_type}"


class Payroll(models.Model):

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payroll_records'
    )

    month = models.PositiveIntegerField()

    year = models.PositiveIntegerField()

    basic_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    allowances = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    bonuses = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    net_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    payment_date = models.DateField(
        null=True,
        blank=True
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.employee} - {self.month}/{self.year}"
    
class Placement(models.Model):
    STATUS_CHOICES = (
        ('offered', 'Offered'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('joined', 'Joined'),
        ('withdrawn', 'Withdrawn'),
    )

    application = models.OneToOneField(
        Application,
        on_delete=models.PROTECT,
        related_name='placement'
    )

    offer_date = models.DateField(
        null=True,
        blank=True
    )

    joining_date = models.DateField(
        null=True,
        blank=True
    )

    offered_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    placement_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='offered'
    )

    remarks = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f'{self.application.candidate} - {self.application.job}'
