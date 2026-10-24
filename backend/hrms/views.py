import json
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.notifications import notify_candidate
from .models import (
    Department,
    Course,
    Candidate,
    Job,
    Application,
    Employee,
    Interview,
    Attendance,
    Leave,
    Placement,
    Payroll,
    CandidatePayment,
)


def delete_hrms_record(record, label):
    """Delete a record, returning a useful conflict for protected relations."""
    try:
        record.delete()
    except ProtectedError:
        return JsonResponse({
            'error': f'This {label} is linked to other HRMS records and cannot be deleted yet.',
        }, status=409)
    return JsonResponse({'message': f'{label.capitalize()} deleted successfully.'})


def apply_list_filters(request, queryset, search_fields, exact_filters):
    search_text = request.GET.get('q', '').strip()

    if search_text:
        search_query = Q()

        for field in search_fields:
            search_query |= Q(**{
                f'{field}__icontains': search_text
            })

        queryset = queryset.filter(search_query)

    for parameter, field in exact_filters.items():
        value = request.GET.get(parameter, '').strip()

        if value:
            queryset = queryset.filter(**{field: value})

    return queryset


# ==============================
# DEPARTMENT API
# ==============================

@csrf_exempt
def department_api(request):
    if request.method == 'GET':
        departments = apply_list_filters(
            request,
            Department.objects.all().order_by('-id'),
            search_fields=['department_name', 'department_code'],
            exact_filters={'status': 'status'},
        )

        data = []

        for department in departments:
            data.append({
                'id': department.id,
                'department_name': department.department_name,
                'department_code': department.department_code,
                'description': department.description,
                'status': department.status,
                'created_at': department.created_at.isoformat(),
            })

        return JsonResponse(data, safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body)

            department = Department.objects.create(
                department_name=body.get('department_name'),
                department_code=body.get('department_code'),
                description=body.get('description', ''),
                status=body.get('status', 'active'),
            )

            return JsonResponse({
                'message': 'Department created successfully',
                'id': department.id,
            }, status=201)

        except (json.JSONDecodeError, TypeError):
            return JsonResponse({
                'error': 'Invalid JSON data',
            }, status=400)

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)


@csrf_exempt
def department_detail_api(request, department_id):
    department = get_object_or_404(
        Department,
        id=department_id,
    )

    if request.method == 'GET':
        return JsonResponse({
            'id': department.id,
            'department_name': department.department_name,
            'department_code': department.department_code,
            'description': department.description,
            'status': department.status,
            'created_at': department.created_at.isoformat(),
        })

    if request.method == 'PUT':
        try:
            body = json.loads(request.body)

            department.department_name = body.get(
                'department_name',
                department.department_name,
            )
            department.department_code = body.get(
                'department_code',
                department.department_code,
            )
            department.description = body.get(
                'description',
                department.description,
            )
            department.status = body.get(
                'status',
                department.status,
            )

            department.save()

            return JsonResponse({
                'message': 'Department updated successfully',
            })

        except (json.JSONDecodeError, TypeError):
            return JsonResponse({
                'error': 'Invalid JSON data',
            }, status=400)

    if request.method == 'DELETE':
        return delete_hrms_record(department, 'department')

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)


# ==============================
# COURSE CATALOG API
# ==============================

def course_to_dict(course):
    return {
        'id': course.id,
        'course_name': course.course_name,
        'description': course.description,
        'duration': course.duration,
        'course_fee': report_money(course.course_fee),
        'status': course.status,
        'candidate_count': course.candidates.count(),
        'created_at': course.created_at.isoformat(),
        'updated_at': course.updated_at.isoformat(),
    }


def parse_course_payload(body, course=None):
    course_name = str(body.get('course_name', course.course_name if course else '')).strip()
    if not course_name:
        raise ValueError('Course name is required.')
    if len(course_name) > 160:
        raise ValueError('Course name must be 160 characters or fewer.')

    raw_fee = body.get('course_fee', course.course_fee if course else 0)
    try:
        fee = Decimal(str(raw_fee))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('Course fee must be a valid amount.')
    if not fee.is_finite() or fee < 0 or fee > Decimal('9999999999.99'):
        raise ValueError('Course fee must be between 0 and 9,999,999,999.99.')

    status = str(body.get('status', course.status if course else 'active')).strip()
    if status not in {'active', 'inactive'}:
        raise ValueError('Choose active or inactive for course status.')

    return {
        'course_name': course_name,
        'description': str(body.get('description', course.description if course else '')).strip(),
        'duration': str(body.get('duration', course.duration if course else '')).strip(),
        'course_fee': fee.quantize(Decimal('0.01')),
        'status': status,
    }


@csrf_exempt
def course_api(request):
    if request.method == 'GET':
        courses = apply_list_filters(
            request,
            Course.objects.annotate(candidate_total=Count('candidates')).order_by('course_name'),
            search_fields=['course_name', 'description', 'duration'],
            exact_filters={'status': 'status'},
        )
        return JsonResponse([
            {
                'id': course.id,
                'course_name': course.course_name,
                'description': course.description,
                'duration': course.duration,
                'course_fee': report_money(course.course_fee),
                'status': course.status,
                'candidate_count': course.candidate_total,
                'created_at': course.created_at.isoformat(),
                'updated_at': course.updated_at.isoformat(),
            }
            for course in courses
        ], safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
            if not isinstance(body, dict):
                raise ValueError('Course data must be a JSON object.')
            course = Course.objects.create(**parse_course_payload(body))
            return JsonResponse({
                'message': 'Course created successfully.',
                'course': course_to_dict(course),
            }, status=201)
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation) as error:
            return JsonResponse({'error': str(error) or 'Invalid course data.'}, status=400)
        except Exception as error:
            return JsonResponse({'error': str(error)}, status=409)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def course_detail_api(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if request.method == 'GET':
        return JsonResponse(course_to_dict(course))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')
            if not isinstance(body, dict):
                raise ValueError('Course data must be a JSON object.')
            for field, value in parse_course_payload(body, course).items():
                setattr(course, field, value)
            course.save()
            return JsonResponse({'message': 'Course updated successfully.'})
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation) as error:
            return JsonResponse({'error': str(error) or 'Invalid course data.'}, status=400)
        except Exception as error:
            return JsonResponse({'error': str(error)}, status=409)

    if request.method == 'DELETE':
        return delete_hrms_record(course, 'course')

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ==============================
# CANDIDATE HELPERS AND API
# ==============================

def candidate_to_dict(candidate):
    user = get_user_model().objects.filter(
        email__iexact=candidate.email,
        role='candidate',
    ).only('is_active').first()
    paid_amount = getattr(candidate, 'paid_total', None)
    if paid_amount is None:
        paid_amount = candidate.payments.aggregate(total=Sum('amount'))['total']
    paid_amount = paid_amount or Decimal('0.00')
    course_fee = candidate.course_fee or Decimal('0.00')
    return {
        'id': candidate.id,
        'first_name': candidate.first_name,
        'last_name': candidate.last_name,
        'email': candidate.email,
        'phone': candidate.phone,
        'course': candidate.course_id,
        'course_name': candidate.course.course_name if candidate.course_id else '',
        'course_duration': candidate.course.duration if candidate.course_id else '',
        'catalog_course_fee': report_money(candidate.course.course_fee) if candidate.course_id else None,
        'target_job': candidate.target_job_id,
        'role': candidate.target_job.job_title if candidate.target_job_id else '',
        'department': (
            candidate.target_job.department.department_name
            if candidate.target_job_id else ''
        ),
        'course_fee': report_money(course_fee),
        'total_fee': report_money(course_fee),  # Backward-compatible alias.
        'paid_amount': report_money(paid_amount),
        'due_amount': report_money(max(course_fee - paid_amount, Decimal('0.00'))),
        'date_of_birth': (
            candidate.date_of_birth.isoformat()
            if candidate.date_of_birth else None
        ),
        'gender': candidate.gender,
        'address': candidate.address,
        'city': candidate.city,
        'state': candidate.state,
        'education': candidate.education,
        'college': candidate.college,
        'degree': candidate.degree,
        'graduation_year': candidate.graduation_year,
        'skills': candidate.skills,
        'experience': float(candidate.experience),
        'resume': candidate.resume.url if candidate.resume else None,
        'profile_status': candidate.profile_status,
        'account_status': (
            'no_account' if user is None
            else 'approved' if user.is_active
            else 'pending'
        ),
        'created_at': candidate.created_at.isoformat(),
    }


def update_candidate_fields(candidate, body):
    text_fields = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'gender',
        'address',
        'city',
        'state',
        'education',
        'college',
        'degree',
        'skills',
        'profile_status',
    ]

    for field in text_fields:
        if field in body:
            setattr(candidate, field, body[field])

    if 'date_of_birth' in body:
        value = body['date_of_birth']
        candidate.date_of_birth = (
            datetime.strptime(value, '%Y-%m-%d').date()
            if value else None
        )

    if 'graduation_year' in body:
        value = body['graduation_year']
        candidate.graduation_year = int(value) if value else None

    if 'experience' in body:
        candidate.experience = body['experience']

    if 'course' in body:
        course_value = body.get('course')
        if course_value in (None, ''):
            if candidate.course_id and candidate.pk and candidate.payments.exists():
                raise ValueError('A course cannot be removed after a payment has been recorded.')
            had_course = bool(candidate.course_id)
            candidate.course = None
            if had_course and 'course_fee' not in body and 'total_fee' not in body:
                candidate.course_fee = Decimal('0.00')
        else:
            try:
                selected_course = Course.objects.get(id=int(course_value))
            except (Course.DoesNotExist, TypeError, ValueError):
                raise ValueError('Select a valid course.')
            if selected_course.status != 'active' and candidate.course_id != selected_course.id:
                raise ValueError('Only active courses can be assigned to a candidate.')
            if candidate.course_id != selected_course.id:
                if candidate.pk and candidate.payments.exists():
                    # Legacy candidates may have payments but no linked course.
                    # Link one only when its catalog fee matches the existing
                    # account fee, so the payment history and balance stay valid.
                    if (
                        candidate.course_id is None
                        and candidate.course_fee == selected_course.course_fee
                    ):
                        candidate.course = selected_course
                    else:
                        raise ValueError('A course cannot be changed after a payment has been recorded.')
                else:
                    candidate.course = selected_course
                    candidate.course_fee = selected_course.course_fee

    if 'target_job' in body:
        value = body['target_job']
        if value in (None, ''):
            candidate.target_job = None
        else:
            try:
                candidate.target_job = Job.objects.get(id=int(value))
            except (Job.DoesNotExist, TypeError, ValueError):
                raise ValueError('Select a valid role/job.')

    fee_value = body.get('course_fee', body.get('total_fee'))
    course_is_selected = bool(body.get('course'))
    if fee_value is not None and not course_is_selected:
        candidate.course_fee = parse_candidate_amount(fee_value, 'course_fee')


def parse_candidate_amount(value, field_name='amount'):
    try:
        amount = Decimal(str(value if value not in (None, '') else '0'))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'{field_name} must be a valid amount.')
    if not amount.is_finite() or amount < 0 or amount > Decimal('9999999999.99'):
        raise ValueError(f'{field_name} must be between 0 and 9,999,999,999.99.')
    return amount.quantize(Decimal('0.01'))


def candidate_payment_to_dict(payment):
    return {
        'id': payment.id,
        'candidate': payment.candidate_id,
        'candidate_name': f'{payment.candidate.first_name} {payment.candidate.last_name}'.strip(),
        'amount': report_money(payment.amount),
        'payment_date': payment.payment_date.isoformat(),
        'note': payment.note,
        'created_at': payment.created_at.isoformat(),
    }


@csrf_exempt
def candidate_api(request):
    if request.method == 'GET':
        candidates = apply_list_filters(
            request,
            Candidate.objects.select_related(
                'target_job__department', 'course'
            ).annotate(
                paid_total=Sum('payments__amount')
            ).order_by('-id'),
            search_fields=[
                'first_name',
                'last_name',
                'email',
                'phone',
                'city',
                'target_job__job_title',
                'target_job__department__department_name',
                'course__course_name',
            ],
            exact_filters={
                'profile_status': 'profile_status',
                'gender': 'gender',
                'city': 'city',
            },
        )

        data = [
            candidate_to_dict(candidate)
            for candidate in candidates
        ]

        return JsonResponse(data, safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body)
            initial_payment = parse_candidate_amount(
                body.get('initial_payment', 0), 'initial_payment'
            )
            candidate = Candidate(course_fee=parse_candidate_amount(
                body.get('course_fee', body.get('total_fee', 0)), 'course_fee'
            ))
            update_candidate_fields(candidate, body)
            if initial_payment > candidate.course_fee:
                return JsonResponse({
                    'error': 'Initial payment cannot exceed the course fee.',
                }, status=400)

            with transaction.atomic():
                candidate.save()
                if initial_payment > 0:
                    payment_date = parse_candidate_payment_date(
                        body.get('initial_payment_date')
                    )
                    CandidatePayment.objects.create(
                        candidate=candidate,
                        amount=initial_payment,
                        payment_date=payment_date,
                        note=str(body.get('initial_payment_note', '')).strip(),
                    )

            return JsonResponse({
                'message': 'Candidate created successfully',
                'id': candidate.id,
                'candidate': candidate_to_dict(candidate),
            }, status=201)

        except (json.JSONDecodeError, TypeError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid candidate data. Check the date format YYYY-MM-DD and numeric fields.',
            }, status=400)

        except ValueError as error:
            return JsonResponse({'error': str(error)}, status=400)

        except Exception as error:
            return JsonResponse({
                'error': str(error),
            }, status=400)

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)


@csrf_exempt
def candidate_detail_api(request, candidate_id):
    candidate = get_object_or_404(
        Candidate.objects.select_related(
            'target_job__department', 'course'
        ).annotate(
            paid_total=Sum('payments__amount')
        ),
        id=candidate_id,
    )

    if request.method == 'GET':
        return JsonResponse(candidate_to_dict(candidate))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body)

            if body.get('approve_account') is True:
                user = get_user_model().objects.filter(
                    email__iexact=candidate.email,
                    role='candidate',
                ).first()
                if user is None:
                    return JsonResponse({
                        'error': 'This candidate does not have a registered account to approve.',
                    }, status=409)
                user.is_active = True
                user.save(update_fields=['is_active'])
                return JsonResponse({
                    'message': 'Candidate account approved successfully.',
                })

            update_candidate_fields(candidate, body)
            paid_amount = candidate.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if candidate.course_fee < paid_amount:
                return JsonResponse({
                    'error': 'Course fee cannot be less than the amount already paid.',
                }, status=400)
            candidate.save()

            return JsonResponse({
                'message': 'Candidate updated successfully',
            })

        except (json.JSONDecodeError, TypeError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid candidate data. Check the date format YYYY-MM-DD and numeric fields.',
            }, status=400)

        except ValueError as error:
            return JsonResponse({'error': str(error)}, status=400)

        except Exception as error:
            return JsonResponse({
                'error': str(error),
            }, status=400)

    if request.method == 'DELETE':
        User = get_user_model()
        linked_candidate_users = User.objects.filter(
            email__iexact=candidate.email,
            role='candidate',
        )
        try:
            with transaction.atomic():
                candidate.delete()
                linked_candidate_users.delete()
        except ProtectedError:
            return JsonResponse({
                'error': 'This candidate is linked to protected HRMS records and cannot be deleted yet.',
            }, status=409)

        return JsonResponse({
            'message': 'Candidate and linked login account deleted successfully.',
        })

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)


def parse_candidate_payment_date(value):
    if value in (None, ''):
        return timezone.localdate()
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise ValueError('payment_date must use YYYY-MM-DD format.')


@csrf_exempt
def candidate_payments_api(request):
    if request.method == 'GET':
        payments = CandidatePayment.objects.select_related('candidate').all()
        candidate_id = request.GET.get('candidate', '').strip()
        if candidate_id:
            try:
                payments = payments.filter(candidate_id=int(candidate_id))
            except ValueError:
                return JsonResponse({'error': 'candidate must be a valid ID.'}, status=400)
        return JsonResponse(
            [candidate_payment_to_dict(payment) for payment in payments],
            safe=False,
        )

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
            candidate_id = int(body.get('candidate'))
            amount = parse_candidate_amount(body.get('amount'), 'amount')
            if amount <= 0:
                return JsonResponse({'error': 'amount must be greater than zero.'}, status=400)

            with transaction.atomic():
                candidate = Candidate.objects.select_for_update().filter(id=candidate_id).first()
                if candidate is None:
                    return JsonResponse({'error': 'Candidate not found.'}, status=404)
                paid_total = candidate.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
                due_amount = candidate.course_fee - paid_total
                if amount > due_amount:
                    return JsonResponse({
                        'error': f'Payment exceeds the remaining balance of {report_money(max(due_amount, Decimal("0.00")))}.',
                    }, status=400)

                payment = CandidatePayment.objects.create(
                    candidate=candidate,
                    amount=amount,
                    payment_date=parse_candidate_payment_date(body.get('payment_date')),
                    note=str(body.get('note', '')).strip(),
                )
            return JsonResponse({
                'message': 'Candidate payment recorded successfully.',
                'payment': candidate_payment_to_dict(payment),
            }, status=201)
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid payment data. Provide a candidate ID, valid amount, and payment date in YYYY-MM-DD format.',
            }, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ==============================
# JOB HELPERS AND API
# ==============================

def job_to_dict(job):
    return {
        'id': job.id,
        'job_title': job.job_title,
        'department': job.department_id,
        'department_name': job.department.department_name,
        'job_type': job.job_type,
        'location': job.location,
        'experience_required': job.experience_required,
        'qualification': job.qualification,
        'skills_required': job.skills_required,
        'salary_range': job.salary_range,
        'job_description': job.job_description,
        'responsibilities': job.responsibilities,
        'vacancies': job.vacancies,
        'application_deadline': job.application_deadline.isoformat(),
        'status': job.status,
        'created_at': job.created_at.isoformat(),
    }


def update_job_fields(job, body):
    fields = [
        'job_title',
        'job_type',
        'location',
        'experience_required',
        'qualification',
        'skills_required',
        'salary_range',
        'job_description',
        'responsibilities',
        'vacancies',
        'status',
    ]

    for field in fields:
        if field in body:
            setattr(job, field, body[field])

    if 'department' in body:
        job.department_id = int(body['department'])

    if 'application_deadline' in body:
        value = body['application_deadline']
        job.application_deadline = datetime.strptime(
            value,
            '%Y-%m-%d',
        ).date()


@csrf_exempt
def job_api(request):
    if request.method == 'GET':
        jobs = apply_list_filters(
            request,
            Job.objects.select_related('department')
            .all()
            .order_by('-id'),
            search_fields=[
                'job_title',
                'location',
                'qualification',
                'skills_required',
            ],
            exact_filters={
                'status': 'status',
                'job_type': 'job_type',
                'department_code': 'department__department_code__iexact',
            },
        )

        if getattr(request.user, 'is_authenticated', False) and getattr(request.user, 'role', None) == 'candidate':
            jobs = jobs.filter(status='open')

        data = [job_to_dict(job) for job in jobs]
        return JsonResponse(data, safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body)

            job = Job()
            update_job_fields(job, body)
            job.save()

            return JsonResponse({
                'message': 'Job created successfully',
                'id': job.id,
            }, status=201)

        except (json.JSONDecodeError, TypeError, ValueError):
            return JsonResponse({
                'error': 'Invalid job data. Check the department ID, date format YYYY-MM-DD and numeric fields.',
            }, status=400)

        except Exception as error:
            return JsonResponse({
                'error': str(error),
            }, status=400)

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)


@csrf_exempt
def job_detail_api(request, job_id):
    job = get_object_or_404(
        Job.objects.select_related('department'),
        id=job_id,
    )

    if request.method == 'GET':
        return JsonResponse(job_to_dict(job))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body)

            update_job_fields(job, body)
            job.save()

            return JsonResponse({
                'message': 'Job updated successfully',
            })

        except (json.JSONDecodeError, TypeError, ValueError):
            return JsonResponse({
                'error': 'Invalid job data. Check the department ID, date format YYYY-MM-DD and numeric fields.',
            }, status=400)

        except Exception as error:
            return JsonResponse({
                'error': str(error),
            }, status=400)

    if request.method == 'DELETE':
        return delete_hrms_record(job, 'job')

    return JsonResponse({
        'error': 'Method not allowed',
    }, status=405)
    # ==============================
# APPLICATION HELPERS AND API
# ==============================

def application_to_dict(application):
    return {
        'id': application.id,
        'candidate': application.candidate_id,
        'candidate_name': (
            f'{application.candidate.first_name} '
            f'{application.candidate.last_name}'
        ),
        'candidate_email': application.candidate.email,
        'job': application.job_id,
        'job_title': application.job.job_title,
        'applied_date': application.applied_date.isoformat(),
        'resume': application.resume.url if application.resume else None,
        'cover_letter': application.cover_letter,
        'application_status': application.application_status,
        'recruiter_remarks': application.recruiter_remarks,
        'updated_at': application.updated_at.isoformat(),
    }


def get_application_body(request):
    content_type = request.content_type or ''

    if 'application/json' in content_type:
        return json.loads(request.body), None

    return request.POST, request.FILES


@csrf_exempt
def application_api(request):
    if request.method == 'GET':
        applications = Application.objects.select_related(
            'candidate',
            'job',
        ).all().order_by('-id')

        if (
            getattr(request.user, 'is_authenticated', False)
            and getattr(request.user, 'role', None) == 'candidate'
        ):
            applications = applications.filter(
                candidate__email__iexact=request.user.email
            )

        applications = apply_list_filters(
            request,
            applications,
            search_fields=[
                'candidate__first_name',
                'candidate__last_name',
                'candidate__email',
                'job__job_title',
            ],
            exact_filters={
                'application_status': 'application_status',
            },
        )

        return JsonResponse(
            [
                application_to_dict(application)
                for application in applications
            ],
            safe=False,
        )

    if request.method == 'POST':
        try:
            body, files = get_application_body(request)

            job_id = int(body.get('job'))

            if (
                getattr(request.user, 'is_authenticated', False)
                and getattr(request.user, 'role', None) == 'candidate'
            ):
                candidate = get_object_or_404(
                    Candidate,
                    email__iexact=request.user.email,
                )
                requested_candidate = body.get('candidate')
                if requested_candidate and str(requested_candidate) != str(candidate.id):
                    return JsonResponse({
                        'error': 'You can only apply using your own candidate profile.',
                    }, status=403)
            else:
                candidate_id = int(body.get('candidate'))
                candidate = get_object_or_404(Candidate, id=candidate_id)

            job = get_object_or_404(Job, id=job_id)

            if job.status != 'open':
                return JsonResponse(
                    {'error': 'Applications can only be submitted for open jobs.'},
                    status=400,
                )

            if Application.objects.filter(
                candidate=candidate,
                job=job,
            ).exists():
                return JsonResponse(
                    {'error': 'This candidate has already applied for this job.'},
                    status=409,
                )

            application = Application.objects.create(
                candidate=candidate,
                job=job,
                cover_letter=body.get('cover_letter', ''),
                resume=files.get('resume'),
            )

            return JsonResponse({
                'message': 'Application created successfully',
                'id': application.id,
            }, status=201)

        except (json.JSONDecodeError, TypeError, ValueError):
            return JsonResponse(
                {'error': 'Invalid application data. Provide valid candidate and job IDs.'},
                status=400,
            )

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


@csrf_exempt
def application_detail_api(request, application_id):
    application = get_object_or_404(
        Application.objects.select_related('candidate', 'job'),
        id=application_id,
    )

    if request.method == 'GET':
        return JsonResponse(application_to_dict(application))

    if request.method == 'PUT':
        try:
            body, _files = get_application_body(request)
            previous_status = application.application_status

            if (
                getattr(request.user, 'is_authenticated', False)
                and getattr(request.user, 'role', None) == 'candidate'
            ):
                if (
                    set(body.keys()) != {'application_status'}
                    or body.get('application_status') != 'withdrawn'
                ):
                    return JsonResponse({
                        'error': 'Candidates may only withdraw their own application.',
                    }, status=403)
                if application.application_status not in {'applied', 'under_review'}:
                    return JsonResponse({
                        'error': 'This application can no longer be withdrawn.',
                    }, status=409)
                application.application_status = 'withdrawn'
                application.save(update_fields=['application_status', 'updated_at'])
                return JsonResponse({
                    'message': 'Application withdrawn successfully.',
                })

            if 'application_status' in body:
                allowed_statuses = {
                    value
                    for value, _label in Application.STATUS_CHOICES
                }
                if body['application_status'] not in allowed_statuses:
                    return JsonResponse(
                        {'error': 'Invalid application status.'},
                        status=400,
                    )
                application.application_status = body['application_status']

            if 'cover_letter' in body:
                application.cover_letter = body['cover_letter']

            if 'recruiter_remarks' in body:
                application.recruiter_remarks = body['recruiter_remarks']

            application.save()

            if (
                application.application_status != previous_status
                and getattr(request.user, 'role', None) == 'admin'
            ):
                notify_candidate(
                    application.candidate,
                    'application',
                    'Application status updated',
                    f'Your application for {application.job.job_title} is now {application.application_status.replace("_", " ")}.',
                    'application',
                    application.id,
                )

            return JsonResponse({
                'message': 'Application updated successfully',
            })

        except (json.JSONDecodeError, TypeError, ValueError):
            return JsonResponse(
                {'error': 'Invalid application data.'},
                status=400,
            )

    if request.method == 'DELETE':
        return delete_hrms_record(application, 'application')

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


# ==============================
# INTERVIEW HELPERS AND API
# ==============================

def interview_to_dict(interview):
    return {
        'id': interview.id,
        'application': interview.application_id,
        'candidate': interview.candidate_id,
        'candidate_name': (
            f'{interview.candidate.first_name} '
            f'{interview.candidate.last_name}'
        ),
        'interviewer': interview.interviewer_id,
        'interviewer_name': (
            f'{interview.interviewer.first_name} '
            f'{interview.interviewer.last_name}'
            if interview.interviewer else None
        ),
        'interview_type': interview.interview_type,
        'interview_date': interview.interview_date.isoformat(),
        'interview_time': interview.interview_time.isoformat(),
        'meeting_link': interview.meeting_link,
        'location': interview.location,
        'interview_status': interview.interview_status,
        'feedback': interview.feedback,
        'rating': (
            str(interview.rating)
            if interview.rating is not None else None
        ),
        'created_at': interview.created_at.isoformat(),
    }


def parse_interview_date(value):
    return datetime.strptime(value, '%Y-%m-%d').date()


def parse_interview_time(value):
    for time_format in ('%H:%M:%S', '%H:%M'):
        try:
            return datetime.strptime(value, time_format).time()
        except ValueError:
            continue

    raise ValueError('Time must use HH:MM or HH:MM:SS format.')


def parse_interview_rating(value):
    if value in (None, ''):
        return None

    rating = Decimal(str(value))

    if (
        not rating.is_finite()
        or rating < 0
        or rating > Decimal('99.9')
        or rating != rating.quantize(Decimal('0.1'))
    ):
        raise ValueError(
            'Rating must be between 0 and 99.9 with at most one decimal place.'
        )

    return rating


@csrf_exempt
def interview_api(request):
    if request.method == 'GET':
        interviews = apply_list_filters(
            request,
            Interview.objects.select_related(
                'application',
                'candidate',
                'interviewer',
            ).all().order_by('-id'),
            search_fields=[
                'candidate__first_name',
                'candidate__last_name',
                'application__job__job_title',
                'interviewer__first_name',
                'interviewer__last_name',
            ],
            exact_filters={
                'interview_status': 'interview_status',
                'interview_type': 'interview_type',
            },
        )

        return JsonResponse(
            [
                interview_to_dict(interview)
                for interview in interviews
            ],
            safe=False,
        )

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')

            required_fields = (
                'application',
                'candidate',
                'interview_type',
                'interview_date',
                'interview_time',
            )
            missing_fields = [
                field for field in required_fields
                if body.get(field) in (None, '')
            ]

            if missing_fields:
                return JsonResponse({
                    'error': 'Missing required fields: '
                             + ', '.join(missing_fields),
                }, status=400)

            application = get_object_or_404(
                Application,
                id=int(body['application']),
            )
            candidate = get_object_or_404(
                Candidate,
                id=int(body['candidate']),
            )

            if application.candidate_id != candidate.id:
                return JsonResponse({
                    'error': 'The candidate must match the selected application.',
                }, status=400)

            interview_type = body['interview_type']
            allowed_types = {
                value
                for value, _label in Interview.INTERVIEW_TYPE_CHOICES
            }
            if interview_type not in allowed_types:
                return JsonResponse({
                    'error': 'Invalid interview_type.',
                }, status=400)

            interviewer = None
            if body.get('interviewer') not in (None, ''):
                interviewer = get_object_or_404(
                    Employee,
                    id=int(body['interviewer']),
                )

            status = body.get('interview_status', 'scheduled')
            allowed_statuses = {
                value
                for value, _label in Interview.STATUS_CHOICES
            }
            if status not in allowed_statuses:
                return JsonResponse({
                    'error': 'Invalid interview_status.',
                }, status=400)

            interview = Interview.objects.create(
                application=application,
                candidate=candidate,
                interviewer=interviewer,
                interview_type=interview_type,
                interview_date=parse_interview_date(
                    body['interview_date']
                ),
                interview_time=parse_interview_time(
                    body['interview_time']
                ),
                meeting_link=body.get('meeting_link', ''),
                location=body.get('location', ''),
                interview_status=status,
                feedback=body.get('feedback', ''),
                rating=parse_interview_rating(body.get('rating')),
            )

            notify_candidate(
                candidate,
                'interview',
                'Interview scheduled',
                f'An interview for {application.job.job_title} is scheduled for {interview.interview_date.isoformat()} at {interview.interview_time.strftime("%H:%M")}.',
                'interview',
                interview.id,
            )

            return JsonResponse({
                'message': 'Interview scheduled successfully',
                'id': interview.id,
            }, status=201)

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid interview data. Check IDs, date (YYYY-MM-DD), '
                         'time (HH:MM), and rating.',
            }, status=400)

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


@csrf_exempt
def interview_detail_api(request, interview_id):
    interview = get_object_or_404(
        Interview.objects.select_related(
            'application',
            'candidate',
            'interviewer',
        ),
        id=interview_id,
    )

    if request.method == 'GET':
        return JsonResponse(interview_to_dict(interview))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')
            previous_schedule = (
                interview.interview_date,
                interview.interview_time,
                interview.interview_status,
                interview.meeting_link,
                interview.location,
            )

            if 'interview_type' in body:
                allowed_types = {
                    value
                    for value, _label in Interview.INTERVIEW_TYPE_CHOICES
                }
                if body['interview_type'] not in allowed_types:
                    return JsonResponse({
                        'error': 'Invalid interview_type.',
                    }, status=400)
                interview.interview_type = body['interview_type']

            if 'interview_date' in body:
                interview.interview_date = parse_interview_date(
                    body['interview_date']
                )

            if 'interview_time' in body:
                interview.interview_time = parse_interview_time(
                    body['interview_time']
                )

            if 'interview_status' in body:
                allowed_statuses = {
                    value
                    for value, _label in Interview.STATUS_CHOICES
                }
                if body['interview_status'] not in allowed_statuses:
                    return JsonResponse({
                        'error': 'Invalid interview_status.',
                    }, status=400)
                interview.interview_status = body['interview_status']

            if 'interviewer' in body:
                interviewer_id = body['interviewer']
                interview.interviewer = (
                    get_object_or_404(Employee, id=int(interviewer_id))
                    if interviewer_id not in (None, '')
                    else None
                )

            if 'meeting_link' in body:
                interview.meeting_link = body['meeting_link']

            if 'location' in body:
                interview.location = body['location']

            if 'feedback' in body:
                interview.feedback = body['feedback']

            if 'rating' in body:
                interview.rating = parse_interview_rating(body['rating'])

            interview.save()

            updated_schedule = (
                interview.interview_date,
                interview.interview_time,
                interview.interview_status,
                interview.meeting_link,
                interview.location,
            )
            if updated_schedule != previous_schedule:
                notify_candidate(
                    interview.candidate,
                    'interview',
                    'Interview schedule updated',
                    f'Your interview for {interview.application.job.job_title} is now {interview.interview_date.isoformat()} at {interview.interview_time.strftime("%H:%M")} (status: {interview.interview_status.replace("_", " ")}).',
                    'interview',
                    interview.id,
                )

            return JsonResponse({
                'message': 'Interview updated successfully',
            })

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid interview data.',
            }, status=400)

    if request.method == 'DELETE':
        interview.delete()
        return JsonResponse({
            'message': 'Interview deleted successfully',
        })

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


# ==============================
# PLACEMENT HELPERS AND API
# ==============================

def placement_to_dict(placement):
    application = placement.application

    return {
        'id': placement.id,
        'application': application.id,
        'candidate': application.candidate_id,
        'candidate_name': (
            f'{application.candidate.first_name} '
            f'{application.candidate.last_name}'
        ),
        'job': application.job_id,
        'job_title': application.job.job_title,
        'offer_date': (
            placement.offer_date.isoformat()
            if placement.offer_date else None
        ),
        'joining_date': (
            placement.joining_date.isoformat()
            if placement.joining_date else None
        ),
        'offered_salary': (
            str(placement.offered_salary)
            if placement.offered_salary is not None else None
        ),
        'placement_status': placement.placement_status,
        'remarks': placement.remarks,
        'created_at': placement.created_at.isoformat(),
        'updated_at': placement.updated_at.isoformat(),
    }


def parse_optional_placement_date(value):
    if value in (None, ''):
        return None

    return datetime.strptime(value, '%Y-%m-%d').date()


def parse_optional_offered_salary(value):
    if value in (None, ''):
        return None

    salary = Decimal(str(value))

    if (
        not salary.is_finite()
        or salary < 0
        or salary > Decimal('9999999999.99')
        or salary.as_tuple().exponent < -2
    ):
        raise ValueError('Invalid offered salary.')

    return salary


@csrf_exempt
def placement_api(request):
    if request.method == 'GET':
        placements = apply_list_filters(
            request,
            Placement.objects.select_related(
                'application__candidate',
                'application__job',
            ).all().order_by('-id'),
            search_fields=[
                'application__candidate__first_name',
                'application__candidate__last_name',
                'application__job__job_title',
            ],
            exact_filters={
                'placement_status': 'placement_status',
            },
        )

        return JsonResponse(
            [
                placement_to_dict(placement)
                for placement in placements
            ],
            safe=False,
        )

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')

            if body.get('application') in (None, ''):
                return JsonResponse({
                    'error': 'The application field is required.',
                }, status=400)

            application = get_object_or_404(
                Application.objects.select_related('candidate', 'job'),
                id=int(body['application']),
            )

            if application.application_status != 'selected':
                return JsonResponse({
                    'error': 'A placement can only be created for a selected application.',
                }, status=400)

            if Placement.objects.filter(application=application).exists():
                return JsonResponse({
                    'error': 'A placement already exists for this application.',
                }, status=409)

            allowed_statuses = {
                value for value, _label in Placement.STATUS_CHOICES
            }
            placement_status = body.get('placement_status', 'offered')

            if placement_status not in allowed_statuses:
                return JsonResponse({
                    'error': 'Invalid placement_status.',
                }, status=400)

            placement = Placement.objects.create(
                application=application,
                offer_date=parse_optional_placement_date(
                    body.get('offer_date')
                ),
                joining_date=parse_optional_placement_date(
                    body.get('joining_date')
                ),
                offered_salary=parse_optional_offered_salary(
                    body.get('offered_salary')
                ),
                placement_status=placement_status,
                remarks=body.get('remarks', ''),
            )

            notify_candidate(
                application.candidate,
                'offer',
                'A job offer is available',
                f'An offer for {application.job.job_title} has been created with status {placement.placement_status.replace("_", " ")}.',
                'placement',
                placement.id,
            )

            return JsonResponse({
                'message': 'Placement created successfully',
                'id': placement.id,
            }, status=201)

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid placement data. Check the application ID, dates (YYYY-MM-DD), and salary.',
            }, status=400)

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


@csrf_exempt
def placement_detail_api(request, placement_id):
    placement = get_object_or_404(
        Placement.objects.select_related(
            'application__candidate',
            'application__job',
        ),
        id=placement_id,
    )

    if request.method == 'GET':
        return JsonResponse(placement_to_dict(placement))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')
            previous_offer = (
                placement.placement_status,
                placement.offer_date,
                placement.joining_date,
                placement.offered_salary,
            )

            if 'placement_status' in body:
                allowed_statuses = {
                    value for value, _label in Placement.STATUS_CHOICES
                }
                if body['placement_status'] not in allowed_statuses:
                    return JsonResponse({
                        'error': 'Invalid placement_status.',
                    }, status=400)
                placement.placement_status = body['placement_status']

            if 'offer_date' in body:
                placement.offer_date = parse_optional_placement_date(
                    body['offer_date']
                )

            if 'joining_date' in body:
                placement.joining_date = parse_optional_placement_date(
                    body['joining_date']
                )

            if 'offered_salary' in body:
                placement.offered_salary = parse_optional_offered_salary(
                    body['offered_salary']
                )

            if 'remarks' in body:
                placement.remarks = body['remarks']

            placement.save()

            updated_offer = (
                placement.placement_status,
                placement.offer_date,
                placement.joining_date,
                placement.offered_salary,
            )
            if updated_offer != previous_offer:
                notify_candidate(
                    placement.application.candidate,
                    'offer',
                    'Offer details updated',
                    f'Your offer for {placement.application.job.job_title} is now {placement.placement_status.replace("_", " ")}.',
                    'placement',
                    placement.id,
                )

            return JsonResponse({
                'message': 'Placement updated successfully',
            })

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid placement data.',
            }, status=400)

    if request.method == 'DELETE':
        placement.delete()
        return JsonResponse({
            'message': 'Placement deleted successfully',
        })

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )
    # ==============================
# PAYROLL HELPERS AND API
# ==============================

def payroll_to_dict(payroll):
    return {
        'id': payroll.id,
        'employee': payroll.employee_id,
        'employee_code': payroll.employee.employee_code,
        'employee_name': (
            f'{payroll.employee.first_name} '
            f'{payroll.employee.last_name}'
        ),
        'month': payroll.month,
        'year': payroll.year,
        'basic_salary': str(payroll.basic_salary),
        'allowances': str(payroll.allowances),
        'bonuses': str(payroll.bonuses),
        'deductions': str(payroll.deductions),
        'tax': str(payroll.tax),
        'net_salary': str(payroll.net_salary),
        'payment_date': (
            payroll.payment_date.isoformat()
            if payroll.payment_date else None
        ),
        'payment_status': payroll.payment_status,
        'created_at': payroll.created_at.isoformat(),
    }


def parse_payroll_amount(value, field_name, required=False):
    if value in (None, ''):
        if required:
            raise ValueError(f'{field_name} is required.')
        return Decimal('0.00')

    amount = Decimal(str(value))

    if (
        not amount.is_finite()
        or amount < 0
        or amount > Decimal('9999999999.99')
        or amount.as_tuple().exponent < -2
    ):
        raise ValueError(f'Invalid {field_name}.')

    return amount


def parse_payroll_date(value):
    if value in (None, ''):
        return None

    return datetime.strptime(value, '%Y-%m-%d').date()


def validate_payroll_period(month, year):
    if month < 1 or month > 12:
        raise ValueError('Month must be between 1 and 12.')

    if year < 1:
        raise ValueError('Year must be a positive number.')


def calculate_net_salary(basic, allowances, bonuses, deductions, tax):
    net_salary = basic + allowances + bonuses - deductions - tax

    if net_salary < 0:
        raise ValueError('Net salary cannot be negative.')

    if net_salary > Decimal('9999999999.99'):
        raise ValueError('Net salary is too large.')

    return net_salary


@csrf_exempt
@csrf_exempt
def payroll_api(request):
    if request.method == 'GET':
        payroll_records = apply_list_filters(
            request,
            Payroll.objects.select_related('employee')
            .all()
            .order_by('-year', '-month', '-id'),
            search_fields=[
                'employee__first_name',
                'employee__last_name',
                'employee__employee_code',
            ],
            exact_filters={
                'payment_status': 'payment_status',
            },
        )

        for parameter in ('month', 'year'):
            value = request.GET.get(parameter, '').strip()

            # Skip a filter when it wasn't included in the URL.
            if not value:
                continue

            if not value.isdigit():
                return JsonResponse({
                    'error': f'{parameter} must be a whole number.',
                }, status=400)

            number = int(value)

            if parameter == 'month' and not 1 <= number <= 12:
                return JsonResponse({
                    'error': 'month must be between 1 and 12.',
                }, status=400)

            if parameter == 'year' and number < 1:
                return JsonResponse({
                    'error': 'year must be a positive number.',
                }, status=400)

            payroll_records = payroll_records.filter(
                **{parameter: number}
            )

        return JsonResponse(
            [
                payroll_to_dict(record)
                for record in payroll_records
            ],
            safe=False,
        )

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')

            required_fields = ('employee', 'month', 'year', 'basic_salary')
            missing_fields = [
                field for field in required_fields
                if body.get(field) in (None, '')
            ]

            if missing_fields:
                return JsonResponse({
                    'error': 'Missing required fields: '
                             + ', '.join(missing_fields),
                }, status=400)

            employee = get_object_or_404(
                Employee,
                id=int(body['employee']),
            )
            month = int(body['month'])
            year = int(body['year'])
            validate_payroll_period(month, year)

            if Payroll.objects.filter(
                employee=employee,
                month=month,
                year=year,
            ).exists():
                return JsonResponse({
                    'error': 'A payroll record already exists for this employee and period.',
                }, status=409)

            basic_salary = parse_payroll_amount(
                body.get('basic_salary'),
                'basic_salary',
                required=True,
            )
            allowances = parse_payroll_amount(
                body.get('allowances', 0),
                'allowances',
            )
            bonuses = parse_payroll_amount(
                body.get('bonuses', 0),
                'bonuses',
            )
            deductions = parse_payroll_amount(
                body.get('deductions', 0),
                'deductions',
            )
            tax = parse_payroll_amount(
                body.get('tax', 0),
                'tax',
            )

            payment_status = body.get('payment_status', 'pending')
            allowed_statuses = {
                value
                for value, _label in Payroll.PAYMENT_STATUS_CHOICES
            }

            if payment_status not in allowed_statuses:
                return JsonResponse({
                    'error': 'Invalid payment_status.',
                }, status=400)

            payment_date = parse_payroll_date(
                body.get('payment_date')
            )

            if payment_status == 'paid' and payment_date is None:
                return JsonResponse({
                    'error': 'payment_date is required when payment_status is paid.',
                }, status=400)

            net_salary = calculate_net_salary(
                basic_salary,
                allowances,
                bonuses,
                deductions,
                tax,
            )

            payroll = Payroll.objects.create(
                employee=employee,
                month=month,
                year=year,
                basic_salary=basic_salary,
                allowances=allowances,
                bonuses=bonuses,
                deductions=deductions,
                tax=tax,
                net_salary=net_salary,
                payment_date=payment_date,
                payment_status=payment_status,
            )

            return JsonResponse({
                'message': 'Payroll record created successfully',
                'id': payroll.id,
                'net_salary': str(payroll.net_salary),
            }, status=201)

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid payroll data. Check employee ID, month, year, and salary amounts.',
            }, status=400)

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


@csrf_exempt
def payroll_detail_api(request, payroll_id):
    payroll = get_object_or_404(
        Payroll.objects.select_related('employee'),
        id=payroll_id,
    )

    if request.method == 'GET':
        return JsonResponse(payroll_to_dict(payroll))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')

            employee = payroll.employee
            if 'employee' in body:
                employee = get_object_or_404(
                    Employee,
                    id=int(body['employee']),
                )

            month = int(body.get('month', payroll.month))
            year = int(body.get('year', payroll.year))
            validate_payroll_period(month, year)

            duplicate = Payroll.objects.filter(
                employee=employee,
                month=month,
                year=year,
            ).exclude(id=payroll.id).exists()

            if duplicate:
                return JsonResponse({
                    'error': 'A payroll record already exists for this employee and period.',
                }, status=409)

            basic_salary = payroll.basic_salary
            if 'basic_salary' in body:
                basic_salary = parse_payroll_amount(
                    body['basic_salary'],
                    'basic_salary',
                    required=True,
                )

            allowances = payroll.allowances
            if 'allowances' in body:
                allowances = parse_payroll_amount(
                    body['allowances'],
                    'allowances',
                )

            bonuses = payroll.bonuses
            if 'bonuses' in body:
                bonuses = parse_payroll_amount(
                    body['bonuses'],
                    'bonuses',
                )

            deductions = payroll.deductions
            if 'deductions' in body:
                deductions = parse_payroll_amount(
                    body['deductions'],
                    'deductions',
                )

            tax = payroll.tax
            if 'tax' in body:
                tax = parse_payroll_amount(
                    body['tax'],
                    'tax',
                )

            payment_status = body.get(
                'payment_status',
                payroll.payment_status,
            )
            allowed_statuses = {
                value
                for value, _label in Payroll.PAYMENT_STATUS_CHOICES
            }

            if payment_status not in allowed_statuses:
                return JsonResponse({
                    'error': 'Invalid payment_status.',
                }, status=400)

            payment_date = payroll.payment_date
            if 'payment_date' in body:
                payment_date = parse_payroll_date(body['payment_date'])

            if payment_status == 'paid' and payment_date is None:
                return JsonResponse({
                    'error': 'payment_date is required when payment_status is paid.',
                }, status=400)

            payroll.employee = employee
            payroll.month = month
            payroll.year = year
            payroll.basic_salary = basic_salary
            payroll.allowances = allowances
            payroll.bonuses = bonuses
            payroll.deductions = deductions
            payroll.tax = tax
            payroll.net_salary = calculate_net_salary(
                basic_salary,
                allowances,
                bonuses,
                deductions,
                tax,
            )
            payroll.payment_status = payment_status
            payroll.payment_date = payment_date
            payroll.save()

            return JsonResponse({
                'message': 'Payroll record updated successfully',
                'net_salary': str(payroll.net_salary),
            })

        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({
                'error': 'Invalid payroll data.',
            }, status=400)

    if request.method == 'DELETE':
        payroll.delete()
        return JsonResponse({
            'message': 'Payroll record deleted successfully',
        })

    return JsonResponse(
        {'error': 'Method not allowed'},
        status=405,
    )


# ==============================
# REPORTS AND ANALYTICS API
# ==============================

def report_status_counts(queryset, field_name):
    return list(
        queryset.values(field_name)
        .annotate(count=Count('id'))
        .order_by(field_name)
    )


def report_money(value):
    return f'{(value or Decimal("0.00")):.2f}'


@csrf_exempt
def reports_dashboard_api(request):
    if request.method != 'GET':
        return JsonResponse({
            'error': 'Method not allowed',
        }, status=405)

    today = timezone.localdate()

    payroll_this_month_records = Payroll.objects.filter(
        month=today.month,
        year=today.year,
    )
    payroll_this_month = payroll_this_month_records.aggregate(
        total=Sum('net_salary')
    )['total']

    payroll_paid_this_month_records = Payroll.objects.filter(
        payment_status='paid',
        payment_date__year=today.year,
        payment_date__month=today.month,
    )
    payroll_paid_this_month = payroll_paid_this_month_records.aggregate(
        total=Sum('net_salary')
    )['total']

    payroll_payment_date_this_month_records = Payroll.objects.filter(
        payment_date__year=today.year,
        payment_date__month=today.month,
    )
    payroll_by_status = payroll_payment_date_this_month_records.values(
        'payment_status'
    ).annotate(
        record_count=Count('id'),
        net_salary_total=Sum('net_salary'),
    ).order_by('payment_status')

    departments = Department.objects.annotate(
        employee_count=Count('employees', distinct=True),
        job_count=Count('jobs', distinct=True),
    ).values(
        'id',
        'department_name',
        'employee_count',
        'job_count',
    ).order_by('department_name')

    attendance_today = Attendance.objects.filter(date=today)

    candidate_fees = Candidate.objects.annotate(
        payments_total=Sum('payments__amount')
    )
    total_fee_amount = candidate_fees.aggregate(total=Sum('course_fee'))['total'] or Decimal('0.00')
    total_candidate_revenue = CandidatePayment.objects.aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    total_due_amount = sum(
        (
            max(candidate.course_fee - (candidate.payments_total or Decimal('0.00')), Decimal('0.00'))
            for candidate in candidate_fees
        ),
        Decimal('0.00'),
    )

    month_points = []
    for months_ago in reversed(range(6)):
        month_index = today.year * 12 + today.month - 1 - months_ago
        year = month_index // 12
        month = month_index % 12 + 1
        amount = CandidatePayment.objects.filter(
            payment_date__year=year,
            payment_date__month=month,
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        month_points.append({
            'year': year,
            'month': month,
            'label': datetime(year, month, 1).strftime('%b'),
            'income': report_money(amount),
            'course_fee_collected': report_money(amount),
        })

    placement_counts = {
        row['placement_status']: row['count']
        for row in Placement.objects.values('placement_status').annotate(count=Count('id'))
    }
    placement_progress = [
        {'label': 'Offered', 'count': placement_counts.get('offered', 0)},
        {'label': 'Accepted', 'count': placement_counts.get('accepted', 0)},
        {'label': 'Joined', 'count': placement_counts.get('joined', 0)},
        {'label': 'Rejected', 'count': placement_counts.get('rejected', 0)},
        {'label': 'Withdrawn', 'count': placement_counts.get('withdrawn', 0)},
    ]
    placed_candidates = Placement.objects.filter(
        placement_status__in=['accepted', 'joined']
    ).values('application__candidate_id').distinct().count()

    current_time = timezone.localtime().time().replace(tzinfo=None)
    scheduled_interviews = Interview.objects.filter(
        interview_status='scheduled',
    ).filter(
        Q(interview_date__gt=today)
        | Q(interview_date=today, interview_time__gte=current_time)
    ).count()

    return JsonResponse({
        'generated_at': timezone.now().isoformat(),

        'overview': {
            'total_departments': Department.objects.count(),
            'total_employees': Employee.objects.count(),
            'active_employees': Employee.objects.filter(
                employee_status='active'
            ).count(),
            'total_candidates': Candidate.objects.count(),
            'total_jobs': Job.objects.count(),
            'open_jobs': Job.objects.filter(status='open').count(),
            'total_applications': Application.objects.count(),
            'scheduled_upcoming_interviews': scheduled_interviews,
            'total_placements': Placement.objects.count(),
            'placed_candidates': placed_candidates,
            'total_revenue': report_money(total_candidate_revenue),
            'total_candidate_fees': report_money(total_fee_amount),
            'total_course_fees': report_money(total_fee_amount),
            'total_due_amount': report_money(total_due_amount),
            'pending_leaves': Leave.objects.filter(status='pending').count(),
            'total_payroll_records': Payroll.objects.count(),
        },

        'candidates_by_status': report_status_counts(
            Candidate.objects.all(),
            'profile_status',
        ),

        'jobs_by_status': report_status_counts(
            Job.objects.all(),
            'status',
        ),

        'applications_by_status': report_status_counts(
            Application.objects.all(),
            'application_status',
        ),

        'interviews_by_status': report_status_counts(
            Interview.objects.all(),
            'interview_status',
        ),

        'placements_by_status': report_status_counts(
            Placement.objects.all(),
            'placement_status',
        ),

        'leaves_by_status': report_status_counts(
            Leave.objects.all(),
            'status',
        ),

        'attendance_today': {
            'date': today.isoformat(),
            'total_records': attendance_today.count(),
            'by_status': report_status_counts(
                attendance_today,
                'status',
            ),
        },

        'payroll': {
            'month': today.month,
            'year': today.year,
            # Payroll-period total (for records assigned to this month).
            'current_month_net_salary_total': report_money(
                payroll_this_month
            ),
            # Cash paid this calendar month, regardless of payroll period.
            'paid_this_month_total': report_money(payroll_paid_this_month),
            'paid_this_month_record_count': payroll_paid_this_month_records.count(),
            'by_status': [
                {
                    'payment_status': row['payment_status'],
                    'record_count': row['record_count'],
                    'net_salary_total': report_money(
                        row['net_salary_total']
                    ),
                }
                for row in payroll_by_status
            ],
        },

        'placement_progress': placement_progress,
        'monthly_income': month_points,
        'financials': {
            'total_fees': report_money(total_fee_amount),
            'total_course_fees': report_money(total_fee_amount),
            'total_collected': report_money(total_candidate_revenue),
            'course_fee_collected': report_money(total_candidate_revenue),
            'total_due': report_money(total_due_amount),
            'course_fee_due': report_money(total_due_amount),
        },

        'departments': list(departments),
    })

# ==============================
# ATTENDANCE API
# ==============================

def attendance_to_dict(record):
    return {
        'id': record.id,
        'employee': record.employee_id,
        'employee_code': record.employee.employee_code,
        'employee_name': f'{record.employee.first_name} {record.employee.last_name}'.strip(),
        'date': record.date.isoformat(),
        'check_in': record.check_in.isoformat() if record.check_in else None,
        'check_out': record.check_out.isoformat() if record.check_out else None,
        'working_hours': str(record.working_hours) if record.working_hours is not None else None,
        'status': record.status,
        'remarks': record.remarks,
        'created_at': record.created_at.isoformat(),
    }


def parse_attendance_time(value):
    if value in (None, ''):
        return None
    return datetime.strptime(value, '%H:%M').time()


def parse_attendance_hours(value):
    if value in (None, ''):
        return None
    hours = Decimal(str(value))
    if not hours.is_finite() or hours < 0 or hours > Decimal('24'):
        raise ValueError('Working hours must be between 0 and 24.')
    return hours


def parse_attendance_date(value):
    return datetime.strptime(value, '%Y-%m-%d').date()


@csrf_exempt
def employee_options_api(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    employees = Employee.objects.filter(employee_status='active').order_by('first_name', 'last_name')
    return JsonResponse([
        {
            'id': employee.id,
            'employee_code': employee.employee_code,
            'first_name': employee.first_name,
            'last_name': employee.last_name,
            'employee_name': f'{employee.first_name} {employee.last_name}'.strip(),
        }
        for employee in employees
    ], safe=False)


@csrf_exempt
def attendance_api(request):
    if request.method == 'GET':
        records = Attendance.objects.select_related('employee').all().order_by('-date', '-id')
        query = request.GET.get('q', '').strip()
        status = request.GET.get('status', '').strip()
        date_value = request.GET.get('date', '').strip()

        if query:
            records = records.filter(
                Q(employee__first_name__icontains=query)
                | Q(employee__last_name__icontains=query)
                | Q(employee__employee_code__icontains=query)
            )

        if status:
            records = records.filter(status=status)

        if date_value:
            try:
                records = records.filter(date=parse_attendance_date(date_value))
            except (TypeError, ValueError):
                return JsonResponse({'error': 'date must use YYYY-MM-DD format.'}, status=400)

        return JsonResponse([attendance_to_dict(record) for record in records], safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
            if body.get('employee') in (None, '') or body.get('date') in (None, ''):
                return JsonResponse({'error': 'employee and date are required.'}, status=400)

            employee = get_object_or_404(Employee, id=int(body['employee']))
            attendance_date = parse_attendance_date(body['date'])
            status = body.get('status', 'present')
            allowed_statuses = {value for value, _label in Attendance.STATUS_CHOICES}
            if status not in allowed_statuses:
                return JsonResponse({'error': 'Invalid attendance status.'}, status=400)

            if Attendance.objects.filter(employee=employee, date=attendance_date).exists():
                return JsonResponse({'error': 'Attendance already exists for this employee and date.'}, status=409)

            check_in = parse_attendance_time(body.get('check_in'))
            check_out = parse_attendance_time(body.get('check_out'))
            working_hours = parse_attendance_hours(body.get('working_hours'))
            if check_in and check_out and check_out < check_in:
                return JsonResponse({'error': 'Check-out time must be after check-in time.'}, status=400)

            record = Attendance.objects.create(
                employee=employee,
                date=attendance_date,
                check_in=check_in,
                check_out=check_out,
                working_hours=working_hours,
                status=status,
                remarks=body.get('remarks', ''),
            )
            return JsonResponse({'message': 'Attendance recorded successfully', 'id': record.id}, status=201)
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid attendance data. Check employee, date, time, and working hours.'}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def attendance_detail_api(request, attendance_id):
    record = get_object_or_404(Attendance.objects.select_related('employee'), id=attendance_id)

    if request.method == 'GET':
        return JsonResponse(attendance_to_dict(record))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')

            if 'date' in body:
                record.date = parse_attendance_date(body['date'])
            if 'check_in' in body:
                record.check_in = parse_attendance_time(body['check_in'])
            if 'check_out' in body:
                record.check_out = parse_attendance_time(body['check_out'])
            if 'working_hours' in body:
                record.working_hours = parse_attendance_hours(body['working_hours'])
            if 'status' in body:
                allowed_statuses = {value for value, _label in Attendance.STATUS_CHOICES}
                if body['status'] not in allowed_statuses:
                    return JsonResponse({'error': 'Invalid attendance status.'}, status=400)
                record.status = body['status']
            if 'remarks' in body:
                record.remarks = body['remarks']

            if record.check_in and record.check_out and record.check_out < record.check_in:
                return JsonResponse({'error': 'Check-out time must be after check-in time.'}, status=400)

            if Attendance.objects.filter(employee=record.employee, date=record.date).exclude(id=record.id).exists():
                return JsonResponse({'error': 'Attendance already exists for this employee and date.'}, status=409)

            record.save()
            return JsonResponse({'message': 'Attendance updated successfully'})
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid attendance data.'}, status=400)

    if request.method == 'DELETE':
        return delete_hrms_record(record, 'attendance record')

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ==============================
# LEAVE API
# ==============================

def leave_to_dict(leave):
    return {
        'id': leave.id,
        'employee': leave.employee_id,
        'employee_code': leave.employee.employee_code,
        'employee_name': f'{leave.employee.first_name} {leave.employee.last_name}'.strip(),
        'leave_type': leave.leave_type,
        'start_date': leave.start_date.isoformat(),
        'end_date': leave.end_date.isoformat(),
        'number_of_days': str(leave.number_of_days),
        'reason': leave.reason,
        'applied_date': leave.applied_date.isoformat(),
        'approved_by': leave.approved_by_id,
        'approved_by_name': (
            f'{leave.approved_by.first_name} {leave.approved_by.last_name}'.strip()
            if leave.approved_by else None
        ),
        'status': leave.status,
        'remarks': leave.remarks,
    }


def parse_leave_date(value):
    return datetime.strptime(value, '%Y-%m-%d').date()


def parse_leave_days(value):
    days = Decimal(str(value))
    if (
        not days.is_finite()
        or days <= 0
        or days > Decimal('366.0')
        or days.as_tuple().exponent < -1
    ):
        raise ValueError('number_of_days must be greater than 0 and at most 366.')
    return days


@csrf_exempt
def leave_api(request):
    if request.method == 'GET':
        leaves = Leave.objects.select_related('employee', 'approved_by').all().order_by('-applied_date', '-id')
        query = request.GET.get('q', '').strip()
        status = request.GET.get('status', '').strip()
        leave_type = request.GET.get('leave_type', '').strip()

        if query:
            leaves = leaves.filter(
                Q(employee__first_name__icontains=query)
                | Q(employee__last_name__icontains=query)
                | Q(employee__employee_code__icontains=query)
            )
        if status:
            leaves = leaves.filter(status=status)
        if leave_type:
            leaves = leaves.filter(leave_type=leave_type)

        return JsonResponse([leave_to_dict(leave) for leave in leaves], safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
            required = ('employee', 'leave_type', 'start_date', 'end_date', 'number_of_days', 'reason')
            missing = [field for field in required if body.get(field) in (None, '')]
            if missing:
                return JsonResponse({'error': 'Missing required fields: ' + ', '.join(missing)}, status=400)

            employee = get_object_or_404(Employee, id=int(body['employee']))
            start_date = parse_leave_date(body['start_date'])
            end_date = parse_leave_date(body['end_date'])
            if end_date < start_date:
                return JsonResponse({'error': 'end_date must be on or after start_date.'}, status=400)

            leave_type = body['leave_type']
            allowed_types = {value for value, _label in Leave.LEAVE_TYPE_CHOICES}
            if leave_type not in allowed_types:
                return JsonResponse({'error': 'Invalid leave_type.'}, status=400)

            number_of_days = parse_leave_days(body['number_of_days'])
            leave = Leave.objects.create(
                employee=employee,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                number_of_days=number_of_days,
                reason=str(body['reason']).strip(),
                status='pending',
            )
            return JsonResponse({'message': 'Leave request created successfully', 'id': leave.id}, status=201)
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid leave data. Check employee, leave type, dates, and number of days.'}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def leave_detail_api(request, leave_id):
    leave = get_object_or_404(
        Leave.objects.select_related('employee', 'approved_by'),
        id=leave_id,
    )

    if request.method == 'GET':
        return JsonResponse(leave_to_dict(leave))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')

            if 'employee' in body:
                leave.employee = get_object_or_404(Employee, id=int(body['employee']))

            if 'leave_type' in body:
                allowed_types = {value for value, _label in Leave.LEAVE_TYPE_CHOICES}
                if body['leave_type'] not in allowed_types:
                    return JsonResponse({'error': 'Invalid leave_type.'}, status=400)
                leave.leave_type = body['leave_type']

            if 'start_date' in body:
                leave.start_date = parse_leave_date(body['start_date'])
            if 'end_date' in body:
                leave.end_date = parse_leave_date(body['end_date'])
            if leave.end_date < leave.start_date:
                return JsonResponse({'error': 'end_date must be on or after start_date.'}, status=400)

            if 'number_of_days' in body:
                leave.number_of_days = parse_leave_days(body['number_of_days'])
            if 'reason' in body:
                leave.reason = str(body['reason']).strip()
            if 'status' in body:
                allowed_statuses = {value for value, _label in Leave.STATUS_CHOICES}
                if body['status'] not in allowed_statuses:
                    return JsonResponse({'error': 'Invalid leave status.'}, status=400)
                leave.status = body['status']
            if 'remarks' in body:
                leave.remarks = body['remarks']

            leave.save()
            return JsonResponse({'message': 'Leave request updated successfully'})
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid leave data.'}, status=400)

    if request.method == 'DELETE':
        return delete_hrms_record(leave, 'leave request')

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ==============================
# EMPLOYEE API
# ==============================

def employee_to_dict(employee):
    return {
        'id': employee.id,
        'employee_id': employee.employee_id,
        'employee_code': employee.employee_code,
        'first_name': employee.first_name,
        'last_name': employee.last_name,
        'email': employee.email,
        'phone': employee.phone,
        'date_of_birth': employee.date_of_birth.isoformat() if employee.date_of_birth else None,
        'gender': employee.gender,
        'address': employee.address,
        'department': employee.department_id,
        'department_name': employee.department.department_name,
        'designation': employee.designation,
        'joining_date': employee.joining_date.isoformat(),
        'employment_type': employee.employment_type,
        'salary': str(employee.salary),
        'manager': employee.manager_id,
        'manager_name': (
            f'{employee.manager.first_name} {employee.manager.last_name}'.strip()
            if employee.manager else None
        ),
        'employee_status': employee.employee_status,
        'created_at': employee.created_at.isoformat(),
    }


def parse_employee_date(value, optional=False):
    if optional and value in (None, ''):
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def employee_duplicate_exists(body, employee=None):
    checks = (
        ('employee_id', 'employee_id'),
        ('employee_code', 'employee_code'),
        ('email', 'email'),
    )
    for key, field in checks:
        value = body.get(key)
        if value and Employee.objects.filter(**{field: value}).exclude(
            id=employee.id if employee else None
        ).exists():
            return key
    return None


@csrf_exempt
def employee_api(request):
    if request.method == 'GET':
        employees = Employee.objects.select_related('department', 'manager').all().order_by('-id')
        query = request.GET.get('q', '').strip()
        status = request.GET.get('employee_status', '').strip()
        department = request.GET.get('department', '').strip()

        if query:
            employees = employees.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(employee_code__icontains=query)
                | Q(employee_id__icontains=query)
                | Q(email__icontains=query)
            )
        if status:
            employees = employees.filter(employee_status=status)
        if department:
            if not department.isdigit():
                return JsonResponse({'error': 'department must be a whole number.'}, status=400)
            employees = employees.filter(department_id=int(department))

        return JsonResponse([employee_to_dict(employee) for employee in employees], safe=False)

    if request.method == 'POST':
        try:
            body = json.loads(request.body or '{}')
            required = (
                'employee_id', 'employee_code', 'first_name', 'last_name',
                'email', 'phone', 'department', 'designation', 'joining_date',
                'employment_type', 'salary',
            )
            missing = [field for field in required if body.get(field) in (None, '')]
            if missing:
                return JsonResponse({'error': 'Missing required fields: ' + ', '.join(missing)}, status=400)

            duplicate = employee_duplicate_exists(body)
            if duplicate:
                return JsonResponse({'error': f'{duplicate} already exists.'}, status=409)

            department = get_object_or_404(Department, id=int(body['department']))
            manager = None
            if body.get('manager') not in (None, ''):
                manager = get_object_or_404(Employee, id=int(body['manager']))

            gender = body.get('gender', '')
            if gender and gender not in {value for value, _label in Employee.GENDER_CHOICES}:
                return JsonResponse({'error': 'Invalid gender.'}, status=400)
            employment_type = body['employment_type']
            if employment_type not in {value for value, _label in Employee.EMPLOYMENT_TYPE_CHOICES}:
                return JsonResponse({'error': 'Invalid employment_type.'}, status=400)
            status = body.get('employee_status', 'active')
            if status not in {value for value, _label in Employee.STATUS_CHOICES}:
                return JsonResponse({'error': 'Invalid employee_status.'}, status=400)

            employee = Employee.objects.create(
                employee_id=body['employee_id'].strip(),
                employee_code=body['employee_code'].strip(),
                first_name=body['first_name'].strip(),
                last_name=body['last_name'].strip(),
                email=body['email'].strip(),
                phone=body['phone'].strip(),
                date_of_birth=parse_employee_date(body.get('date_of_birth'), optional=True),
                gender=gender,
                address=body.get('address', ''),
                department=department,
                designation=body['designation'].strip(),
                joining_date=parse_employee_date(body['joining_date']),
                employment_type=employment_type,
                salary=parse_payroll_amount(body['salary'], 'salary', required=True),
                manager=manager,
                employee_status=status,
            )
            return JsonResponse({'message': 'Employee created successfully', 'id': employee.id}, status=201)
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid employee data. Check required fields, dates, and salary.'}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def employee_detail_api(request, employee_id):
    employee = get_object_or_404(
        Employee.objects.select_related('department', 'manager'),
        id=employee_id,
    )

    if request.method == 'GET':
        return JsonResponse(employee_to_dict(employee))

    if request.method == 'PUT':
        try:
            body = json.loads(request.body or '{}')
            duplicate = employee_duplicate_exists(body, employee)
            if duplicate:
                return JsonResponse({'error': f'{duplicate} already exists.'}, status=409)

            for field in ('employee_id', 'employee_code', 'first_name', 'last_name', 'email', 'phone', 'address', 'designation'):
                if field in body:
                    setattr(employee, field, body[field].strip() if isinstance(body[field], str) else body[field])

            if 'department' in body:
                employee.department = get_object_or_404(Department, id=int(body['department']))
            if 'date_of_birth' in body:
                employee.date_of_birth = parse_employee_date(body['date_of_birth'], optional=True)
            if 'joining_date' in body:
                employee.joining_date = parse_employee_date(body['joining_date'])
            if 'salary' in body:
                employee.salary = parse_payroll_amount(body['salary'], 'salary', required=True)
            if 'gender' in body:
                if body['gender'] and body['gender'] not in {value for value, _label in Employee.GENDER_CHOICES}:
                    return JsonResponse({'error': 'Invalid gender.'}, status=400)
                employee.gender = body['gender']
            if 'employment_type' in body:
                if body['employment_type'] not in {value for value, _label in Employee.EMPLOYMENT_TYPE_CHOICES}:
                    return JsonResponse({'error': 'Invalid employment_type.'}, status=400)
                employee.employment_type = body['employment_type']
            if 'employee_status' in body:
                if body['employee_status'] not in {value for value, _label in Employee.STATUS_CHOICES}:
                    return JsonResponse({'error': 'Invalid employee_status.'}, status=400)
                employee.employee_status = body['employee_status']
            if 'manager' in body:
                employee.manager = (
                    get_object_or_404(Employee, id=int(body['manager']))
                    if body['manager'] not in (None, '')
                    else None
                )
                if employee.manager_id == employee.id:
                    return JsonResponse({'error': 'An employee cannot be their own manager.'}, status=400)

            employee.save()
            return JsonResponse({'message': 'Employee updated successfully'})
        except (json.JSONDecodeError, TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'Invalid employee data.'}, status=400)

    if request.method == 'DELETE':
        return delete_hrms_record(employee, 'employee')

    return JsonResponse({'error': 'Method not allowed'}, status=405)
