import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import DictionaryEntry from './models/DictionaryEntry.js';
import SavedResult from './models/SavedResult.js';
import User from './models/User.js';
import { signToken } from './utils/jwt.js';
import { comparePassword, validatePassword } from './utils/password.js';
import { authenticate } from './middleware/auth.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000; // Use 3000 for backend

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.ALLOW_ORIGINS || 'http://localhost:5173', // Frontend runs on 5173 by default with Vite
  credentials: true
}));

// MongoDB Connection
const MONGODB_DATABASE = 'fcc88fe703403b6bc797e032f52200a2'; // v2.0 database name
let mongoUri;
if (process.env.APP_CONFIG) {
  const config = JSON.parse(process.env.APP_CONFIG);
  const mongoPassword = process.env.MONGO_PASSWORD; // You need to set this in EvenNode environment variables
  if (config.mongo && mongoPassword) {
    const hostString = config.mongo.hostString;
    // EvenNode's hostString format: "host1:port,host2:port/database?queryParams"
    // We need to replace the database name if it exists, or add it if it doesn't
    
    // Check if hostString contains a database path (has /)
    if (hostString.includes('/')) {
      // Split on / to separate host from path
      const slashIndex = hostString.indexOf('/');
      const hostPart = hostString.substring(0, slashIndex);
      const pathPart = hostString.substring(slashIndex + 1);
      
      // Check if pathPart has query params
      if (pathPart.includes('?')) {
        // Has query params, replace database name before ?
        const questionIndex = pathPart.indexOf('?');
        const queryPart = pathPart.substring(questionIndex);
        mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}${queryPart}`;
      } else {
        // No query params, just replace database name
        mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}`;
      }
    } else if (hostString.includes('?')) {
      // hostString has query params but no database path, add database before ?
      const questionIndex = hostString.indexOf('?');
      const hostPart = hostString.substring(0, questionIndex);
      const queryPart = hostString.substring(questionIndex);
      mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}${queryPart}`;
    } else {
      // Simple case: just append database name
      mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostString}/${MONGODB_DATABASE}`;
    }
  } else {
    console.error('EvenNode APP_CONFIG or MONGO_PASSWORD not properly configured. Falling back to localhost.');
    mongoUri = `mongodb://localhost:27017/${MONGODB_DATABASE}`; // Fallback for local development
  }
} else {
  mongoUri = process.env.MONGODB_URI || `mongodb://localhost:27017/${MONGODB_DATABASE}`; // Fallback for local development or other deployments
}

console.log('Attempting to connect to MongoDB with URI:', mongoUri);
console.log('MongoDB URI:', mongoUri);

// MongoDB connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 30000, // 30 seconds
};

mongoose.connect(mongoUri, mongooseOptions)
  .then(() => {
    console.log('MongoDB connected successfully.');
    console.log('Database:', MONGODB_DATABASE);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', err);
  });

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

import path from 'path';
import { fileURLToPath } from 'url';
import history from 'connect-history-api-fallback';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).populate('teams');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      teams: user.teams.map(team => team._id.toString()),
    });

    // Return user data and token
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        teams: user.teams.map(team => ({
          id: team._id.toString(),
          name: team.name,
        })),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', code: 'LOGIN_ERROR' });
  }
});

// Protected test route
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
  });
});

// Import and register route modules
import lvlsRouter from './routes/lvls.js';
import teamsRouter from './routes/teams.js';
import projectsRouter from './routes/projects.js';
import referencesRouter from './routes/references.js';
import usersRouter from './routes/users.js';
import configRouter from './routes/config.js';
import dictionaryRouter from './routes/dictionary.js';

app.use('/api/lvls', lvlsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', referencesRouter); // References use /api/projects/:id/references and /api/references/:id
app.use('/api/users', usersRouter);
app.use('/api', configRouter); // Config routes use /api/target-audiences, /api/output-formats, /api/languages
app.use('/api', dictionaryRouter); // Dictionary routes use /api/projects/:id/dictionary and /api/dictionary/:id
import requestLogsRouter from './routes/requestLogs.js';
import simplifyRouter from './routes/simplify.js';

app.use('/api/request-logs', requestLogsRouter);
app.use('/api/simplify', simplifyRouter);

// Old routes removed - now handled by route modules above

// Saved Results CRUD routes
app.post('/api/saved-results', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database connection not available. Please try again.' });
    }

    const { originalText, simplifiedText, targetAudience, outputFormat } = req.body;
    const newSavedResult = new SavedResult({ originalText, simplifiedText, targetAudience, outputFormat });
    await newSavedResult.save();
    res.status(201).json(newSavedResult);
  } catch (error) {
    console.error('Error saving result:', error);
    res.status(400).json({ message: error.message || 'Failed to save result' });
  }
});

app.get('/api/saved-results', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database connection not available. Please try again.' });
    }

    const { search, targetAudience, outputFormat } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { originalText: { $regex: search, $options: 'i' } },
        { simplifiedText: { $regex: search, $options: 'i' } },
      ];
    }
    if (targetAudience) {
      query.targetAudience = targetAudience;
    }
    if (outputFormat) {
      query.outputFormat = outputFormat;
    }
    const savedResults = await SavedResult.find(query).sort({ createdAt: -1 });
    res.json(savedResults);
  } catch (error) {
    console.error('Error fetching saved results:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/saved-results/:id', async (req, res) => {
  try {
    await SavedResult.findByIdAndDelete(req.params.id);
    res.json({ message: 'Saved result deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve frontend (static)
const frontendPath = path.join(__dirname, '../dist'); // dist is in the project root
app.use(history({ index: '/index.html' }));
app.use(express.static(frontendPath));

// Start server after MongoDB connection is established
mongoose.connection.once('open', () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on http://0.0.0.0:${PORT}`);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    console.log('MongoDB database:', mongoose.connection.db?.databaseName || MONGODB_DATABASE);
  });
});

// Fallback: Start server after 5 seconds even if MongoDB isn't connected yet
// This allows the app to start and show connection errors in API responses
setTimeout(() => {
  if (!mongoose.connection.readyState) {
    console.warn('Starting server despite MongoDB connection not being ready');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend running on http://0.0.0.0:${PORT}`);
      console.warn('WARNING: MongoDB connection not established');
    });
  }
}, 5000);