from django.contrib import admin
from .models import CandidatePayment, Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('course_name', 'duration', 'course_fee', 'status', 'updated_at')
    list_filter = ('status',)
    search_fields = ('course_name', 'description')


@admin.register(CandidatePayment)
class CandidatePaymentAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'amount', 'payment_date', 'note', 'created_at')
    list_filter = ('payment_date',)
    search_fields = ('candidate__first_name', 'candidate__last_name', 'candidate__email')
