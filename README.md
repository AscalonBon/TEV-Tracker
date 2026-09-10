# TEV Tracker

A MERN stack travel itinerary tracker for recording travel dates, destinations, transportation details, and total costs.

## Project structure

- `tevTracker/` — React + Vite frontend
- `backend/` — Express + MongoDB API

## Local setup

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

2. Update the MongoDB Atlas connection string in `backend/.env`:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/tevtracker?retryWrites=true&w=majority
   PORT=5000
   ```

3. Start the API:
   ```bash
   npm run dev
   ```

4. Install frontend dependencies:
   ```bash
   cd ../tevTracker
   npm install
   cp .env.example .env
   ```

5. Set the frontend API URL in `tevTracker/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

6. Start the frontend:
   ```bash
   npm run dev
   ```

## Vercel deployment

### Frontend (React)

1. Push the project to GitHub.
2. Import the `tevTracker` folder into Vercel as a frontend project.
3. Set the environment variable:
   ```env
   VITE_API_URL=https://your-backend-url/api
   ```
4. Build command:
   ```bash
   npm install
   npm run build
   ```
5. Output directory:
   ```bash
   dist
   ```

### Backend (Express + MongoDB)

You can deploy the `backend` folder as a Vercel Node serverless app or host it separately on Render, Railway, or a Vercel-managed backend.

For Vercel, add the environment variable:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/tevtracker?retryWrites=true&w=majority
```

Then point your frontend `VITE_API_URL` to that backend URL.

## Atlas connection notes

- Use your MongoDB Atlas connection string with the database user and password.
- Allow your current IP in Atlas Network Access.
- Keep the database name in the URI, for example `tevtracker`.

## Features

- Add itinerary records with:
  - date
  - destination
  - departure time
  - arrival time
  - means of transportation
  - transportation cost
  - cost total amount
- Save entries to MongoDB Atlas
- View saved records in a table
