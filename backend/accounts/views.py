import json
from pathlib import Path

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal, InvalidOperation

from hrms.models import Application, Candidate, Course, Interview, Placement
from .models import Notification


def user_payload(user):
    payload = {
        'username': user.username,
        'role': user.role,
    }
    if user.role == 'candidate' and user.email:
        payload['candidate_id'] = Candidate.objects.filter(
            email__iexact=user.email
        ).values_list('id', flat=True).first()
    return payload


@csrf_exempt
def candidate_profile_view(request):
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    candidate = Candidate.objects.filter(
        email__iexact=request.user.email
    ).first()
    if candidate is None:
        return JsonResponse({'error': 'Candidate profile was not found.'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'id': candidate.id,
            'first_name': candidate.first_name,
            'last_name': candidate.last_name,
            'email': candidate.email,
            'phone': candidate.phone,
            'date_of_birth': candidate.date_of_birth.isoformat() if candidate.date_of_birth else '',
            'gender': candidate.gender,
            'address': candidate.address,
            'city': candidate.city,
            'state': candidate.state,
            'education': candidate.education,
            'college': candidate.college,
            'degree': candidate.degree,
            'graduation_year': candidate.graduation_year or '',
            'skills': candidate.skills,
            'experience': str(candidate.experience),
            'resume': candidate.resume.url if candidate.resume else None,
        })

    if request.method != 'PUT':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        if 'application/json' in (request.content_type or ''):
            body = json.loads(request.body or '{}')
        else:
            body = request.POST

        allowed_fields = {
            'first_name', 'last_name', 'phone', 'date_of_birth', 'gender',
            'address', 'city', 'state', 'education', 'college', 'degree',
            'graduation_year', 'skills', 'experience',
        }
        unexpected = set(body.keys()) - allowed_fields - {'remove_resume'}
        if unexpected:
            return JsonResponse({'error': 'One or more profile fields cannot be changed.'}, status=400)

        for field in ('first_name', 'last_name', 'phone', 'address', 'city', 'state', 'education', 'college', 'degree', 'skills'):
            if field in body:
                setattr(candidate, field, str(body.get(field, '')).strip())

        if 'gender' in body:
            gender = str(body.get('gender', '')).strip()
            if gender not in {'', 'female', 'male', 'other'}:
                return JsonResponse({'error': 'Select a valid gender.'}, status=400)
            candidate.gender = gender

        if 'date_of_birth' in body:
            date_value = str(body.get('date_of_birth', '')).strip()
            candidate.date_of_birth = parse_date(date_value) if date_value else None
            if date_value and candidate.date_of_birth is None:
                return JsonResponse({'error': 'Enter date of birth as YYYY-MM-DD.'}, status=400)

        if 'graduation_year' in body:
            year_value = str(body.get('graduation_year', '')).strip()
            candidate.graduation_year = int(year_value) if year_value else None
            if candidate.graduation_year is not None and candidate.graduation_year < 1:
                return JsonResponse({'error': 'Enter a valid graduation year.'}, status=400)

        if 'experience' in body:
            candidate.experience = Decimal(str(body.get('experience', '0') or '0'))
            if candidate.experience < 0 or candidate.experience > 999.9:
                return JsonResponse({'error': 'Experience must be between 0 and 999.9 years.'}, status=400)

        resume = request.FILES.get('resume')
        if resume:
            if Path(resume.name).suffix.lower() not in {'.pdf', '.doc', '.docx'}:
                return JsonResponse({'error': 'Resume must be a PDF, DOC, or DOCX file.'}, status=400)
            if resume.size > 5 * 1024 * 1024:
                return JsonResponse({'error': 'Resume must be 5 MB or smaller.'}, status=400)
            candidate.resume = resume
        elif str(body.get('remove_resume', '')).lower() in {'true', '1', 'yes'}:
            candidate.resume = None

        candidate.save()
        if 'first_name' in body or 'last_name' in body:
            request.user.first_name = candidate.first_name
            request.user.last_name = candidate.last_name
            request.user.save(update_fields=['first_name', 'last_name'])

        return JsonResponse({'message': 'Profile updated successfully.'})
    except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
        return JsonResponse({'error': 'Invalid profile data. Check the date and numeric fields.'}, status=400)


def candidate_fees_view(request):
    """Return only the signed-in candidate's fee balance and payment history."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    candidate = Candidate.objects.select_related(
        'target_job__department', 'course'
    ).annotate(
        paid_total=Sum('payments__amount')
    ).filter(
        email__iexact=request.user.email
    ).first()
    if candidate is None:
        return JsonResponse({'error': 'Candidate profile was not found.'}, status=404)

    course_fee = candidate.course_fee or Decimal('0.00')
    paid_amount = candidate.paid_total or Decimal('0.00')
    due_amount = max(course_fee - paid_amount, Decimal('0.00'))
    payments = candidate.payments.all()
    return JsonResponse({
        'candidate': {
            'id': candidate.id,
            'name': f'{candidate.first_name} {candidate.last_name}'.strip(),
            'role': candidate.target_job.job_title if candidate.target_job_id else '',
            'department': (
                candidate.target_job.department.department_name
                if candidate.target_job_id else ''
            ),
            'course': ({
                'id': candidate.course_id,
                'name': candidate.course.course_name,
                'duration': candidate.course.duration,
                'catalog_fee': f'{candidate.course.course_fee:.2f}',
            } if candidate.course_id else None),
        },
        'course_fee': f'{course_fee:.2f}',
        'total_fee': f'{course_fee:.2f}',  # Backward-compatible alias.
        'paid_amount': f'{paid_amount:.2f}',
        'due_amount': f'{due_amount:.2f}',
        'payments': [
            {
                'id': payment.id,
                'amount': f'{payment.amount:.2f}',
                'payment_date': payment.payment_date.isoformat(),
                'note': payment.note,
            }
            for payment in payments
        ],
    })


def candidate_courses_view(request):
    """List public course options for candidate registration and fee views."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed.'}, status=405)

    courses = Course.objects.filter(status='active').order_by('course_name')
    return JsonResponse([
        {
            'id': course.id,
            'course_name': course.course_name,
            'description': course.description,
            'duration': course.duration,
            'course_fee': f'{course.course_fee:.2f}',
        }
        for course in courses
    ], safe=False)


def candidate_interviews_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    interviews = Interview.objects.filter(
        candidate__email__iexact=request.user.email
    ).select_related(
        'application__job',
        'interviewer',
    ).order_by('-interview_date', '-interview_time', '-id')

    return JsonResponse([
        {
            'id': interview.id,
            'job_title': interview.application.job.job_title,
            'interview_type': interview.interview_type,
            'interview_date': interview.interview_date.isoformat(),
            'interview_time': interview.interview_time.isoformat(),
            'meeting_link': interview.meeting_link,
            'location': interview.location,
            'interview_status': interview.interview_status,
            'interviewer_name': (
                f'{interview.interviewer.first_name} {interview.interviewer.last_name}'.strip()
                if interview.interviewer else None
            ),
            'feedback': interview.feedback,
            'rating': str(interview.rating) if interview.rating is not None else None,
        }
        for interview in interviews
    ], safe=False)


def candidate_offers_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    placements = Placement.objects.filter(
        application__candidate__email__iexact=request.user.email
    ).select_related(
        'application__job',
    ).order_by('-offer_date', '-id')

    return JsonResponse([
        {
            'id': placement.id,
            'job_title': placement.application.job.job_title,
            'offer_date': placement.offer_date.isoformat() if placement.offer_date else None,
            'joining_date': placement.joining_date.isoformat() if placement.joining_date else None,
            'offered_salary': str(placement.offered_salary) if placement.offered_salary is not None else None,
            'placement_status': placement.placement_status,
        }
        for placement in placements
    ], safe=False)


@csrf_exempt
def candidate_offer_response_view(request, placement_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    placement = Placement.objects.filter(
        id=placement_id,
        application__candidate__email__iexact=request.user.email,
    ).first()
    if placement is None:
        return JsonResponse({'error': 'Offer not found.'}, status=404)

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid offer response.'}, status=400)

    if not isinstance(body, dict):
        return JsonResponse({'error': 'Invalid offer response.'}, status=400)

    response_status = body.get('placement_status')
    if set(body.keys()) != {'placement_status'} or response_status not in {'accepted', 'rejected'}:
        return JsonResponse({'error': 'Choose accepted or rejected.'}, status=400)
    if placement.placement_status != 'offered':
        return JsonResponse({'error': 'This offer has already been answered or closed.'}, status=409)

    placement.placement_status = response_status
    placement.save(update_fields=['placement_status', 'updated_at'])
    return JsonResponse({'message': f'Offer {response_status} successfully.'})


def candidate_notifications_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    notifications = Notification.objects.filter(recipient=request.user)[:100]
    unread_count = Notification.objects.filter(
        recipient=request.user,
        is_read=False,
    ).count()
    return JsonResponse({
        'unread_count': unread_count,
        'notifications': [
            {
                'id': item.id,
                'category': item.category,
                'title': item.title,
                'message': item.message,
                'is_read': item.is_read,
                'created_at': item.created_at.isoformat(),
            }
            for item in notifications
        ],
    })


@csrf_exempt
def mark_candidate_notification_read_view(request, notification_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    notification = Notification.objects.filter(
        id=notification_id,
        recipient=request.user,
    ).first()
    if notification is None:
        return JsonResponse({'error': 'Notification not found.'}, status=404)
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=['is_read'])
    return JsonResponse({'message': 'Notification marked as read.'})


@csrf_exempt
def mark_all_candidate_notifications_read_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed.'}, status=405)
    if not request.user.is_authenticated or getattr(request.user, 'role', None) != 'candidate':
        return JsonResponse({'error': 'Candidate login is required.'}, status=403)

    Notification.objects.filter(
        recipient=request.user,
        is_read=False,
    ).update(is_read=True)
    return JsonResponse({'message': 'Notifications marked as read.'})


@csrf_exempt
def register_candidate_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    username = request.POST.get('username', '').strip()
    email = request.POST.get('email', '').strip().lower()
    first_name = request.POST.get('first_name', '').strip()
    last_name = request.POST.get('last_name', '').strip()
    phone = request.POST.get('phone', '').strip()
    course_id = request.POST.get('course', '').strip()
    password = request.POST.get('password', '')
    password_confirm = request.POST.get('password_confirm', '')
    date_of_birth_raw = request.POST.get('date_of_birth', '').strip()
    graduation_year_raw = request.POST.get('graduation_year', '').strip()
    experience_raw = request.POST.get('experience', '0').strip() or '0'

    required = {
        'username': username,
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
        'phone': phone,
        'password': password,
        'password_confirm': password_confirm,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        return JsonResponse({'error': 'Complete all required fields.'}, status=400)
    if not course_id:
        return JsonResponse({'error': 'Select a course before registering.'}, status=400)

    try:
        course = Course.objects.get(id=int(course_id), status='active')
    except (Course.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an available course.'}, status=400)

    if password != password_confirm:
        return JsonResponse({'error': 'Passwords do not match.'}, status=400)

    date_of_birth = parse_date(date_of_birth_raw) if date_of_birth_raw else None
    if date_of_birth_raw and date_of_birth is None:
        return JsonResponse({'error': 'Enter date of birth as YYYY-MM-DD.'}, status=400)
    try:
        graduation_year = int(graduation_year_raw) if graduation_year_raw else None
        experience = Decimal(experience_raw)
        if experience < 0 or experience > 999.9:
            raise InvalidOperation
        if graduation_year is not None and graduation_year < 1:
            raise ValueError
    except (ValueError, InvalidOperation):
        return JsonResponse({'error': 'Enter a valid graduation year and experience.'}, status=400)

    gender = request.POST.get('gender', '').strip()
    if gender and gender not in {'female', 'male', 'other'}:
        return JsonResponse({'error': 'Select a valid gender.'}, status=400)

    User = get_user_model()
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({'error': 'That username is already taken.'}, status=409)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({'error': 'An account already uses that email.'}, status=409)
    if Candidate.objects.filter(email__iexact=email).exists():
        return JsonResponse({
            'error': 'A candidate profile already uses this email. Contact HR to link it to an account.',
        }, status=409)

    try:
        validate_password(password)
    except ValidationError as error:
        return JsonResponse({'error': ' '.join(error.messages)}, status=400)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
                role='candidate',
                is_active=False,
            )
            Candidate.objects.create(
                email=email,
                course=course,
                course_fee=course.course_fee,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                date_of_birth=date_of_birth,
                gender=gender,
                address=request.POST.get('address', '').strip(),
                city=request.POST.get('city', '').strip(),
                state=request.POST.get('state', '').strip(),
                education=request.POST.get('education', '').strip(),
                college=request.POST.get('college', '').strip(),
                degree=request.POST.get('degree', '').strip(),
                graduation_year=graduation_year,
                skills=request.POST.get('skills', '').strip(),
                experience=experience,
                profile_status='new',
            )
    except IntegrityError:
        return JsonResponse({
            'error': 'Could not create the account. That email or username may already be in use.',
        }, status=409)

    return JsonResponse({
        'message': 'Registration submitted. Your account is waiting for admin approval.',
        'pending_approval': True,
        **user_payload(user),
    }, status=201)


@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    username = request.POST.get('username', '').strip()
    password = request.POST.get('password', '')

    if not username or not password:
        return JsonResponse({'error': 'Username and password are required'}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        User = get_user_model()
        inactive_candidate = User.objects.filter(
            username__iexact=username,
            role='candidate',
            is_active=False,
        ).first()
        if inactive_candidate and inactive_candidate.check_password(password):
            return JsonResponse({
                'error': 'Your account is waiting for admin approval.',
            }, status=403)
        if not User.objects.filter(username__iexact=username).exists():
            return JsonResponse({'error': 'Account not found.'}, status=404)
        return JsonResponse({'error': 'Invalid username or password'}, status=401)

    # A candidate login is valid only while its linked candidate profile exists.
    # This also rejects accounts orphaned by candidate deletions before the
    # profile and login account were deleted together.
    if (
        getattr(user, 'role', None) == 'candidate'
        and not Candidate.objects.filter(email__iexact=user.email).exists()
    ):
        return JsonResponse({'error': 'Account not found.'}, status=404)

    login(request, user)
    return JsonResponse({
        'message': 'Login successful',
        **user_payload(user),
    })


def session_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    return JsonResponse({
        'authenticated': True,
        **user_payload(request.user),
    })


@csrf_exempt
def logout_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    logout(request)
    return JsonResponse({'message': 'Logout successful'})


class HRMSRoleMiddleware:
    """Require an admin session for HRMS APIs; expose open jobs to candidates."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        if path.startswith('/api/hrms/'):
            if request.method == 'OPTIONS':
                return self.get_response(request)

            is_jobs_list = (
                path.rstrip('/') == '/api/hrms/jobs'
                and request.method == 'GET'
            )
            is_public_open_jobs_list = (
                is_jobs_list and request.GET.get('status') == 'open'
            )
            is_candidate_jobs_list = (
                is_jobs_list
                and request.user.is_authenticated
                and getattr(request.user, 'role', None) == 'candidate'
            )
            is_candidate_applications_list = (
                path.rstrip('/') == '/api/hrms/applications'
                and request.method in {'GET', 'POST'}
                and request.user.is_authenticated
                and getattr(request.user, 'role', None) == 'candidate'
            )
            is_candidate_application_update = False
            if (
                request.method == 'PUT'
                and request.user.is_authenticated
                and getattr(request.user, 'role', None) == 'candidate'
            ):
                application_id = path.rstrip('/').removeprefix(
                    '/api/hrms/applications/'
                )
                if application_id.isdigit():
                    is_candidate_application_update = Application.objects.filter(
                        id=int(application_id),
                        candidate__email__iexact=request.user.email,
                    ).exists()
            if (
                is_public_open_jobs_list
                or is_candidate_jobs_list
                or is_candidate_applications_list
                or is_candidate_application_update
            ):
                return self.get_response(request)

            if not request.user.is_authenticated:
                return JsonResponse({'error': 'Authentication required.'}, status=401)
            if getattr(request.user, 'role', None) != 'admin':
                return JsonResponse({'error': 'Admin access required.'}, status=403)

        return self.get_response(request)

