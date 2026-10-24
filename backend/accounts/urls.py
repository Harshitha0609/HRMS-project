from django.urls import path
from .views import (
    login_view,
    logout_view,
    register_candidate_view,
    session_view,
    candidate_profile_view,
    candidate_fees_view,
    candidate_courses_view,
    candidate_interviews_view,
    candidate_offers_view,
    candidate_offer_response_view,
    candidate_notifications_view,
    mark_candidate_notification_read_view,
    mark_all_candidate_notifications_read_view,
)


urlpatterns = [
    path('profile/', candidate_profile_view, name='candidate-profile'),
    path('fees/', candidate_fees_view, name='candidate-fees'),
    path('courses/', candidate_courses_view, name='candidate-courses'),
    path('interviews/', candidate_interviews_view, name='candidate-interviews'),
    path('offers/', candidate_offers_view, name='candidate-offers'),
    path('offers/<int:placement_id>/', candidate_offer_response_view, name='candidate-offer-response'),
    path('notifications/', candidate_notifications_view, name='candidate-notifications'),
    path('notifications/read-all/', mark_all_candidate_notifications_read_view, name='candidate-notifications-read-all'),
    path('notifications/<int:notification_id>/read/', mark_candidate_notification_read_view, name='candidate-notification-read'),
    path('register/', register_candidate_view, name='candidate-register'),
    path('login/', login_view, name='login'),
    path('session/', session_view, name='session'),
    path('logout/', logout_view, name='logout'),
]

