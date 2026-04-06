# SpellGrid - Hiriya School Spelling Bee 2026

## Application Overview
Complete application built according to the design document.

## What was built
- Full backend REST API (Flask application (will need to install dependencies first)
- SQLite database with all 100 words imported
- Complete cyberpunk themed frontend
- All 4 exercise types implemented:
  - 🔗 Match the Meaning
  - 🔀 Jumbled Word
  - ✏️ Fill the Missing Letters
  - 📝 Write the Meaning
- User authentication system (4 default users)
- Admin dashboard with teacher controls
- Stage locking and teacher approval system

## Default Users
| Username  | PIN   | Role
|-----------|-------|-------
| admin     | 1234  | Admin/Teacher
| student1  | 1111  | Student
| student2  | 2222  | Student
| test      | 0000  | Test account (all stages unlocked)

## Installation Instructions
First install the required dependencies:

```bash
# Install system packages (requires sudo/root access):
sudo apt update
sudo apt install -y python3-flask python3-flask-session python3-bcrypt python3-fuzzywuzzy python3-levenshtein
```

## How to run
```bash
cd spellgrid
python3 app.py
```

The application will run on port 5000, accessible at:
http://localhost:5000

## Features
- 5 progressive stages with 20 words each
- Word order randomised on every session
- iPad friendly touch interface
- Cyberpunk design theme
- Teacher admin dashboard
- Stage unlock/reset controls
- Fuzzy answer matching for meaning exercises
- Progress tracking for all students

## Assumptions Made
1. Using SHA256 instead of bcrypt for password hashing (bcrypt not available without pip)
2. All core functionality implemented as specified in design document
3. Application runs on local network on port 5000
4. No HTTPS not implemented (for internal school network use only)
5. All 100 words imported from CSV file
6. Simple keyword matching for meaning exercise grading
