import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import LVL from '../models/LVL.js';
import Reference from '../models/Reference.js';
import DictionaryEntry from '../models/DictionaryEntry.js';
import TargetAudience from '../models/TargetAudience.js';
import OutputFormat from '../models/OutputFormat.js';
import Language from '../models/Language.js';
import RequestLog from '../models/RequestLog.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting: 20 requests per user per hour
const simplifyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// LVL style context mapping
const lvlStyleMap = {
  LOCAL: 'Use informal, direct, community-focused language. Keep it simple and relatable to local residents.',
  PROVINCIAL: 'Use balanced formality with regional context. Structure clearly for provincial audiences.',
  REGIONAL: 'Use formal but accessible language, policy-focused. Structure for regional governance context.',
  COMMUNITY: 'Use language-community specific terminology and cultural context. Maintain formal but approachable tone.',
  FEDERAL: 'Use highly formal, policy-precise, institutional tone. Maintain clarity while respecting federal governance standards.',
};

// Build enriched prompt
function buildPrompt({
  text,
  lvl,
  targetAudience,
  outputFormat,
  language,
  geoContext,
  includeKeywords,
  avoidKeywords,
  referenceSummaries,
  dictionaryTerms,
  projectName,
}) {
  let prompt = `You are a helpful seasoned professional in marketing with years of experience that simplifies complex ${language.name} political texts into clear, active, empathetic, and non-condescending language. You pay a lot of attention to Solidarity & social justice, Equal opportunity, Protecting purchasing power and fair taxation, Social-democratic economy. You are never condescending, very approachable and direct. Your tone is tailored on the Belgian audience.\n\n`;

  // Add LVL context
  if (lvl && lvlStyleMap[lvl.code]) {
    prompt += `Communication Level Context: ${lvlStyleMap[lvl.code]}\n\n`;
  }

  // Add target audience instruction
  if (targetAudience) {
    let audienceInstruction = '';
    switch (targetAudience.name) {
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
    if (audienceInstruction) {
      prompt += `Target Audience: ${audienceInstruction}\n\n`;
    }
  }

  // Add output format instruction
  if (outputFormat) {
    let formatInstruction = '';
    let imageSuggestion = '';
    let listAvoidance = 'ABSOLUTELY DO NOT use numbered lists or bullet points.';

    switch (outputFormat.name) {
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
        listAvoidance = '';
        break;
    }

    prompt += `Output Format: ${formatInstruction}\n`;
    if (listAvoidance) prompt += `${listAvoidance}\n`;
    if (imageSuggestion) prompt += imageSuggestion;
    prompt += '\n';
  }

  // Add geographic context
  if (geoContext) {
    prompt += `Geographic Context: This text is for ${geoContext}. Use local terminology and context where appropriate.\n\n`;
  }

  // Add project name for consistency
  if (projectName) {
    prompt += `Project Context: This simplification is part of the "${projectName}" project. Maintain consistency with this project's communication style.\n\n`;
  }

  // Add keywords
  if (includeKeywords && includeKeywords.length > 0) {
    prompt += `IMPORTANT: You MUST include or reference these keywords: ${includeKeywords.join(', ')}\n\n`;
  }

  if (avoidKeywords && avoidKeywords.length > 0) {
    prompt += `IMPORTANT: You MUST avoid using these keywords or terms: ${avoidKeywords.join(', ')}\n\n`;
  }

  // Add reference summaries
  if (referenceSummaries && referenceSummaries.length > 0) {
    prompt += 'Contextual References:\n';
    referenceSummaries.forEach((ref, index) => {
      prompt += `${index + 1}. ${ref.title}: ${ref.summary}\n`;
    });
    prompt += '\n';
  }

  // Add dictionary
  if (dictionaryTerms && dictionaryTerms.length > 0) {
    prompt += 'Use the following dictionary for simplification:\n';
    dictionaryTerms.forEach(entry => {
      prompt += `- ${entry.originalTerm}: ${entry.simplifiedTerm}\n`;
    });
    prompt += '\n';
  }

  // Add base instructions
  prompt += `Your output should consist of short sentences and short words, with no more than 3 syllables per word, unless absolutely necessary for clarity or specific audience tone. ABSOLUTELY AVOID technical terms; if a technical term is unavoidable, rephrase it in simple language.\n\n`;

  // Add structure
  prompt += `Structure your response as follows, clearly separating each part with a "---" separator, and use paragraphs and line breaks for readability:\n---\nEmotional Core Message: Start with a strong, emotional core message about people.\n---\nProblem Statement: Name the problem briefly and clearly.\n---\nConcluding Message: Conclude with a clear, impactful message.\n---\n${outputFormat?.name === 'Samenvatting' ? 'Summary' : 'Simplified Text'}: Provide the main simplified content.\n\n`;

  // Add the text to simplify
  prompt += `Please simplify the following ${language.name} text and respond in ${language.name}. Ensure the tone is strongly connotated and impactful.\n\n"${text}"`;

  return prompt;
}

// Estimate token count (rough estimate: 1 token ≈ 4 characters)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Truncate prompt if too long (keep base prompt, truncate context)
function truncatePrompt(prompt, maxTokens = 8000) {
  const estimated = estimateTokens(prompt);
  if (estimated <= maxTokens) {
    return prompt;
  }

  // If too long, we'd need to truncate reference summaries
  // For MVP, we'll just warn and proceed (OpenAI will handle truncation)
  console.warn(`Prompt estimated at ${estimated} tokens, may exceed limits`);
  return prompt;
}

// POST /api/simplify - Upgraded simplification endpoint
router.post('/', authenticate, simplifyRateLimit, async (req, res) => {
  try {
    const {
      text,
      teamId,
      projectId,
      lvlId,
      targetAudienceId,
      outputFormatId,
      languageId,
      geoContext,
      includeKeywords,
      avoidKeywords,
      referenceIds,
    } = req.body;

    // Validate required fields
    if (!text || !teamId || !projectId || !lvlId) {
      return res.status(400).json({
        error: 'Text, teamId, projectId, and lvlId are required',
      });
    }

    // Check if user is member of the team
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      if (!req.user.teams.includes(teamId)) {
        return res.status(403).json({ error: 'Not a member of this team' });
      }
    }

    // Load project and validate
    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.team._id.toString() !== teamId) {
      return res.status(400).json({ error: 'Project does not belong to specified team' });
    }

    // Validate LVL is in project's LVLs
    if (!project.lvls.some(lvl => lvl.toString() === lvlId)) {
      return res.status(400).json({ error: 'LVL is not valid for this project' });
    }

    // Load all context data
    const [lvl, targetAudience, outputFormat, language, references, dictionaryEntries] = await Promise.all([
      LVL.findById(lvlId),
      targetAudienceId ? TargetAudience.findById(targetAudienceId) : null,
      outputFormatId ? OutputFormat.findById(outputFormatId) : null,
      languageId ? Language.findById(languageId) : Language.findOne({ code: 'DUTCH' }),
      referenceIds && referenceIds.length > 0
        ? Reference.find({ _id: { $in: referenceIds }, project: projectId })
        : [],
      DictionaryEntry.find({ project: projectId }),
    ]);

    if (!lvl) {
      return res.status(404).json({ error: 'LVL not found' });
    }

    if (!language) {
      return res.status(404).json({ error: 'Language not found' });
    }

    // Build enriched prompt
    const referenceSummaries = references
      .filter(ref => ref.summary)
      .map(ref => ({ title: ref.title, summary: ref.summary }))
      .slice(0, 5); // Limit to 5 references to avoid token overflow

    const dictionaryTerms = dictionaryEntries.map(entry => ({
      originalTerm: entry.originalTerm,
      simplifiedTerm: entry.simplifiedTerm,
    }));

    let prompt = buildPrompt({
      text,
      lvl,
      targetAudience,
      outputFormat,
      language,
      geoContext,
      includeKeywords: includeKeywords || [],
      avoidKeywords: avoidKeywords || [],
      referenceSummaries,
      dictionaryTerms,
      projectName: project.name,
    });

    // Truncate if needed
    prompt = truncatePrompt(prompt);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const simplifiedText = completion.choices[0].message.content;

    // Extract token usage
    const usage = completion.usage || {};

    // Create request log
    const requestLog = await RequestLog.create({
      user: req.user.id,
      team: teamId,
      project: projectId,
      lvl: lvlId,
      originalText: text,
      simplifiedText,
      targetAudience: targetAudienceId || null,
      outputFormat: outputFormatId || null,
      language: language._id,
      geoContext: geoContext || '',
      includeKeywords: includeKeywords || [],
      avoidKeywords: avoidKeywords || [],
      referenceIds: referenceIds || [],
      modelMeta: {
        model: process.env.OPENAI_MODEL || 'gpt-4',
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    });

    // Return result
    res.json({
      simplifiedText,
      requestId: requestLog._id.toString(),
      meta: {
        teamId,
        projectId,
        projectName: project.name,
        lvlCode: lvl.code,
        lvlName: lvl.name,
        targetAudience: targetAudience?.name,
        outputFormat: outputFormat?.name,
        language: language.name,
        tokensUsed: usage.total_tokens,
      },
    });
  } catch (error) {
    console.error('Error simplifying text:', error);
    
    // Try fallback to base prompt if enriched prompt fails
    if (error.message?.includes('token') || error.status === 400) {
      // Fallback logic could go here
      return res.status(500).json({
        error: 'Failed to simplify text. Prompt may be too long.',
        code: 'PROMPT_ERROR',
      });
    }

    res.status(500).json({
      error: 'Failed to simplify text',
      code: 'SIMPLIFY_ERROR',
    });
  }
});

export default router;

