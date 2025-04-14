from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import UserProfile

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a UserProfile instance automatically when a new User is created."""
    if created:
        UserProfile.objects.create(user=instance)
        print(f"Created UserProfile for user: {instance.username}")

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    """
    Ensure the UserProfile is saved whenever the User object is saved.
    This isn't strictly necessary if UserProfile only links via OneToOne,
    but can be useful if profile fields depend on user fields later.
    It doesn't hurt to have it.
    """
    # Check if the user has a profile. If they were just created,
    # the create_user_profile signal might not have finished yet,
    # or if the user existed before this signal was added.
    if hasattr(instance, 'userprofile'):
        instance.userprofile.save()
        # print(f"Saved UserProfile for user: {instance.username}")
    else:
        # If the user somehow exists without a profile (e.g., created before signals),
        # create one now.
        UserProfile.objects.get_or_create(user=instance)
        print(f"Ensured UserProfile exists for user: {instance.username}") 