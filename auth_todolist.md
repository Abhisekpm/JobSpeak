# Authentication Implementation To-Do List

## Backend Authentication Setup

- [ ] **Install Required Packages**
  - `pip install djangorestframework-simplejwt` - Adds JWT authentication to DRF
  - `pip install django-cors-headers` - For proper CORS support with auth headers

- [ ] **Configure Django Settings**
  - Add to `INSTALLED_APPS` in `backend/backend/settings.py`:
    - `'rest_framework_simplejwt'`
  - Add JWT configuration to REST_FRAMEWORK settings
  - Set token lifetimes (30 min for access, 7 days for refresh)

- [ ] **Add Auth URLs**
  - Create endpoints in `backend/backend/urls.py`:
    - `/api/token/` - For obtaining tokens (login)
    - `/api/token/refresh/` - For refreshing tokens
    - `/api/register/` - For user registration

- [ ] **Update User Model**
  - If needed, create a custom User model in `backend/api/models.py`
  - Add fields for job-specific information (job title, company)
  - **Do this before first migrations if possible**

- [ ] **Create Authentication Views**
  - Implement registration view in `backend/api/views.py`
  - Create user detail view for profile information
  - Add password reset functionality if needed

- [ ] **Update Conversation Model**
  - Add user foreign key to `Conversation` model: `user = models.ForeignKey(settings.AUTH_USER_MODEL, ...)`
  - Run migrations: `python manage.py makemigrations api && python manage.py migrate`
  - Consider data migration for existing conversations

- [ ] **Secure API Endpoints**
  - Add `permission_classes = [IsAuthenticated]` to `ConversationViewSet`
  - Filter conversations by user: `return Conversation.objects.filter(user=self.request.user)`
  - Assign user on creation: `serializer.save(user=self.request.user)`

## Frontend Authentication Implementation

- [ ] **Create Auth Context**
  - Create new file `src/contexts/AuthContext.tsx`
  - Implement state for `isAuthenticated`, `user`, and `loading`
  - Add functions for `login`, `register`, `logout`

- [ ] **Update API Client**
  - Modify `src/lib/apiClient.ts` to include auth tokens in requests
  - Add interceptor for authentication headers
  - Implement token refresh logic for 401 responses

- [ ] **Create Auth Components**
  - Create `src/components/auth/LoginForm.tsx`
  - Create `src/components/auth/RegisterForm.tsx`
  - Use existing UI components (Button, Input, etc.)

- [ ] **Implement Protected Routes**
  - Create `src/components/auth/ProtectedRoute.tsx` component
  - Create `src/components/auth/PublicRoute.tsx` for login/register pages
  - Update `App.tsx` routes to use these components

- [ ] **Update UI for Authentication**
  - Modify Header component to show login/logout/profile
  - Update Home component to only show user's conversations
  - Add loading states when checking authentication

## Testing and Deployment

- [ ] **Test Authentication Flow**
  - Create test user and verify login/logout works
  - Check that protected routes redirect correctly
  - Verify conversations are properly filtered by user

- [ ] **Security Checks**
  - Set secure token storage (localStorage or HttpOnly cookies)
  - Configure CORS properly in Django settings
  - Ensure all sensitive data is protected by authentication

- [ ] **Deployment Updates**
  - Update environment variables for production
  - Configure proper HTTPS for secure token transfer
  - Test authentication in staging environment before production

## Implementation Tips

### JWT Configuration
- In `settings.py`, use timedeltas for token lifetime:
  ```python
  from datetime import timedelta
  SIMPLE_JWT = {
      'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
      'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
  }
  ```

### React Auth Context Pattern
- Create a hook pattern for easy access to auth context:
  ```typescript
  export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
      throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
  };
  ```

### Token Storage
- For development, use localStorage for simplicity
- For production, consider HttpOnly cookies with proper CSRF protection
- Remember that localStorage is vulnerable to XSS attacks

### Common Issues
- CORS errors are frequent with auth - ensure headers are configured correctly
- Token expiration can cause sudden logouts - implement proper refresh logic
- Remember to filter data by user to prevent unauthorized access
