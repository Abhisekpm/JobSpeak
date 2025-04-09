"""
A simple script to test authentication - run with:
python manage.py shell < api/test_auth.py
"""
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate

User = get_user_model()

# List all users
print("All users in the system:")
for user in User.objects.all():
    print(f"Username: {user.username}, Email: {user.email}")

# Test authentication
test_username = "testuser"
test_email = "test@example.com"
test_password = "password123"

# Try to authenticate with username
user = authenticate(username=test_username, password=test_password)
print(f"Auth with username result: {user}")

# Try to authenticate with email
# Note: Default Django auth doesn't support email login directly
# This is just to check if a user with this email exists
try:
    user = User.objects.get(email=test_email)
    auth_result = user.check_password(test_password)
    print(f"User with email {test_email} exists, password check: {auth_result}")
except User.DoesNotExist:
    print(f"No user with email {test_email}")
