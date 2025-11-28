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
      console.log('Login failed: User not found for email:', email.toLowerCase());
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      console.log('Login failed: Invalid password for user:', user.email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.log('Login successful for user:', user.email);

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
import analyticsRouter from './routes/analytics.js';

app.use('/api/request-logs', requestLogsRouter);
app.use('/api/simplify', simplifyRouter);
app.use('/api/analytics', analyticsRouter);
import promptsRouter from './routes/prompts.js';
import promptTemplatesRouter from './routes/promptTemplates.js';
import systemPromptTemplatesRouter from './routes/systemPromptTemplates.js';
import migrationsRouter from './routes/migrations.js';

app.use('/api/prompts', promptsRouter);
app.use('/api/prompt-templates', promptTemplatesRouter);
app.use('/api/system-prompt-templates', systemPromptTemplatesRouter);
app.use('/api/migrations', migrationsRouter);
import abTestsRouter from './routes/abTests.js';

app.use('/api/ab-tests', abTestsRouter);

// Temporary seed endpoint (REMOVE AFTER FIRST USE!)
// This allows seeding the database via API call after deployment
// Supports both GET and POST for easier access
app.get('/api/admin/seed', async (req, res) => {
  await handleSeed(req, res);
});

app.post('/api/admin/seed', async (req, res) => {
  await handleSeed(req, res);
});

// Migration endpoint for LVL places
// This allows migrating existing LVLs to include places data
app.get('/api/admin/migrate-lvl-places', async (req, res) => {
  await handleLvlPlacesMigration(req, res);
});

app.post('/api/admin/migrate-lvl-places', async (req, res) => {
  await handleLvlPlacesMigration(req, res);
});

async function handleSeed(req, res) {
  try {
    // Import seed function directly
    const seedFunction = await import('./scripts/seed.js');
    // The seed script runs on import, so we just need to wait a bit
    // Actually, let's import the models and run seed logic directly
    const LVL = (await import('./models/LVL.js')).default;
    const User = (await import('./models/User.js')).default;
    const TargetAudience = (await import('./models/TargetAudience.js')).default;
    const OutputFormat = (await import('./models/OutputFormat.js')).default;
    const Language = (await import('./models/Language.js')).default;
    const bcrypt = (await import('bcrypt')).default;

    const results = [];

    // Seed LVLs
    const lvls = [
      { 
        name: 'Local', 
        code: 'LOCAL', 
        description: 'Gemeentelijk niveau',
        places: [
          'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Mechelen', 'Aalst', 'Kortrijk', 'Hasselt',
          'Sint-Niklaas', 'Oostende', 'Genk', 'Roeselare', 'Geel', 'Lier', 'Turnhout',
          'Dendermonde', 'Lokeren', 'Beveren', 'Vilvoorde', 'Mouscron', 'Waregem',
          'Charleroi', 'Liège', 'Namur', 'Mons', 'La Louvière', 'Tournai', 'Seraing',
          'Verviers', 'Arlon', 'Bastogne', 'Dinant', 'Huy', 'Wavre',
          'Brussel', 'Schaarbeek', 'Anderlecht', 'Molenbeek', 'Elsene', 'Etterbeek'
        ]
      },
      { 
        name: 'Provincial', 
        code: 'PROVINCIAL', 
        description: 'Provinciaal niveau',
        places: [
          'Antwerpen', 'Oost-Vlaanderen', 'West-Vlaanderen', 'Vlaams-Brabant', 'Limburg',
          'Henegouwen', 'Waals-Brabant', 'Luik', 'Luxemburg', 'Namen'
        ]
      },
      { 
        name: 'Regional', 
        code: 'REGIONAL', 
        description: 'Gewestelijk niveau (Vlaams Gewest, Brussels Gewest, Waals Gewest)',
        places: [
          'Vlaams Gewest', 'Brussels Gewest', 'Waals Gewest'
        ]
      },
      { 
        name: 'Community', 
        code: 'COMMUNITY', 
        description: 'Gemeenschapsniveau (Vlaamse Gemeenschap, Franse Gemeenschap, Duitstalige Gemeenschap)',
        places: [
          'Vlaamse Gemeenschap', 'Franse Gemeenschap', 'Duitstalige Gemeenschap'
        ]
      },
      { 
        name: 'Federal', 
        code: 'FEDERAL', 
        description: 'Federaal niveau',
        places: [
          'België', 'Belgium'
        ]
      },
    ];

    for (const lvlData of lvls) {
      const existing = await LVL.findOne({ code: lvlData.code });
      if (!existing) {
        await LVL.create(lvlData);
        results.push(`Created LVL: ${lvlData.name}`);
      } else {
        // Update existing LVL with places if it doesn't have them
        if (!existing.places || existing.places.length === 0) {
          existing.places = lvlData.places || [];
          await existing.save();
          results.push(`Updated LVL ${lvlData.name} with places`);
        } else {
          results.push(`LVL already exists: ${lvlData.name}`);
        }
      }
    }

    // Seed Target Audiences
    const targetAudiences = [
      { name: 'Algemeen', description: 'For a broad audience, like "your uncle at the family party."' },
      { name: 'Jongeren', description: 'For a 20-year-old audience, using modern, engaging, and slightly informal language' },
      { name: 'Ouderen', description: 'For an elderly audience, using formal, respectful, and very clear language' },
    ];

    for (const taData of targetAudiences) {
      const existing = await TargetAudience.findOne({ name: taData.name });
      if (!existing) {
        await TargetAudience.create(taData);
        results.push(`Created Target Audience: ${taData.name}`);
      } else {
        results.push(`Target Audience already exists: ${taData.name}`);
      }
    }

    // Seed Output Formats
    const outputFormats = [
      { name: 'Samenvatting', description: 'Provide a concise summary' },
      { name: 'Korte versie (Instagram-achtig)', description: 'Very short, engaging, and attention-grabbing text suitable for Instagram' },
      { name: 'Medium versie (LinkedIn-achtig)', description: 'Professional, informative, and engaging medium-length text suitable for LinkedIn' },
      { name: 'Opsommingstekens', description: 'Output in bullet points' },
    ];

    for (const ofData of outputFormats) {
      const existing = await OutputFormat.findOne({ name: ofData.name });
      if (!existing) {
        await OutputFormat.create(ofData);
        results.push(`Created Output Format: ${ofData.name}`);
      } else {
        results.push(`Output Format already exists: ${ofData.name}`);
      }
    }

    // Seed Languages
    const languages = [
      { name: 'Dutch', code: 'DUTCH', description: 'Nederlands' },
      { name: 'English', code: 'ENGLISH', description: 'Engels' },
      { name: 'French', code: 'FRENCH', description: 'Frans' },
    ];

    for (const langData of languages) {
      const existing = await Language.findOne({ code: langData.code });
      if (!existing) {
        await Language.create(langData);
        results.push(`Created Language: ${langData.name}`);
      } else {
        results.push(`Language already exists: ${langData.name}`);
      }
    }

    // Create SUPER_ADMIN
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mensentaalmachine.be';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        name: 'Super Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        teams: [],
      });
      results.push(`Created SUPER_ADMIN: ${adminEmail} (password: ${adminPassword})`);
    } else {
      results.push(`SUPER_ADMIN already exists: ${adminEmail}`);
    }

    res.json({ 
      success: true, 
      message: 'Database seeded successfully',
      results,
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to seed database',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

async function handleLvlPlacesMigration(req, res) {
  try {
    const LVL = (await import('./models/LVL.js')).default;
    const results = [];

    // Belgian places data
    const placesData = {
      LOCAL: [
        'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Mechelen', 'Aalst', 'Kortrijk', 'Hasselt',
        'Sint-Niklaas', 'Oostende', 'Genk', 'Roeselare', 'Geel', 'Lier', 'Turnhout',
        'Dendermonde', 'Lokeren', 'Beveren', 'Vilvoorde', 'Mouscron', 'Waregem',
        'Charleroi', 'Liège', 'Namur', 'Mons', 'La Louvière', 'Tournai', 'Seraing',
        'Verviers', 'Arlon', 'Bastogne', 'Dinant', 'Huy', 'Wavre',
        'Brussel', 'Schaarbeek', 'Anderlecht', 'Molenbeek', 'Elsene', 'Etterbeek',
        'Sint-Jans-Molenbeek', 'Sint-Gillis', 'Jette', 'Evere', 'Ganshoren', 'Koekelberg',
        'Sint-Agatha-Berchem', 'Sint-Joost-ten-Node', 'Oudergem', 'Sint-Pieters-Woluwe',
        'Ukkel', 'Vorst', 'Watermaal-Bosvoorde', 'Sint-Lambrechts-Woluwe'
      ],
      PROVINCIAL: [
        'Antwerpen', 'Oost-Vlaanderen', 'West-Vlaanderen', 'Vlaams-Brabant', 'Limburg',
        'Henegouwen', 'Waals-Brabant', 'Luik', 'Luxemburg', 'Namen'
      ],
      REGIONAL: [
        'Vlaams Gewest', 'Brussels Gewest', 'Waals Gewest'
      ],
      COMMUNITY: [
        'Vlaamse Gemeenschap', 'Franse Gemeenschap', 'Duitstalige Gemeenschap'
      ],
      FEDERAL: [
        'België', 'Belgium'
      ]
    };

    for (const [code, places] of Object.entries(placesData)) {
      const lvl = await LVL.findOne({ code });
      
      if (!lvl) {
        results.push(`⚠️  LVL not found: ${code} - skipping`);
        continue;
      }

      // Only update if places array is empty or doesn't exist
      if (!lvl.places || lvl.places.length === 0) {
        lvl.places = places;
        await lvl.save();
        results.push(`✓ Updated ${lvl.name} (${code}): Added ${places.length} places`);
      } else {
        results.push(`- ${lvl.name} (${code}) already has ${lvl.places.length} places - skipping`);
      }
    }

    res.json({ 
      success: true, 
      message: 'LVL places migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to migrate LVL places',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

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