import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import DictionaryEntry from './models/DictionaryEntry.js'; // Import the new model
import SavedResult from './models/SavedResult.js'; // Import the new model

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
    // Append database name to connection string
    mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${config.mongo.hostString}/${MONGODB_DATABASE}`;
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
  bufferCommands: true,
  bufferMaxEntries: 0, // Disable mongoose buffering
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

// Dictionary CRUD routes
app.post('/api/dictionary', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database connection not available. Please try again.' });
    }

    const newEntry = new DictionaryEntry(req.body);
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('Error creating dictionary entry:', error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/dictionary', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database connection not available. Please try again.' });
    }

    const entries = await DictionaryEntry.find();
    res.json(entries);
  } catch (error) {
    console.error('Error fetching dictionary:', error);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/dictionary/:id', async (req, res) => {
  try {
    const updatedEntry = await DictionaryEntry.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/dictionary/:id', async (req, res) => {
  try {
    await DictionaryEntry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/simplify', async (req, res) => {
  const { text, language = 'Dutch', targetAudience = 'Algemeen', outputFormat = 'Samenvatting' } = req.body; // Default to Dutch, Algemeen, and Samenvatting

  if (!text) {
    return res.status(400).json({ error: 'Text is required for simplification.' });
  }

  let audienceInstruction = '';
  switch (targetAudience) {
    case 'Algemeen':
      audienceInstruction = 'for a broad audience, like "your uncle at the family party."';
      break;
    case 'Jongeren':
      audienceInstruction = 'for a 20-year-old audience, using modern, engaging, and slightly informal language, including relevant slang or expressions where appropriate, but maintaining clarity.';
      break;
    case 'Ouderen':
      audienceInstruction = 'for an elderly audience, using formal, respectful, and very clear language, avoiding jargon and complex sentence structures.';
      break;
  }

  let formatInstruction = '';
  let imageSuggestion = '';
  let listAvoidance = 'ABSOLUTELY DO NOT use numbered lists or bullet points.';

  if (outputFormat === 'Opsommingstekens') {
    listAvoidance = ''; // Allow bullet points if requested
  }

  // Fetch dictionary entries
  let dictionaryTerms = '';
  try {
    const entries = await DictionaryEntry.find();
    if (entries.length > 0) {
      dictionaryTerms = '\n\nUse the following dictionary for simplification:';
      entries.forEach(entry => {
        dictionaryTerms += `\n- ${entry.originalTerm}: ${entry.simplifiedTerm}`;
      });
    }
  } catch (error) {
    console.error('Error fetching dictionary entries:', error);
    // Continue without dictionary if there's an error
  }

  switch (outputFormat) {
    case 'Samenvatting':
      formatInstruction = 'Provide a concise summary.';
      break;
    case 'Korte versie (Instagram-achtig)':
      formatInstruction = 'Provide a very short, engaging, and attention-grabbing text suitable for Instagram. Use relevant hashtags and emojis.';
      imageSuggestion = '\nSuggest a compelling image description for this Instagram post. Make it relevant to the content and emotionally engaging. The main audience is Belgian.';
      break;
    case 'Medium versie (LinkedIn-achtig)':
      formatInstruction = 'Provide a professional, informative, and engaging medium-length text suitable for LinkedIn, focusing on key takeaways and a clear call to action if applicable.';
      break;
    case 'Opsommingstekens':
      formatInstruction = 'Provide the output in bullet points.';
      break;
  }

  try {
    const prompt = `You are a helpful seasoned professional in marketing with years of experience that simplifies complex ${language} political texts ${audienceInstruction} into clear, active, empathetic, and non-condescending language. You pay a lot of attention to Solidarity & social justice, Equal opportunity:, Protecting purchasing power and fair taxation, Social-democratic economy. You are newer condescending, very approachable and direct. Your tone is tailored on the Belgian audience.\n    Your output should consist of short sentences and short words, with no more than 3 syllables per word, unless absolutely necessary for clarity or specific audience tone. ABSOLUTELY AVOID technical terms; if a technical term is unavoidable, rephrase it in simple language.\n    ${listAvoidance}\n\n    Structure your response as follows, clearly separating each part with a "---" separator, and use paragraphs and line breaks for readability:\n    ---\n    Emotional Core Message: Start with a strong, emotional core message about people.\n    ---\n    Problem Statement: Name the problem briefly and clearly.\n    ---\n    Concluding Message: Conclude with a clear, impactful message.\n    ---\n    ${formatInstruction}\n    ${dictionaryTerms}\n\n    Please simplify the following ${language} text and respond in ${language}. Ensure the tone is strongly connotated and impactful. ${imageSuggestion}\n\n    "${text}"`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const simplifiedText = completion.choices[0].message.content;
    res.json({ simplifiedText });

  } catch (error) {
    console.error('Error simplifying text:', error);
    res.status(500).json({ error: 'Failed to simplify text.' });
  }
});

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