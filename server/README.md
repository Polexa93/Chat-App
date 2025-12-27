# Chat App Backend Server

Node.js backend server with TypeScript, Express, SQLite, and JWT authentication.

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

**Important:** Change `JWT_SECRET` to a random secure string in production!

**Note:** No database setup needed! SQLite creates a local database file (`chat-app.db`) automatically.

### 3. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server will run on `http://localhost:5000`

## TypeScript

This project uses TypeScript for type safety. The source files are in `src/` and compile to `dist/`.

- **Development:** Uses `ts-node` for direct TypeScript execution
- **Production:** Compiles TypeScript to JavaScript in `dist/` folder

**Type checking:**
```bash
npm run type-check
```

## Database

- **SQLite** - File-based database (no installation needed)
- Database file: `chat-app.db` (created automatically in server directory)
- Tables are created automatically on first run

**View database:**
- Use [DB Browser for SQLite](https://sqlitebrowser.org/) (free GUI tool)
- Or use VS Code extensions like "SQLite Viewer"

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
  - Body: `{ name, email, password }`
  - Returns: `{ success, message, data: { token, user } }`

- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: `{ success, message, data: { token, user } }`

- `GET /api/auth/me` - Get current user (requires authentication)
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ success, data: { user } }`

### Health Check

- `GET /api/health` - Check if server is running

## Frontend Configuration

Make sure your React app has the API URL configured. Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── database.ts      # SQLite connection
│   ├── middleware/
│   │   └── auth.ts          # JWT authentication middleware
│   ├── models/
│   │   └── User.ts          # User model
│   ├── routes/
│   │   └── auth.ts          # Authentication routes
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   └── server.ts            # Main server file
├── dist/                    # Compiled JavaScript (generated)
├── .env                     # Environment variables (not in git)
├── .gitignore
├── package.json
├── tsconfig.json            # TypeScript configuration
├── nodemon.json             # Nodemon configuration
└── README.md
```
