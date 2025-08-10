# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobSpeakV2 is a conversation analysis and mock interview platform built with React/TypeScript frontend and Django backend. The application allows users to record conversations and interviews, get AI-powered transcription, analysis, and coaching feedback.

### Key Features
- Audio recording and file upload for conversations and mock interviews
- AI transcription using Deepgram
- Conversation analysis (talk time, sentiment, topics)
- AI coaching feedback using Google Generative AI
- Mock interview system with generated questions
- User authentication with JWT and Google OAuth
- AWS S3 integration for file storage

## Architecture

### Frontend (React/TypeScript/Vite)
- **Location**: `frontend/`
- **Framework**: React 18 with TypeScript, Vite for building
- **UI Library**: Radix UI components with Tailwind CSS
- **State Management**: React Context (AuthContext)
- **Routing**: React Router DOM
- **API Client**: Axios with JWT token management and auto-refresh

### Backend (Django/Python)
- **Location**: `backend/`
- **Framework**: Django 5.2 with Django REST Framework
- **Database**: Configurable via DATABASE_URL (SQLite for dev, PostgreSQL for prod)
- **Authentication**: JWT tokens with django-rest-framework-simplejwt, Google OAuth via django-allauth
- **File Storage**: AWS S3 (configurable fallback to local storage)
- **Background Tasks**: django-background-tasks

### Key Models
- **Conversation**: Core model for conversation recordings with status tracking for transcription, analysis, coaching, recap, and summary
- **Interview**: Mock interview sessions with question management and answer transcripts
- **UserProfile**: Extended user data with resume and job description file uploads

### Services Architecture
The backend uses a service-oriented architecture with dedicated modules in `backend/api/services/`:
- `transcription.py`: Deepgram API integration
- `analysis.py`: Conversation analysis (talk time, sentiment, topics)
- `coaching.py`: AI coaching feedback generation
- `recap.py`: Dialog-style conversation recaps
- `summary.py`: Multi-level summaries (short, balanced, detailed)
- `mock_interview.py`: Mock interview question generation

## Common Development Commands

### Frontend Development
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                   # Start development server (http://localhost:5173)
npm run build                 # Build for production
npm run build-no-errors       # Build ignoring TypeScript errors
npm run lint                  # Run ESLint
npm run preview               # Preview production build
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt    # Install dependencies
python manage.py runserver         # Start development server (http://localhost:8000)
python manage.py makemigrations    # Create new migrations
python manage.py migrate           # Apply migrations
python manage.py createsuperuser   # Create admin user
python manage.py collectstatic     # Collect static files
```

### Full Stack Development
- Start backend: `cd backend && python manage.py runserver`
- Start frontend: `cd frontend && npm run dev`
- Frontend will be available at http://localhost:5173
- Backend API will be available at http://localhost:8000/api/

## Environment Configuration

### Backend Environment Variables (backend/.env)
```
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=your-bucket-name
AWS_S3_REGION_NAME=us-east-1

# External API Keys
DEEPGRAM_API_KEY=your-deepgram-key
GOOGLE_API_KEY=your-google-ai-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend Environment Variables (frontend/.env)
```
VITE_API_URL=http://localhost:8000/api/
```

## Testing

### Frontend Testing
- Framework: Jest with React Testing Library
- Run tests: `cd frontend && npm test`

### Backend Testing
- Framework: Django's built-in testing with pytest
- Run tests: `cd backend && python manage.py test`
- Test files: `test_*.py` in the api app

## Important Development Notes

### From .cursor/system_prompt.txt:
- Always look for existing code to iterate on instead of creating new code
- Keep the codebase very clean and organized
- Avoid files over 200-300 lines of code
- Never add stubbing or fake data patterns to code that affects dev or prod environments
- Always think about what other methods and areas of code might be affected by code changes
- Write thorough tests for all major functionality
- After making changes, always start up a new server for testing
- Kill existing related servers before starting new ones

### API Status Flow
Most models use a consistent status flow: `pending` → `processing` → `completed` (or `failed`)
- Always update status fields when starting/completing operations
- Use background tasks for long-running operations

### File Upload Patterns
- All file uploads go through dynamic upload paths (see models.py)
- Files are stored in AWS S3 with organized folder structure
- Always handle both local and S3 storage scenarios

### Authentication Flow
- JWT tokens with automatic refresh via axios interceptors
- Google OAuth integration for social login
- Protected routes use ProtectedRoute component
- Backend uses JWT authentication for API endpoints

## Project Structure Notes

### Frontend Key Directories
- `src/components/`: Reusable React components
- `src/pages/`: Page-level components
- `src/lib/`: Utility functions and API client
- `src/contexts/`: React context providers
- `src/components/ui/`: Radix UI components with Tailwind styles

### Backend Key Directories
- `api/`: Main application with models, views, serializers
- `api/services/`: Service layer for external API integrations
- `api/migrations/`: Database migration files
- `backend/`: Django project configuration
- `media/`: Local file storage (development fallback)

### Component Patterns
- Use functional components with hooks
- Prefer composition over inheritance
- Follow existing naming conventions (PascalCase for components)
- Use TypeScript interfaces for props and data structures