import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting: 10 prompt generations per user per hour (more expensive operation)
const promptGenRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many prompt generation requests, please try again later', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/prompts/generate - Generate an optimized prompt based on keywords and context
router.post('/generate', authenticate, promptGenRateLimit, async (req, res) => {
  try {
    const {
      keywords,
      lvlCode,
      lvlName,
      targetAudience,
      outputFormat,
      language,
      place,
      geoContext,
      projectName,
    } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        error: 'Keywords array is required and must not be empty',
      });
    }

    // Build context description for the AI
    let contextDescription = `Generate an optimized prompt for text simplification in Dutch (${language || 'Nederlands'}).\n\n`;
    
    contextDescription += `Context:\n`;
    if (lvlName && lvlCode) {
      contextDescription += `- Communication Level: ${lvlName} (${lvlCode})\n`;
    }
    if (targetAudience) {
      contextDescription += `- Target Audience: ${targetAudience}\n`;
    }
    if (outputFormat) {
      contextDescription += `- Output Format: ${outputFormat}\n`;
    }
    if (place) {
      contextDescription += `- Specific Place: ${place}\n`;
    }
    if (geoContext) {
      contextDescription += `- Geographic Context: ${geoContext}\n`;
    }
    if (projectName) {
      contextDescription += `- Project: ${projectName}\n`;
    }
    
    contextDescription += `\nKeywords to focus on: ${keywords.join(', ')}\n\n`;
    
    contextDescription += `Generate a comprehensive, optimized prompt that:\n`;
    contextDescription += `1. Incorporates the provided keywords naturally\n`;
    contextDescription += `2. Matches the communication level style (${lvlCode || 'general'})\n`;
    contextDescription += `3. Is tailored for the target audience (${targetAudience || 'general'})\n`;
    contextDescription += `4. Produces output in the specified format (${outputFormat || 'summary'})\n`;
    if (place || geoContext) {
      contextDescription += `5. Uses appropriate local terminology and context for ${place || geoContext}\n`;
    }
    contextDescription += `6. Maintains the Vooruit party values: Solidarity & social justice, Equal opportunity, Protecting purchasing power and fair taxation, Social-democratic economy\n`;
    contextDescription += `7. Is clear, empathetic, non-condescending, and approachable\n`;
    contextDescription += `8. Is structured for Belgian audiences\n\n`;
    contextDescription += `The prompt should be ready to use for text simplification and should include all necessary instructions for the AI model.`;

    // Generate the prompt using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in creating optimized prompts for AI text simplification. You understand Dutch language, Belgian governance structures, and effective communication strategies for public institutions.',
        },
        {
          role: 'user',
          content: contextDescription,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const generatedPrompt = completion.choices[0]?.message?.content;

    if (!generatedPrompt) {
      return res.status(500).json({
        error: 'Failed to generate prompt',
        code: 'GENERATION_ERROR',
      });
    }

    // Optional: Generate explanation
    const explanationCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in AI prompt engineering. Explain why a prompt was structured in a certain way.',
        },
        {
          role: 'user',
          content: `Explain why this prompt was generated for the given context:\n\nContext: ${contextDescription}\n\nGenerated Prompt:\n${generatedPrompt}\n\nProvide a brief explanation (2-3 sentences) of the key design decisions.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const explanation = explanationCompletion.choices[0]?.message?.content || '';

    res.json({
      prompt: generatedPrompt,
      explanation: explanation,
      context: {
        keywords,
        lvlCode,
        lvlName,
        targetAudience,
        outputFormat,
        language,
        place,
        geoContext,
        projectName,
      },
      meta: {
        model: 'gpt-4',
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    });
  } catch (error) {
    console.error('Error generating prompt:', error);
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'OpenAI API rate limit exceeded. Please try again later.',
        code: 'OPENAI_RATE_LIMIT',
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate prompt',
      code: 'GENERATION_ERROR',
      details: error.message,
    });
  }
});

export default router;

