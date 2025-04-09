from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import json

User = get_user_model()

class FlexibleTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Print detailed debug info
        print(f"Token request received with data: {json.dumps(attrs, default=str)}")
        
        # Extract credentials
        username = attrs.get('username')
        password = attrs.get('password')
        
        # Check if username looks like an email
        if username and '@' in username:
            print(f"Username '{username}' looks like an email, trying to find user by email")
            try:
                # Try to find user by email
                user = User.objects.get(email=username)
                print(f"Found user with email {username}: {user.username}")
                # Replace with actual username for standard validation
                attrs['username'] = user.username
            except User.DoesNotExist:
                print(f"No user found with email: {username}")
                # Continue with normal validation, which will fail appropriately
        
        # Try standard validation
        try:
            result = super().validate(attrs)
            print("Token validation successful!")
            return result
        except Exception as e:
            print(f"Token validation failed with error: {str(e)}")
            if hasattr(e, 'detail'):
                print(f"Error details: {e.detail}")
            raise

class FlexibleTokenObtainPairView(TokenObtainPairView):
    serializer_class = FlexibleTokenObtainPairSerializer
