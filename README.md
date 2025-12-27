# Chat App

A modern chat application built with React frontend and Node.js backend.

## Features

- 🔐 User authentication (Sign up / Sign in)
- 💬 Real-time chat (coming soon)
- 🎨 Modern, responsive UI
- 🔒 Secure password hashing with bcrypt
- 🎫 JWT token authentication
- 💾 MongoDB database

## Tech Stack

### Frontend
- React 19
- CSS3 with modern gradients and animations

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chat-app
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Set up MongoDB**
   - Install MongoDB locally, OR
   - Use MongoDB Atlas (free tier available)

5. **Configure backend environment**
   - Create `server/.env` file:
     ```env
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/chat-app
     JWT_SECRET=your-super-secret-jwt-key
     NODE_ENV=development
     ```

6. **Configure frontend environment**
   - Create `.env` file in root directory:
     ```env
     REACT_APP_API_URL=http://localhost:5000/api
     ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on `http://localhost:5000`

2. **Start the frontend (in a new terminal)**
   ```bash
   npm start
   ```
   App will open at `http://localhost:3000`

## Project Structure

```
chat-app/
├── public/              # Static files
├── src/                 # React frontend
│   ├── services/       # API services
│   ├── App.js          # Main app component
│   └── ...
├── server/             # Node.js backend
│   ├── config/        # Database configuration
│   ├── middleware/    # Auth middleware
│   ├── models/        # Mongoose models
│   ├── routes/        # API routes
│   └── server.js      # Server entry point
└── package.json
```

## API Endpoints

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

## Development

- Frontend runs on port 3000
- Backend runs on port 5000
- Make sure MongoDB is running before starting the backend

## License

MIT
