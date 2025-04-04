# Project Plan: Conversation Recording & Analysis SPA

**Core Technologies:**
* **Frontend:** React.js
* **Backend:** Django (likely with Django REST Framework for APIs)
* **Audio:** Web Audio API (Browser)
* **External Services:** Placeholder Transcription API, Placeholder Analysis API

**Key Features:**
* Record audio directly in the browser.
* Upload existing audio files.
* Unified "+" button for initiating recording or upload.
* Transcription of audio (via placeholder).
* Analysis of transcription (via placeholder).
* Dashboard to manage and review conversations.
* Responsive and accessible UI.

---

## High-Level Plan (Strategic View)

*This focuses on the major milestones and deliverables.*

1.  **Phase 1: Foundation & Core Setup (Week 1-2)**
    * **Goal:** Establish the basic project structure for both frontend and backend, including database setup and initial API communication.
    * **Deliverable:** A runnable React app communicating with a basic Django backend API endpoint. Initial database models defined.

2.  **Phase 2: Audio Input Implementation (Week 3-4)**
    * **Goal:** Implement core audio handling features - recording via Web Audio API and file uploading. Securely store audio data in the backend.
    * **Deliverable:** Frontend components for recording and uploading audio. Backend API endpoints to receive and store audio files linked to conversation records.

3.  **Phase 3: Transcription & Analysis Integration (Week 5-6)**
    * **Goal:** Integrate placeholder APIs for transcription and analysis. Process audio files, send them to placeholders, and store the results.
    * **Deliverable:** Backend logic to interact with placeholder APIs. API endpoints to trigger and retrieve transcription/analysis. Frontend display for results.

4.  **Phase 4: Dashboard & UI/UX Refinement (Week 7-8)**
    * **Goal:** Build the user-facing dashboard for managing conversations. Refine the UI, implement the "+" button flow, and ensure responsiveness and basic accessibility.
    * **Deliverable:** Functional dashboard displaying conversations. Intuitive workflow for creating/viewing conversations. Responsive design across common screen sizes.

5.  **Phase 5: Testing, Polish & Deployment Prep (Week 9-10)**
    * **Goal:** Thoroughly test the application, fix bugs, enhance accessibility, and prepare for deployment.
    * **Deliverable:** A well-tested, polished application meeting requirements. Documentation and deployment configuration.

---

## Mid-Level Plan (Tactical View)

*This breaks down phases into key modules and features.*

### Phase 1: Foundation & Core Setup
* Initialize React project (`create-react-app` or Vite).
* Initialize Django project and app.
* Set up Django REST Framework (DRF).
* Define initial Django Models (`Conversation` metadata: ID, timestamp, name, user [if auth added later], status).
* Create basic DRF Serializers and ViewSets for `Conversation`.
* Set up basic React routing (e.g., `react-router-dom`).
* Create core layout components in React (Header, Sidebar/Nav, Main Content).
* Establish basic API fetching mechanism in React (e.g., `Workspace` or `axios`).
* Configure CORS in Django (`django-cors-headers`).
* Set up database (SQLite for dev, PostgreSQL for prod).

### Phase 2: Audio Input Implementation
* **Frontend:**
    * Create `AudioRecorder` component using `navigator.mediaDevices.getUserMedia` and `MediaRecorder` API.
    * Implement UI controls (Start/Stop Recording).
    * Handle audio data (Blob generation).
    * Create `AudioUploader` component using `<input type="file" accept="audio/*">`.
    * Implement logic to send audio (Blob or File) to the backend API.
* **Backend:**
    * Add `audio_file` field (e.g., `FileField`) to `Conversation` model or a separate `Audio` model.
    * Configure Django file storage (e.g., `MEDIA_ROOT`, `MEDIA_URL`, consider S3 for scalability).
    * Create DRF endpoint (`/api/conversations/` or similar) to handle POST requests with audio data (multipart/form-data).
    * Save uploaded/recorded audio file and create/update the `Conversation` record.

### Phase 3: Transcription & Analysis Integration
* **Backend:**
    * Add fields to `Conversation` model (or separate models) for `transcription_text`, `analysis_results`, `transcription_status`, `analysis_status`.
    * Create placeholder service modules/functions in Django (`transcription_service.py`, `analysis_service.py`) that mimic API calls (e.g., wait simulate processing time, return dummy data).
    * Create API endpoints (e.g., `/api/conversations/<pk>/transcribe/`, `/api/conversations/<pk>/analyze/`) triggered by frontend requests.
    * Consider asynchronous task processing (Celery & Redis/RabbitMQ) if placeholder APIs are simulated as long-running.
    * Update conversation status and store results upon completion.
* **Frontend:**
    * Add buttons/actions in the UI to trigger transcription/analysis for a conversation.
    * Implement logic to call the new backend endpoints.
    * Display transcription text and analysis results when available.
    * Show status indicators (e.g., "Processing...", "Completed").

### Phase 4: Dashboard & UI/UX Refinement
* **Frontend:**
    * Create `Dashboard` component: Fetch list of conversations from `/api/conversations/`.
    * Display conversations in a list or table (show name, date, status).
    * Implement routing to a `ConversationDetail` view.
    * `ConversationDetail` view: Display audio player (HTML5 `<audio>`), transcription, analysis results.
    * Implement the "+" icon (e.g., Floating Action Button - FAB):
        * On click, show options (modal or menu): "Record New Conversation", "Upload Audio File".
        * Trigger `AudioRecorder` or `AudioUploader` component flow.
    * Refine overall CSS styling for a clean, intuitive look.
    * Implement responsive design using CSS media queries or a UI framework (like Material UI, Chakra UI, Tailwind CSS).
    * Review and improve accessibility (semantic HTML, ARIA attributes if needed).

### Phase 5: Testing, Polish & Deployment Prep
* Write unit tests for critical React components (Jest, React Testing Library).
* Write unit/integration tests for Django views, models, and services (Pytest).
* Perform end-to-end testing (manual or using tools like Cypress/Selenium).
* Cross-browser and cross-device testing.
* Accessibility audit (using browser tools, screen readers).
* Code cleanup, linting, and formatting.
* Add basic error handling and user feedback messages.
* Prepare deployment configuration (Dockerfile, `requirements.txt`, environment variables, web server like Gunicorn/Nginx).
* Basic documentation (README, setup instructions).

---

## Low-Level Plan (Operational View)

*This lists specific tasks and technical details for implementation.*

### Week 1: Setup
* `npx create-react-app frontend` / `npm create vite@latest frontend -- --template react`
* `cd frontend && npm install axios react-router-dom @mui/material @emotion/react @emotion/styled @mui/icons-material` (example UI lib)
* `django-admin startproject backend`
* `cd backend && python manage.py startapp api`
* Add `rest_framework`, `corsheaders`, and `api` to `INSTALLED_APPS`. Add `corsheaders.middleware.CorsMiddleware` to `MIDDLEWARE`.
* Configure `settings.py`: database, static/media files, `CORS_ALLOWED_ORIGINS`.
* `python manage.py makemigrations && python manage.py migrate`
* Define `Conversation` model in `api/models.py`.
* Create `ConversationSerializer` in `api/serializers.py`.
* Create `ConversationViewSet` in `api/views.py`.
* Register viewset with router in `api/urls.py` and project `urls.py`.
* Create basic React components: `App.js`, `Layout.js`, `HomePage.js`, `DashboardPage.js`.
* Set up `BrowserRouter` and `Routes` in `App.js`.
* Test basic API call from React to fetch dummy data from Django.

### Week 2-3: Audio Input
* Create `AudioRecorder.js`: Use `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, manage state (recording, paused, inactive), handle `ondataavailable` event, create Blob.
* Create `AudioUploader.js`: Use `<input type="file">`, handle `onChange` event, access `event.target.files[0]`.
* Create utility function `apiClient.js` for making API calls (using `axios` or `Workspace`).
* Implement `uploadAudio(audioData)` function using `FormData` to send Blob/File.
* Update `api/models.py`: Add `FileField` for audio.
* Configure `MEDIA_ROOT`, `MEDIA_URL` in `settings.py`.
* Update `api/views.py`: Modify `ConversationViewSet` or create a new upload view to handle `POST` with file data, save file using Django's file storage API, create `Conversation` record.
* Add `<audio>` element in React to playback saved audio (fetch URL from backend).

### Week 4-5: Transcription/Analysis Stubs
* Update `api/models.py`: Add fields for `transcription`, `analysis`, `status_transcription`, `status_analysis`. Run `makemigrations` / `migrate`.
* Create `api/services/transcription.py`: Define `request_transcription(conversation_id)` function (simulates API call, maybe uses `time.sleep`, returns dummy text).
* Create `api/services/analysis.py`: Define `request_analysis(transcription_text)` function (simulates API call, returns dummy JSON).
* Update `api/views.py`: Add custom actions to `ConversationViewSet` (using `@action` decorator) for `transcribe` and `analyze`. These actions will call the service functions.
* *Optional:* Integrate Celery: Define tasks in `api/tasks.py` for transcription/analysis, configure Celery broker (Redis/RabbitMQ), modify views to enqueue tasks instead of direct calls.
* Update `api/serializers.py`: Include new fields and status fields.
* In React's `ConversationDetail.js`: Add buttons "Transcribe" / "Analyze". Add `onClick` handlers to call the respective API endpoints. Display returned text/JSON. Implement polling or state refresh to show updated status/results.

### Week 6-7: Dashboard & UI
* Create `Dashboard.js`: Use `useEffect` hook to fetch `/api/conversations/` on mount. Map results to a table or list component (e.g., Material UI `Table` or `List`).
* Implement sorting/filtering options for the dashboard list (frontend or backend).
* Implement navigation from Dashboard list item to `ConversationDetail` page using `react-router-dom` (`Link` component).
* Create `FloatingActionButton.js` or similar component for the "+" icon.
* Implement a Modal component (`@mui/material/Modal`) triggered by the FAB. Modal contains "Record" and "Upload" buttons.
* Connect Modal buttons to activate the `AudioRecorder` or `AudioUploader` flow.
* Apply responsive styles: Use CSS Grid/Flexbox, media queries, or framework's responsive utilities (e.g., Material UI `Grid`, `Stack`, breakpoints).
* Ensure proper ARIA roles and attributes on interactive elements (buttons, inputs). Use semantic HTML (e.g., `<nav>`, `<main>`, `<button>`).

### Week 8-10: Testing & Polish
* Set up Jest/React Testing Library: `npm install --save-dev jest @testing-library/react @testing-library/jest-dom`. Write tests for components like `AudioRecorder`, `Dashboard`, form handling.
* Set up Pytest: `pip install pytest pytest-django`. Write tests for Django models, API endpoints (using `APIClient`), and service functions.
* Manual testing: Chrome, Firefox, Safari (desktop), iOS Safari, Android Chrome. Check responsiveness on different viewports.
* Use Lighthouse tab in Chrome DevTools for Performance, Accessibility, Best Practices, SEO audits.
* Implement comprehensive error handling (displaying user-friendly messages for API errors, recording failures, etc.).
* Add loading indicators during API calls.
* Write/update `README.md`.
* Create `Dockerfile` for frontend and backend.
* Create `docker-compose.yml` for local development environment (including DB, Redis if using Celery).
* Configure production environment variables (`SECRET_KEY`, `DATABASE_URL`, allowed hosts, storage settings).

---