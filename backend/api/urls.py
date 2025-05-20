from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConversationViewSet, 
    google_login_callback, 
    generate_audio_download_url, 
    UserProfileView,
    GetMockInterviewQuestionsView,
    register_user,
    InterviewViewSet
)

# Create a router and register our viewset with it.
router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'interviews', InterviewViewSet, basename='interview')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
    path('register/', register_user, name='register'),
    path('auth/google/', google_login_callback, name='google_login_callback'),
    path('conversations/<int:pk>/download_audio/', generate_audio_download_url, name='download-audio'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('mock-interview-questions/', GetMockInterviewQuestionsView.as_view(), name='mock-interview-questions'),
] 