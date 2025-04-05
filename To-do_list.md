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
- [ ] Update `apiClient.js` or create a function to upload audio (Blob or File)
- [ ] Use `FormData` to prepare the audio data for the POST request
- [ ] Trigger the upload function from `AudioRecorder.js` (on stop) and `AudioUploader.js` (on file select/submit) - *Currently saving Blob/File to state*
- [x] Add HTML5 `<audio>` element to play back audio (using the URL from the API) - *Element present in `ConversationDetail.tsx`, but playback logic is basic*

## Phase 3: Transcription & Analysis Integration

### Backend (Django)
- [ ] Add fields to `Conversation` model: `transcription_text` (TextField), `analysis_results` (JSONField/TextField), `status_transcription` (CharField), `status_analysis` (CharField)
- [ ] Run migrations for new model fields
- [ ] Create `api/services/transcription.py` with a placeholder function `request_transcription(conversation_id)` that returns dummy text (and maybe simulates delay)
- [ ] Create `api/services/analysis.py` with a placeholder function `request_analysis(transcription_text)` that returns dummy JSON/dict (and maybe simulates delay)
- [ ] Add custom actions (`@action(detail=True, methods=['post'])`) to `ConversationViewSet`:
    - [ ] `transcribe` action: Calls `request_transcription`, updates status/results, saves model.
    - [ ] `analyze` action: Calls `request_analysis`, updates status/results, saves model.
- [ ] Update `ConversationSerializer` to include the new fields and statuses
- [ ] *(Optional)* Set up Celery, Redis/RabbitMQ for async tasks
- [ ] *(Optional)* Define Celery tasks in `api/tasks.py` for transcription/analysis
- [ ] *(Optional)* Modify viewset actions to dispatch async tasks instead of direct calls

### Frontend (React)
- [x] Create `ConversationDetail.js` component (if not already started)
- [ ] Add "Transcribe" button to `ConversationDetail.js`
- [ ] Add "Analyze" button to `ConversationDetail.js` (potentially enabled only after transcription is complete)
- [ ] Implement `onClick` handlers for buttons to call the corresponding backend API endpoints (`/api/conversations/<id>/transcribe/`, etc.)
- [ ] Display `transcription_text` in `ConversationDetail.js` when available
- [ ] Display formatted `analysis_results` in `ConversationDetail.js` when available
- [ ] Display status indicators (e.g., "Idle", "Processing", "Completed") for transcription and analysis based on API data
- [ ] Implement logic to fetch/refresh conversation data to show updated statuses and results (e.g., polling, manual refresh button)

## Phase 4: Dashboard & UI/UX Refinement

### Frontend (React)
- [ ] Create `Dashboard.js` component
- [ ] Use `useEffect` in `Dashboard.js` to fetch the list of conversations (`/api/conversations/`) from the backend on component mount
- [ ] Render the list of conversations in `Dashboard.js` (e.g., using a table or list component from a UI library)
    - [ ] Display key info: Name, Date, Status (Transcription/Analysis)
- [ ] Set up routing for individual conversations (e.g., `/conversations/:id`) pointing to `ConversationDetail.js`
- [ ] Add navigation links (`<Link>`) from each item in the dashboard list to its detail view
- [ ] Implement the "+" icon/button (e.g., Floating Action Button - FAB)
- [ ] Create a Modal or Menu component triggered by the "+" button
- [ ] Add options ("Record New Conversation", "Upload Audio File") to the Modal/Menu
- [ ] Connect Modal/Menu options to initiate the respective `AudioRecorder` or `AudioUploader` flow/component display
- [ ] Refine overall CSS and styling for consistency and usability
- [ ] Implement responsive design using media queries or UI library grid/layout components
- [ ] Test responsiveness on different screen sizes (desktop, tablet, mobile)
- [ ] Review semantic HTML usage (`<nav>`, `<main>`, `<article>`, `<button>`, etc.)
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
- [ ] Implement comprehensive error handling in frontend (API errors, recording errors) and display user-friendly messages
- [ ] Add loading state indicators for API calls and processing steps
- [ ] Run code linters (ESLint, Flake8/Black) and format code
- [ ] Refactor code for clarity, maintainability, and performance where needed

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
