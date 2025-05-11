# JobSpeak Homepage Redesign Specification

## 🎯 Goal

Redesign the homepage of a web app called **JobSpeak** that helps job seekers gain confidence through AI-assisted career support. This involves adding tabbed navigation and specific functionalities to each tab.

## 🧠 Background

JobSpeak supports two key features:

1. **Career Conversations**  
   Users can record and review networking calls, mentorship sessions, and informational interviews. The app provides AI-powered feedback to improve their communication.

2. **Mock Interviews**  
   Users upload a resume and a job description, and receive customized mock interview questions.

## 🛠️ Design Requirements

### 🔝 Header

- Retain the existing `JobSpeak` header component (e.g., `MainHeader.tsx`) at the top of the page.

### 🗂️ Tab Navigation

- Implement a new tab navigation bar directly below the existing header.
- It should contain two clear tabs:
  - **Career Conversations**
  - **Mock Interviews**
- The tab navigation bar should be fixed/sticky at the top (just below the header), so it remains visible during scroll.
- Default to the **Career Conversations** tab on initial page load.
- Switching tabs should load the corresponding content **dynamically** (without a full page reload).
- Manage active tab state locally (e.g., via React `useState` or `useReducer`).

### 🎙️ "Career Conversations" Tab

- When active:
  - Display a list of existing career conversations.
  - If there are no conversations, show a message:  
    `"No conversations recorded yet."`
- Include a Material Design-style **Floating Action Button (FAB)** with a "Record" icon or text in the bottom-right.
- On clicking the "Record" FAB:
  - Open the existing **recording modal** (allows starting a new audio recording or selecting an existing audio file).

### 💼 "Mock Interviews" Tab

- When active:
  - Display a list of past mock interviews.
  - If none, show a brief feature introduction.
- Include a **FAB** with a "Practice" icon or label in the bottom-right.
- On clicking "Practice":
  - Open a new **modal** with:
    - **Upload Resume** section (`.pdf`, `.docx`)
    - **Upload Job Description** section (`.pdf`, `.docx`, or allow web URL paste)
    - Prominent **"Start Interview"** button
- On clicking "Start Interview":
  - Close modal (or transition to a full interview view)
  - Show mock interview interface with:
    - Displayed questions (e.g., `"Question X of Y"`)
    - **"Record Answer"** button (using Web Audio API)
    - **"Next Question"** button

## 🎨 Visual Consistency

- Maintain the current JobSpeak UI style:
  - Clean
  - Modern
  - Accessible
- (Optional) Use:
  - `Material UI` components for modals, tabs, and buttons  
  **or**
  - Tailwind CSS utility classes for styling

## 🗂️ File Structure (Optional)

- Place new components in:  
  `frontend/src/components/`

## ⚙️ Technology

- Frontend: `React.js`
- Language: `TypeScript`

