from .models import Notification, User


def notify_candidate(candidate, category, title, message, related_type='', related_id=None):
    user = User.objects.filter(
        email__iexact=candidate.email,
        role='candidate',
        is_active=True,
    ).first()
    if user is None:
        return None

    return Notification.objects.create(
        recipient=user,
        category=category,
        title=title,
        message=message,
        related_type=related_type,
        related_id=related_id,
    )
