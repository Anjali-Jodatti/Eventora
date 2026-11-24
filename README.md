Eventora – Online Event, Workshop & Training Booking Application

Eventora is a web-based event, workshop, and training booking application developed using React and Firebase. It allows participants to explore available programs, book sessions, manage their bookings, and receive in-app notifications. Administrators can manage programs, trainers, and participant bookings through an admin dashboard.

Features

Participant Features

User registration and login.

Browse available events, workshops, and training programs.

Search programs by title or trainer.

Filter programs by category, type, and mode.

Sort programs by date and price.

View program details and available sessions.

Book available sessions.

View personal booking history.

Cancel confirmed bookings with a cancellation reason.

View and update personal profile information.

Receive booking confirmation and cancellation notifications.

Admin Features

Admin dashboard.

Add, edit, and delete programs.

Manage trainers.

View all participant bookings.

Manage booking cancellations.

Monitor program availability and seat inventory.

Additional Features

Firebase Authentication.

Cloud Firestore database.

Role-based access for participants and administrators.

Responsive user interface.

Firestore security rules.

In-app notification management.

Technologies Used

Technology

Purpose

React.js

Frontend development

Vite

Development and build tool

JavaScript

Application logic

CSS

Styling and responsive design

Firebase Authentication

User authentication

Cloud Firestore

Database management

Firebase Storage

File storage, when enabled

Lucide React

Icons

Project Structure

event-booking-app/
│
├── public/
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── firebase.js
│   ├── BookingPage.jsx
│   ├── ParticipantProfile.jsx
│   ├── AdminDashboard.jsx
│   ├── AdminPrograms.jsx
│   ├── AllBookings.jsx
│   ├── MyBookings.jsx
│   ├── Notifications.jsx
│   └── assets/
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md

Note: The structure above highlights important project files. Your actual folder may contain additional components and CSS files.

Installation and Setup

1. Clone the repository

git clone YOUR_GITHUB_REPOSITORY_URL

2. Navigate to the project folder

cd event-booking-app

3. Install dependencies

npm install

4. Configure Firebase

Create or select a Firebase project.

Register a Firebase Web App.

Enable Email/Password Authentication.

Create a Cloud Firestore database.

Configure the required Firestore security rules.

Add your Firebase Web App configuration to src/firebase.js.

Do not upload Firebase service-account credentials or private keys to GitHub.

5. Start the development server

npm run dev

Open the local URL displayed in your terminal, usually:

http://localhost:5173

6. Build the application

npm run build

User Roles

Participant: Can explore programs, book sessions, view bookings, update profile information, and access notifications.

Administrator: Can manage programs, trainers, and participant bookings through the admin dashboard.

Administrator access requires the appropriate role to be configured in the Firestore user profile.

Notifications

Eventora provides in-app notifications for booking confirmations and cancellations. The notification records include simulated email details, but actual emails are not sent to external inboxes in the current implementation.

Security

Firebase Authentication is used to authenticate users.

Firestore Security Rules restrict access to user profiles and bookings.

Participants can access their own profile and booking information.

Administrative operations require administrator permissions.

Future Enhancements

Profile picture upload and management.

Actual email notifications.

Online payment integration.

Event feedback and ratings.

Improved reporting and analytics.

Deployment to a public hosting platform.

Project Information

Project Name: Eventora

Project Type: Online Event, Workshop & Training Booking Application

Frontend: React.js

Backend Services: Firebase

Developer: Anjali Jodatti

GitHub: https://github.com/Anjali-Jodatti

Eventora – Discover, Book, and Experience Learning Events.