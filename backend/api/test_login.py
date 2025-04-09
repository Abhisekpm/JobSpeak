"""
A simple script to test the token endpoint.
Run this with: python manage.py shell < api/test_login.py
"""

import json
from django.contrib.auth import get_user_model
from django.test.client import Client
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

# List all users for reference
print("\nAll users in database:")
for user in User.objects.all():
    print(f"Username: {user.username}, Email: {user.email}")

# Test username we'll use
test_username = "test"
test_password = "1234"

# Test direct token creation with the serializer
print("\nTesting direct token creation with serializer:")
try:
    serializer = TokenObtainPairSerializer(data={
        'username': test_username,
        'password': test_password
    })
    if serializer.is_valid():
        print("Token serializer validation successful!")
        print(serializer.validated_data)
    else:
        print("Token serializer validation failed!")
        print(serializer.errors)
except Exception as e:
    print(f"Exception during serializer test: {str(e)}")

# Test via HTTP client
print("\nTesting via HTTP client:")
client = Client()

# Test with username
username_data = {
    'username': test_username,
    'password': test_password
}
print(f"Trying username login with: {json.dumps(username_data)}")
username_response = client.post('/api/token/', data=username_data, content_type='application/json')
print(f"Username login response: {username_response.status_code}")
print(f"Response content: {username_response.content.decode()}")

# Test with email
email = None
try:
    user = User.objects.get(username=test_username)
    email = user.email
except User.DoesNotExist:
    print(f"Could not find user with username: {test_username}")

if email:
    email_data = {
        'email': email,
        'password': test_password
    }
    print(f"Trying email login with: {json.dumps(email_data)}")
    email_response = client.post('/api/token/', data=email_data, content_type='application/json')
    print(f"Email login response: {email_response.status_code}")
    print(f"Response content: {email_response.content.decode()}")
