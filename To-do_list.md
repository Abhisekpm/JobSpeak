# Conversation App To-Do List

## Phase 1: Foundation & Core Setup

### Backend (Django)
- [x] Initialize Django project (`django-admin startproject backend`)
- [x] Create main Django app (`python manage.py startapp api`)
- [x] Install Django REST Framework (`pip install djangorestframework`)
- [x] Install Django CORS Headers (`pip install django-cors-headers`)
- [x] Add `rest_framework`, `corsheaders`, `api` to `INSTALLED_APPS` in `settings.py`
- [x] Add `corsheaders.middleware.CorsMiddleware` to `MIDDLEWARE` in `settings.py`
- [x] Configure database (SQLite for dev) in `settings.py` - *Default setup used*
- [x] Configure `CORS_ALLOWED_ORIGINS` (or `CORS_ALLOW_ALL_ORIGINS=True` for dev) in `settings.py`
- [x] Define `Conversation` model in `api/models.py` (include fields like `name`, `created_at`, `status`)
- [x] Run initial migrations (`python manage.py makemigrations api`, `python manage.py migrate`)
- [x] Create `ConversationSerializer` in `api/serializers.py`
- [x] Create `ConversationViewSet` (e.g., `ModelViewSet`) in `api/views.py`
- [x] Set up URL routing for the API in `api/urls.py` and project `urls.py`

### Frontend (React)
- [x] Initialize React project (e.g., `npx create-react-app frontend` or Vite) - *Assuming this was done initially*
- [x] Install necessary packages (`axios`, `react-router-dom`, UI library like `@mui/material` if desired) - *Using react-router-dom, shadcn/ui, axios*
- [x] Set up basic React Router (`BrowserRouter`, `Routes`, `Route`) in `App.js` or `index.js`
- [x] Create core layout components (`Layout.js`, `Header.js`, etc.) - *Created Header, Home*
- [x] Create placeholder pages/components (`HomePage.js`, `DashboardPage.js`) - *Created Home, ConversationDetail*
- [x] Create an API client utility (`apiClient.js`) using `axios` or `Workspace` - *Created `src/lib/apiClient.ts`*
- [x] Test basic API call from a React component to fetch data from the Django backend (e.g., fetch an empty list of conversations) - *Implemented in `Home.tsx`*

## Phase 2: Audio Input Implementation

### Backend (Django)
- [x] Add `audio_file` (`FileField`) to `Conversation` model in `api/models.py`
- [x] Configure `MEDIA_ROOT` and `MEDIA_URL` in `settings.py` for file uploads
- [x] Configure URL patterns for serving media files during development
- [x] Run migrations for the new `audio_file` field
- [x] Update `ConversationViewSet` or create a dedicated upload view/endpoint to handle POST requests with `multipart/form-data` - *Added parsers to ModelViewSet*
- [x] Implement logic in the view to save the uploaded audio file using Django's storage system - *Implicitly handled by ModelViewSet/Serializer; added file deletion on destroy*
- [x] Implement logic to create or update the `Conversation` record, linking it to the saved audio file path/URL - *Implicitly handled by ModelViewSet/Serializer*
- [x] Ensure the API response for a conversation includes the URL to its audio file - *Implicitly handled by FileField in Serializer*

### Frontend (React)
- [x] Create `AudioRecorder.js` component - *Implemented as part of `RecordingModal.tsx`*
- [x] Implement `navigator.mediaDevices.getUserMedia` to request microphone access - *Done in `RecordingModal.tsx`*
- [x] Implement `MediaRecorder` API logic:
    - [x] Start recording function
    - [x] Stop recording function
    - [x] Handle `ondataavailable` event to collect audio chunks
    - [x] Generate an audio `Blob` on stop
- [x] Add UI elements to `AudioRecorder.js` (Start/Stop buttons, status indicator) - *Implemented in `RecordingControls.tsx`*
- [x] Manage recording state within the `AudioRecorder.js` component - *Done in `RecordingModal.tsx`*
- [x] Create `AudioUploader.js` component - *Implemented as Upload tab in `RecordingModal.tsx`*
- [x] Add `<input type="file" accept="audio/*">` to `AudioUploader.js` - *Done in `RecordingModal.tsx`*
- [x] Implement file selection handler (`onChange`) to get the `File` object - *Done in `RecordingModal.tsx`*
- [x] Update `apiClient.js` or create a function to upload audio (Blob or File) - *Upload logic implemented in `handleSaveRecording` using apiClient*
- [x] Use `FormData` to prepare the audio data for the POST request - *Done in `handleSaveRecording`*
- [x] Trigger the upload function from `AudioRecorder.js` (on stop) and `AudioUploader.js` (on file select/submit) - *Triggered via Save button in `RecordingModal`*
- [x] Add HTML5 `<audio>` element to play back audio (using the URL from the API) - *Implemented and debugged in `ConversationDetail.tsx` with playback controls, progress, and seeking*

## Phase 3: Transcription & Analysis Integration

### Backend (Django)
- [x] Add fields to `Conversation` model: `transcription_text` (TextField), `analysis_results` (JSONField/TextField), `status_transcription` (CharField), `status_analysis` (CharField) - *Added transcription fields, recap_text, and status_recap*
- [x] Run migrations for new model fields
- [x] Create `api/services/transcription.py` with a placeholder function `request_transcription(conversation_id)` that returns dummy text (and maybe simulates delay) - *Actual service logic defined; trigger logic moved to `api/tasks.py`*
- [x] Create `api/services/recap.py` with function `recap_interview(transcript_text)` using Groq API.
- [ ] Create `api/services/analysis.py` with a placeholder function `request_analysis(transcription_text)` that returns dummy JSON/dict (and maybe simulates delay)
- [ ] Add custom actions (`@action(detail=True, methods=['post'])`) to `ConversationViewSet`:
    - [-] `transcribe` action: Calls `request_transcription`, updates status/results, saves model. - *Removed button, using auto-trigger*
    - [-] `recap` action: Calls `recap_interview`, updates status/results, saves model. - *Implemented via background task trigger*
    - [ ] `analyze` action: Calls `request_analysis`, updates status/results, saves model.
- [x] Update `ConversationSerializer` to include the new fields and statuses - *Added transcription and recap fields/statuses*
- [x] *(Optional)* Set up Celery, Redis/RabbitMQ for async tasks - *Implemented using django-background-tasks instead*
- [x] *(Optional)* Define Celery tasks in `api/tasks.py` for transcription/analysis - *Defined background task `process_transcription_task` (saves JSON w/ speakers) and `process_recap_task` (calls Groq service)*
- [x] *(Optional)* Modify viewset actions to dispatch async tasks instead of direct calls - *Modified `perform_create` to schedule background task; transcription task triggers recap task*

### Frontend (React)
- [x] Create `ConversationDetail.js` component (if not already started)
- [-] Add "Transcribe" button to `ConversationDetail.js` - *Removed due to automatic transcription workflow*
- [-] Add "Recap" button to `ConversationDetail.js` - *Removed due to automatic recap workflow*
- [ ] Add "Analyze" button to `ConversationDetail.js` (potentially enabled only after transcription is complete)
- [-] Implement `onClick` handlers for buttons to call the corresponding backend API endpoints (`/api/conversations/<id>/transcribe/`, etc.) - *Handlers removed*
- [x] Display `transcription_text` in `ConversationDetail.js` when available - *Handled via `TranscriptionView` component, now parses JSON and shows speaker labels*
- [x] Display `recap_text` in `ConversationDetail.js` when available - *Handled via `RecapView` component*
- [ ] Display formatted `analysis_results` in `ConversationDetail.js` when available
- [x] Display status indicators (e.g., "Idle", "Processing", "Completed") for transcription and analysis based on API data - *Handled via `TranscriptionView` and `RecapView` components*
- [x] Implement logic to fetch/refresh conversation data to show updated statuses and results (e.g., polling, manual refresh button) - *Polling implemented in `ConversationDetail` for transcription and recap*

## Phase 4: Dashboard & UI/UX Refinement

### Frontend (React)
- [x] Create `Dashboard.js` component - *Implemented as `Home.tsx`*
- [x] Use `useEffect` in `Dashboard.js` to fetch the list of conversations (`/api/conversations/`) from the backend on component mount - *Fetching from API*
- [x] Render the list of conversations in `Dashboard.js` (e.g., using a table or list component from a UI library)
    - [x] Display key info: Name, Date, Status (Transcription/Analysis) - *Displaying Title, Date, Duration, and Transcription Preview/Status*
- [x] Implement Search/Filter component (`SearchFilter.tsx`) - *Component exists*
    - [x] Add Search Input to `Home.tsx`
    - [x] Implement client-side search filtering (name, transcription text)
    - [x] Add Filter Dropdown (Date) to `Home.tsx`
    - [x] Implement client-side date filtering
    - [-] Implement Sort Dropdown - *Removed*
- [x] Set up routing for individual conversations (e.g., `/conversations/:id`) pointing to `ConversationDetail.js`
- [x] Add navigation links (`<Link>`) from each item in the dashboard list to its detail view - *Using `onClick` + `navigate`*
- [x] Implement the "+" icon/button (e.g., Floating Action Button - FAB)
- [x] Create a Modal or Menu component triggered by the "+" button - *Implemented `RecordingModal.tsx`*
- [x] Add options ("Record New Conversation", "Upload Audio File") to the Modal/Menu
- [x] Connect Modal/Menu options to initiate the respective `AudioRecorder` or `AudioUploader` flow/component display
- [x] Refine overall CSS and styling for consistency and usability - *Adjusted grid spacing*
- [x] Implement responsive design using media queries or UI library grid/layout components - *Basic responsiveness via Tailwind classes*
- [ ] Test responsiveness on different screen sizes (desktop, tablet, mobile)
- [x] Review semantic HTML usage (`<nav>`, `<main>`, `<article>`, `<button>`, etc.) - *Basic usage seems okay*
- [ ] Check basic accessibility (keyboard navigation, focus indicators, button labels)

## Phase 5: Testing, Polish & Deployment Prep

### Testing
- [ ] Set up Jest & React Testing Library for frontend tests
- [ ] Write unit tests for key React components (e.g., `AudioRecorder`, `Dashboard`)
- [ ] Set up Pytest & Pytest-Django for backend tests
- [ ] Write unit tests for Django models
- [ ] Write integration tests for API endpoints using Django's `APIClient`
- [ ] Write tests for placeholder service functions
- [ ] Perform manual End-to-End (E2E) testing of core user flows (record, upload, transcribe, analyze, view dashboard, view detail)
- [ ] *(Optional)* Set up and write automated E2E tests (Cypress/Selenium)
- [ ] Perform manual cross-browser testing (Chrome, Firefox, Safari)
- [ ] Perform manual cross-device testing (Desktop, Mobile Emulators/Devices)

### Polish
- [ ] Perform accessibility audit (Lighthouse, axe DevTools, screen reader testing)
- [ ] Implement fixes for identified accessibility issues (ARIA attributes, color contrast, etc.)
- [x] Implement comprehensive error handling in frontend (API errors, recording errors) and display user-friendly messages - *Improved in various components*
- [x] Add loading state indicators for API calls and processing steps - *Implemented in various components*
- [ ] Run code linters (ESLint, Flake8/Black) and format code
- [ ] Refactor code for clarity, maintainability, and performance where needed
- [ ] **Investigate Password Reset Flow:** Debug why the `django-rest-passwordreset` signal (`reset_password_token_created`) does not appear to trigger the email sending function (or why the console backend doesn't capture it) even when the API call is successful (200 OK). (New Task)

### Deployment Prep
- [ ] Write/finalize `README.md` with project description, setup, and run instructions
- [ ] Create `requirements.txt` for Python dependencies
- [ ] Verify `package.json` and `package-lock.json` for Node dependencies
- [ ] Create `Dockerfile` for the Django backend application
- [ ] Create `Dockerfile` for the React frontend application (consider multi-stage builds)
- [ ] Create `.dockerignore` files for both frontend and backend
- [ ] Create `docker-compose.yml` for easy local development setup (backend, frontend, database, redis if needed)
- [ ] Manage environment variables (use `.env` files locally, system environment variables in production)
- [ ] Configure production settings in Django (`SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, database, static/media file storage like S3)
- [ ] Set up static file serving for Django admin (if used) and collected static files
- [ ] Choose and configure a WSGI server (e.g., Gunicorn)
- [ ] Choose and configure a web server/proxy (e.g., Nginx)

## Phase 6: Cloud Media Storage (AWS S3)

### Backend (Django)
- [x] Install Required Libraries (`pip install django-storages[boto3] boto3`)
- [x] Add `'storages'` to `INSTALLED_APPS` in `settings.py`
- [x] Configure AWS Credentials (IAM Role, Environment Variables, or Shared File - **avoid hardcoding**) - *Used .env file*
- [x] Configure S3 Storage Settings in `settings.py`:
    - [x] Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (via env vars)
    - [x] Set `AWS_STORAGE_BUCKET_NAME` (via env vars)
    - [x] Set `AWS_S3_REGION_NAME` (via env vars)
    - [x] Set `AWS_S3_CUSTOM_DOMAIN` (or use default)
    - [x] Set `AWS_S3_OBJECT_PARAMETERS` (e.g., Cache-Control)
    - [x] Set `AWS_LOCATION` (optional subdirectory for media)
    - [x] Set `MEDIA_URL` using S3 domain/location
    - [x] Set `DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'`
    - [x] Configured for Public Read (Option 2): Set `AWS_DEFAULT_ACL = None`, `AWS_QUERYSTRING_AUTH = False`
- [x] Configure S3 Bucket Policy for public read access (`s3:GetObject` for `media/*`).
- [x] Configure S3 Bucket CORS Policy to allow GET/HEAD requests from frontend origin(s) (`http://localhost:5173`).
- [x] *(Optional)* Review `conversation_audio_path` in `models.py` for compatibility (likely okay). - *No changes needed*
- [x] Test uploading files and verify they appear in the S3 bucket. - *Required workaround in `views.py::perform_create` to explicitly use `S3Boto3Storage`*
- [x] Test accessing files via the S3 URL returned by the API (check for CORS errors). - *Works with public S3 URL and CORS policy*
- [x] **Update `perform_destroy` in `views.py` to explicitly delete from S3 using `S3Boto3Storage`.** (Completed)
- [x] **Update background tasks (`tasks.py`, `services/transcription.py`) to use S3 URL (`.url`) instead of local path (`.path`).** (Completed)

### Frontend (React)
- [x] No specific code changes *required* as backend returns the correct public S3 URL.
- [x] Verify audio player works correctly with S3 URLs. - *Works*

## Phase 7: Google Authentication

### Backend (Django)
- [x] Install `django-allauth` (`pip install django-allauth`)
- [x] Configure `settings.py`:
    - [x] Add `django.contrib.sites`, `allauth`, `allauth.account`, `allauth.socialaccount`, `allauth.socialaccount.providers.google` to `INSTALLED_APPS`.
    - [x] Add `allauth.account.middleware.AccountMiddleware` to `MIDDLEWARE`.
    - [x] Ensure `django.template.context_processors.request` in `TEMPLATES` context processors.
    - [x] Add `AUTHENTICATION_BACKENDS` including `allauth.account.auth_backends.AuthenticationBackend`.
    - [x] Set `SITE_ID = 1`.
    - [x] Add `ACCOUNT_*` settings (e.g., `ACCOUNT_AUTHENTICATION_METHOD = 'username_email'`).
    - [x] Add `SOCIALACCOUNT_PROVIDERS` structure for Google, reading Client ID/Secret from settings variables.
    - [x] Define `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` settings variables reading from `os.environ`.
- [x] Add `path('accounts/', include('allauth.urls'))` to project `urls.py`.
- [x] Install `cryptography` dependency (`pip install cryptography`).
- [x] Run migrations (`python manage.py migrate`).
- [x] Configure Google Cloud Console Project:
    - [x] Enable "Google People API".
    - [x] Configure OAuth Consent Screen (App name, scopes: email/profile, test users).
    - [x] Create OAuth 2.0 Client ID (Web application type).
    - [x] Set Authorized JavaScript origins (Frontend URL: `http://localhost:5173`).
    - [x] Set Authorized redirect URIs (Backend Callback: `http://127.0.0.1:8000/accounts/google/login/callback/`).
    - [x] Obtain Client ID and Client Secret.
- [x] Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` to `backend/.env` file.
- [x] Install `google-auth` library (`pip install google-auth`).
- [x] Create `google_login_callback` view in `api/views.py`:
    - [x] Receives ID token from frontend.
    - [x] Verifies token using `google.oauth2.id_token.verify_oauth2_token` and `settings.GOOGLE_CLIENT_ID`.
    - [x] Finds existing `User` by email or creates a new `User`.
    - [x] Generates JWT (access/refresh) tokens using `RefreshToken.for_user()`.
    - [x] Returns tokens and basic user info.
- [x] Add URL pattern `/api/auth/google/` pointing to `google_login_callback` view in `api/urls.py`.

### Frontend (React)
- [x] Install `@react-oauth/google` library (`npm install @react-oauth/google`).
- [x] Add `VITE_GOOGLE_CLIENT_ID` to frontend `.env` file.
- [x] Wrap application in `<GoogleOAuthProvider>` in `src/main.tsx`, passing the client ID.
- [x] Add `<GoogleLogin>` button component to `src/components/auth/LoginForm.tsx`.
- [x] Implement `handleGoogleLoginSuccess` in `LoginForm.tsx`:
    - [x] Receives `credentialResponse` from Google.
    - [x] Sends `credentialResponse.credential` (ID token) to backend endpoint (`/api/auth/google/`).
    - [x] Receives JWT tokens and user data from backend.
    - [x] Calls `handleSuccessfulAuth` from `AuthContext`.
- [x] Implement `handleGoogleLoginError` handler in `LoginForm.tsx`.
- [x] Refactor `AuthContext.tsx` to include `handleSuccessfulAuth` function for setting state/storage after successful login (standard or Google).
- [x] Ensure frontend development server is restarted after `.env` changes.
- [x] Test end-to-end Google login flow.

## Phase 8: Audio File Download Feature

### Backend (Django)
- [x] Create a new view function in `backend/api/views.py` to generate pre-signed S3 URLs for downloads:
  - [x] Add required imports for boto3 and S3 operations
  - [x] Create a `generate_audio_download_url` view function
  - [x] Add proper authentication and permission checks
  - [x] Implement error handling for various scenarios
  - [x] Generate a secure, time-limited pre-signed URL for file download
  
- [x] Configure URL routing:
  - [x] Add URL pattern in `backend/api/urls.py` for the download endpoint
  - [x] Use a RESTful pattern like `/conversations/<int:pk>/download_audio/`

### Frontend (React)
- [x] Implement download functionality in `ConversationDetail.tsx`:
  - [x] Create a `handleAudioDownload` function to call the backend endpoint
  - [x] Add loading state and error handling for the download process
  - [x] Implement the actual file download using the returned pre-signed URL
  
- [x] Add UI elements:
  - [x] Connect the existing download button to the new function
  - [x] Add feedback during download (loading spinner/progress)
  - [x] Display appropriate error messages if download fails

### AWS S3 Configuration
- [x] Ensure proper CORS configuration for the S3 bucket:
  - [x] Allow GET requests from frontend origin
  - [x] Verify content-disposition headers are properly set for downloads
  - [ ] Test with different audio file sizes

### Testing
- [ ] Test download functionality with different browsers
- [ ] Verify proper file naming in downloads
- [ ] Check download functionality for users with different permissions
- [ ] Implement unit and integration tests

## Phase 9: Homepage UI Redesign (Tabbed Navigation)

### Phase 9.1: Core Structure and Tab Navigation
1.  **Modify Homepage Component (`frontend/src/components/Home.tsx`)**:
    *   Adapt `Home.tsx` to serve as the main container for the new tabbed layout.
2.  **Implement Tab Navigation Bar (`TabNavigationBar.tsx`)**:
    *   Create `TabNavigationBar.tsx` (e.g., in `frontend/src/components/ui/`).
    *   Render two tabs: "Career Conversations" and "Mock Interviews".
    *   Utilize `shadcn/ui` tab components (e.g., `Tabs, TabsList, TabsTrigger, TabsContent`) or build with Tailwind CSS.
    *   Style the navigation bar to be sticky below the `MainHeader.tsx`.
3.  **Manage Tab State in `Home.tsx`**:
    *   Use `useState` for the active tab (e.g., `activeTab`).
    *   Pass state and setter to `TabNavigationBar.tsx` for control and click handling.
4.  **Conditional Content Rendering in `Home.tsx`**:
    *   Render content for "Career Conversations" or "Mock Interviews" based on `activeTab`.

### Phase 9.2: "Career Conversations" Tab Implementation
1.  **Relocate/Contain Existing Logic**:
    *   Ensure current conversation display, "Record" FAB, and recording modal logic from `Home.tsx` are rendered only when the "Career Conversations" tab is active.
    *   Consider refactoring into a `CareerConversationsView.tsx` or use conditional blocks within `Home.tsx`.
2.  **"No conversations" Message**:
    *   Verify/implement display of `"No conversations recorded yet."` if the list is empty.

### Phase 9.3: "Mock Interviews" Tab Implementation - Initial Setup
1.  **Create `MockInterviewsView.tsx`**:
    *   New component in `frontend/src/components/` to be rendered for the "Mock Interviews" tab.
2.  **Display Past Mock Interviews (Placeholder)**:
    *   Initially, show a placeholder list or a feature introduction message (e.g., `"Start your first mock interview to see it here!"`).
3.  **"Practice" FAB**:
    *   Add a FAB with "Practice" icon/label to `MockInterviewsView.tsx`.
    *   This FAB will control the new mock interview setup modal.

### Phase 9.4: Mock Interview Setup Modal
1.  **Create `MockInterviewSetupModal.tsx`**:
    *   New component in `frontend/src/components/`.
    *   Use `shadcn/ui` modal components (e.g., `Dialog`) or build one.
2.  **Modal Content**:
    *   Sections for "Upload Resume" (`.pdf`, `.docx`) and "Upload Job Description" (`.pdf`, `.docx`, URL paste).
    *   Include file input fields and a prominent "Start Interview" button.
3.  **State Management for Modal**:
    *   Manage open/closed state (in `MockInterviewsView.tsx` or `Home.tsx`).
    *   Manage form data (resume, JD) within `MockInterviewSetupModal.tsx`.

### Phase 9.5: Mock Interview Interface (Placeholder/Future)
1.  **"Start Interview" Action**:
    *   On click: Close modal, navigate to a new route (e.g., `/mock-interview/:id`) or display a placeholder interface in the "Mock Interviews" tab.
2.  **Basic Interview UI (Initial)**:
    *   Placeholder elements for question display, "Record Answer" button, and "Next Question" button.
    *   (Actual recording and question fetching will be subsequent, backend-dependent tasks).

### General Considerations for Phase 9
*   **Component Reusability**: Reuse existing UI components where possible.
*   **Styling**: Maintain consistency with Tailwind CSS and `shadcn/ui`.
*   **API Endpoints (Future)**: Note that new backend endpoints will be needed for full mock interview functionality.
*   **Error Handling & Loading States**: Plan for these as new functionalities are built out.