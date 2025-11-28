import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import axios from 'axios';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import LVL from '../models/LVL.js';
import Reference from '../models/Reference.js';
import DictionaryEntry from '../models/DictionaryEntry.js';
import TargetAudience from '../models/TargetAudience.js';
import OutputFormat from '../models/OutputFormat.js';
import Language from '../models/Language.js';
import RequestLog from '../models/RequestLog.js';
import ResearchCache from '../models/ResearchCache.js';
import ABTest from '../models/ABTest.js';
import { authenticate } from '../middleware/auth.js';
import { buildPromptFromTemplates } from '../utils/promptTemplateEngine.js';
import { sanitizeInputText, validateInputText } from '../utils/sanitizeInput.js';
import { assemblePromptTemplate } from '../utils/assemblePromptTemplate.js';
import PromptTemplate from '../models/PromptTemplate.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tavily API configuration
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

// Rate limiting: 20 requests per user per hour (regular)
const simplifyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for research mode: 5 requests per user per hour
const researchRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.MAX_RESEARCH_REQUESTS_PER_HOUR || '5'),
  message: { error: 'Too many research requests, please try again later', code: 'RESEARCH_RATE_LIMIT' },
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

// ============================================================================
// PROMPT SECTION BUILDERS (Modular Functions)
// ============================================================================

/**
 * Build role definition section
 * @param {Object} language - Language object with name property
 * @returns {string} Role definition prompt section
 */
function buildRoleSection(language) {
  return `You are a helpful seasoned professional in marketing with years of experience that simplifies complex ${language.name} political texts into clear, active, empathetic, and non-condescending language. You pay a lot of attention to Solidarity & social justice, Equal opportunity, Protecting purchasing power and fair taxation, Social-democratic economy. You are never condescending, very approachable and direct. Your tone is tailored on the Belgian audience.\n\n`;
}

/**
 * Build LVL context section
 * @param {Object} lvl - LVL object with code and places
 * @param {string} place - Selected place (optional)
 * @returns {string} LVL context prompt section
 */
function buildLvlContextSection(lvl, place) {
  if (!lvl || !lvlStyleMap[lvl.code]) {
    return '';
  }
  
  let section = `Communication Level Context: ${lvlStyleMap[lvl.code]}\n\n`;
  
  // Only add place context if a specific place is selected
  // Don't list all available places as it can confuse the AI
  if (place && lvl.places && lvl.places.includes(place)) {
    section += `IMPORTANT: This text is specifically for ${place}. Use local terminology, names of institutions, and context specific to ${place}. Reference local landmarks, districts, or relevant local information when appropriate.\n\n`;
  }
  
  return section;
}

/**
 * Build target audience instruction section
 * @param {Object} targetAudience - Target audience object with name property
 * @returns {string} Target audience prompt section
 */
function buildTargetAudienceSection(targetAudience) {
  if (!targetAudience) {
    return '';
  }
  
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
    return `Target Audience: ${audienceInstruction}\n\n`;
  }
  
  return '';
}

/**
 * Build output format instruction section
 * Uses database configuration fields when available, falls back to hardcoded values for backward compatibility
 * @param {Object} outputFormat - Output format object
 * @returns {Object} Object with { section: string, requiresImageSuggestion: boolean }
 */
function buildOutputFormatSection(outputFormat) {
  if (!outputFormat) {
    return { section: '', requiresImageSuggestion: false };
  }
  
  let formatInstruction = '';
  let requiresImageSuggestion = false;
  let listAvoidance = 'ABSOLUTELY DO NOT use numbered lists or bullet points.';

  // Use description from database if available, otherwise fall back to hardcoded values
  if (outputFormat.description && outputFormat.description.trim().length > 0) {
    formatInstruction = outputFormat.description;
  } else {
    // Fallback to hardcoded instructions for backward compatibility
    switch (outputFormat.name) {
      case 'Samenvatting':
        formatInstruction = 'Provide a concise summary.';
        break;
      case 'Korte versie (Instagram-achtig)':
        formatInstruction = 'Provide a very short, engaging, and attention-grabbing text suitable for Instagram. Use relevant hashtags and emojis.';
        requiresImageSuggestion = true;
        break;
      case 'Medium versie (LinkedIn-achtig)':
        formatInstruction = 'Provide a professional, informative, and engaging medium-length text suitable for LinkedIn, focusing on key takeaways and a clear call to action if applicable.';
        break;
      case 'Opsommingstekens':
        formatInstruction = 'Provide the output in bullet points.';
        listAvoidance = '';
        break;
    }
  }

  // Use requiresImageSuggestion from database if set, otherwise use hardcoded logic
  if (outputFormat.requiresImageSuggestion !== undefined) {
    requiresImageSuggestion = outputFormat.requiresImageSuggestion;
  } else {
    // Fallback: Handle format-specific behaviors based on format name
    if (outputFormat.name === 'Korte versie (Instagram-achtig)') {
      requiresImageSuggestion = true;
    }
  }

  // Apply behavioral rules from database if available
  if (outputFormat.behavioralRules && Array.isArray(outputFormat.behavioralRules) && outputFormat.behavioralRules.length > 0) {
    // Process behavioral rules
    outputFormat.behavioralRules.forEach(rule => {
      if (rule.rule === 'ALLOW_BULLET_POINTS' || rule.rule === 'ALLOW_LISTS') {
        listAvoidance = '';
      }
      // Add more rule processing as needed
    });
  } else {
    // Fallback: Handle format-specific behaviors based on format name
    if (outputFormat.name === 'Opsommingstekens') {
      listAvoidance = ''; // Allow bullet points for this format
    }
  }

  let section = `Output Format: ${formatInstruction}\n`;
  if (listAvoidance) {
    section += `${listAvoidance}\n`;
  }
  
  // Add explicit reminder about image suggestion if required
  if (requiresImageSuggestion) {
    section += `\nIMPORTANT: This format REQUIRES an "Image Suggestion" section. You MUST include this section in your response after the simplified text. This is mandatory, not optional.\n\n`;
  }
  
  section += '\n';
  
  return { section, requiresImageSuggestion };
}

/**
 * Build geographic context section
 * @param {string} geoContext - Geographic context string
 * @returns {string} Geographic context prompt section
 */
function buildGeographicContextSection(geoContext) {
  if (!geoContext) {
    return '';
  }
  return `Geographic Context: This text is for ${geoContext}. Use local terminology and context where appropriate.\n\n`;
}

/**
 * Build project context section
 * @param {string} projectName - Project name
 * @returns {string} Project context prompt section
 */
function buildProjectContextSection(projectName) {
  if (!projectName) {
    return '';
  }
  return `Project Context: This simplification is part of the "${projectName}" project. Maintain consistency with this project's communication style.\n\n`;
}

/**
 * Build keywords section (include and avoid)
 * @param {Array<string>} includeKeywords - Keywords to include
 * @param {Array<string>} avoidKeywords - Keywords to avoid
 * @returns {string} Keywords prompt section
 */
function buildKeywordsSection(includeKeywords, avoidKeywords) {
  let section = '';
  
  if (includeKeywords && includeKeywords.length > 0) {
    section += `IMPORTANT: You MUST include or reference these keywords: ${includeKeywords.join(', ')}\n\n`;
  }
  
  if (avoidKeywords && avoidKeywords.length > 0) {
    section += `IMPORTANT: You MUST avoid using these keywords or terms: ${avoidKeywords.join(', ')}\n\n`;
  }
  
  return section;
}

/**
 * Build references section
 * @param {Array<Object>} referenceSummaries - Array of reference objects with title and summary
 * @returns {string} References prompt section
 */
function buildReferencesSection(referenceSummaries) {
  if (!referenceSummaries || referenceSummaries.length === 0) {
    return '';
  }
  
  let section = 'Contextual References:\n';
  referenceSummaries.forEach((ref, index) => {
    section += `${index + 1}. ${ref.title}: ${ref.summary}\n`;
  });
  section += '\n';
  
  return section;
}

/**
 * Build dictionary section
 * @param {Array<Object>} dictionaryTerms - Array of dictionary entry objects
 * @returns {string} Dictionary prompt section
 */
function buildDictionarySection(dictionaryTerms) {
  if (!dictionaryTerms || dictionaryTerms.length === 0) {
    return '';
  }
  
  let section = 'Use the following dictionary for simplification:\n';
  dictionaryTerms.forEach(entry => {
    section += `- ${entry.originalTerm}: ${entry.simplifiedTerm}\n`;
  });
  section += '\n';
  
  return section;
}

/**
 * Build base instructions section
 * @returns {string} Base instructions prompt section
 */
function buildBaseInstructionsSection() {
  return `Your output should consist of short sentences and short words, with no more than 3 syllables per word, unless absolutely necessary for clarity or specific audience tone. ABSOLUTELY AVOID technical terms; if a technical term is unavoidable, rephrase it in simple language.\n\n`;
}

/**
 * Build output structure section
 * @param {Object} outputFormat - Output format object
 * @param {boolean} requiresImageSuggestion - Whether image suggestion is required
 * @returns {string} Output structure prompt section
 */
function buildOutputStructureSection(outputFormat, requiresImageSuggestion) {
  let structureParts = [
    'Emotional Core Message: Start with a strong, emotional core message about people.',
    'Problem Statement: Name the problem briefly and clearly.',
    'Concluding Message: Conclude with a clear, impactful message.',
    `${outputFormat?.name === 'Samenvatting' ? 'Summary' : 'Simplified Text'}: Provide the main simplified content.`
  ];
  
  // Add image suggestion section if required by output format
  if (requiresImageSuggestion) {
    structureParts.push('Image Suggestion: [MANDATORY - YOU MUST INCLUDE THIS SECTION] Provide a compelling, detailed image description for this Instagram post. The description should be emotionally engaging, relevant to the simplified content, and suitable for a Belgian audience. Describe the visual elements, mood, colors, composition, and any people or objects that should be included. This section is REQUIRED and must be included in your response. Format: ---\nImage Suggestion: [your detailed description here]');
  }
  
  let section = `Structure your response as follows, clearly separating each part with a "---" separator, and use paragraphs and line breaks for readability:\n`;
  structureParts.forEach(part => {
    section += `---\n${part}\n`;
  });
  section += '\n';
  
  // Add explicit reminder if image suggestion is required
  if (requiresImageSuggestion) {
    section += `CRITICAL REMINDER: You MUST include the "Image Suggestion" section in your response. This is a mandatory requirement. Do not skip this section.\n\n`;
  }
  
  return section;
}

/**
 * Build content section (text to simplify)
 * @param {string} text - Text to simplify
 * @param {Object} language - Language object with name property
 * @param {boolean} requiresImageSuggestion - Whether image suggestion is required
 * @returns {string} Content prompt section
 */
function buildContentSection(text, language, requiresImageSuggestion = false) {
  let section = `Please simplify the following ${language.name} text and respond in ${language.name}. Ensure the tone is strongly connotated and impactful.\n\n`;
  
  if (requiresImageSuggestion) {
    section += `REMINDER: Remember to include the "Image Suggestion" section in your response. This is a mandatory requirement.\n\n`;
  }
  
  section += `"${text}"`;
  
  return section;
}

// ============================================================================
// PROMPT OBSERVABILITY HELPERS
// ============================================================================

/**
 * Sanitize prompt for logging (remove sensitive data, truncate long text)
 * @param {string} prompt - Full prompt text
 * @param {number} maxLength - Maximum length for sanitized prompt (default: 2000)
 * @returns {string} Sanitized prompt
 */
function sanitizePromptForLogging(prompt, maxLength = 2000) {
  if (!prompt) return '';
  
  let sanitized = prompt;
  
  // Truncate if too long (keep beginning which has instructions)
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '\n\n[... truncated for logging ...]';
  }
  
  return sanitized;
}

/**
 * Track which sections were included in the prompt
 * @param {Object} params - Prompt building parameters
 * @returns {Array} Array of section tracking objects
 */
function trackPromptSections({
  lvl,
  place,
  targetAudience,
  outputFormat,
  geoContext,
  includeKeywords,
  avoidKeywords,
  referenceSummaries,
  dictionaryTerms,
  projectName,
}) {
  const sections = [];
  
  sections.push({ type: 'role', included: true }); // Always included
  sections.push({ type: 'lvlContext', included: !!(lvl && lvlStyleMap[lvl.code]) });
  sections.push({ type: 'place', included: !!(place && lvl?.places?.includes(place)) });
  sections.push({ type: 'targetAudience', included: !!targetAudience });
  sections.push({ type: 'outputFormat', included: !!outputFormat });
  sections.push({ type: 'geoContext', included: !!geoContext });
  sections.push({ type: 'projectContext', included: !!projectName });
  sections.push({ type: 'includeKeywords', included: !!(includeKeywords && includeKeywords.length > 0) });
  sections.push({ type: 'avoidKeywords', included: !!(avoidKeywords && avoidKeywords.length > 0) });
  sections.push({ type: 'references', included: !!(referenceSummaries && referenceSummaries.length > 0) });
  sections.push({ type: 'dictionary', included: !!(dictionaryTerms && dictionaryTerms.length > 0) });
  sections.push({ type: 'baseInstructions', included: true }); // Always included
  sections.push({ type: 'outputStructure', included: true }); // Always included
  sections.push({ type: 'content', included: true }); // Always included
  
  if (outputFormat) {
    const formatSection = buildOutputFormatSection(outputFormat);
    sections.push({ type: 'imageSuggestion', included: formatSection.requiresImageSuggestion });
  }
  
  return sections;
}

// ============================================================================
// CONTEXT PREPARATION FOR TEMPLATES
// ============================================================================

/**
 * Prepare context object for template engine
 * @param {Object} params - Prompt building parameters
 * @returns {Object} Context object for templates
 */
function prepareTemplateContext({
  text,
  lvl,
  place,
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
  // Build format section to get processed data
  const formatSection = buildOutputFormatSection(outputFormat);
  const requiresImageSuggestion = formatSection.requiresImageSuggestion;
  
  // Prepare LVL style
  let lvlStyle = '';
  if (lvl && lvlStyleMap[lvl.code]) {
    lvlStyle = lvlStyleMap[lvl.code];
  }
  
  // Prepare target audience instruction
  let targetAudienceInstruction = '';
  if (targetAudience) {
    switch (targetAudience.name) {
      case 'Algemeen':
        targetAudienceInstruction = 'for a broad audience, like "your uncle at the family party."';
        break;
      case 'Jongeren':
        targetAudienceInstruction = 'for a 20-year-old audience, using modern, engaging, and slightly informal language, including relevant slang or expressions where appropriate, but maintaining clarity.';
        break;
      case 'Ouderen':
        targetAudienceInstruction = 'for an elderly audience, using formal, respectful, and very clear language, avoiding jargon and complex sentence structures.';
        break;
    }
  }
  
  // Prepare format instruction
  let formatInstruction = '';
  let listAvoidance = 'ABSOLUTELY DO NOT use numbered lists or bullet points.';
  if (outputFormat) {
    if (outputFormat.description && outputFormat.description.trim().length > 0) {
      formatInstruction = outputFormat.description;
    } else {
      switch (outputFormat.name) {
        case 'Samenvatting':
          formatInstruction = 'Provide a concise summary.';
          break;
        case 'Korte versie (Instagram-achtig)':
          formatInstruction = 'Provide a very short, engaging, and attention-grabbing text suitable for Instagram. Use relevant hashtags and emojis.';
          break;
        case 'Medium versie (LinkedIn-achtig)':
          formatInstruction = 'Provide a professional, informative, and engaging medium-length text suitable for LinkedIn, focusing on key takeaways and a clear call to action if applicable.';
          break;
        case 'Opsommingstekens':
          formatInstruction = 'Provide the output in bullet points.';
          listAvoidance = '';
          break;
      }
    }
    
    // Handle behavioral rules
    if (outputFormat.behavioralRules && Array.isArray(outputFormat.behavioralRules) && outputFormat.behavioralRules.length > 0) {
      outputFormat.behavioralRules.forEach(rule => {
        if (rule.rule === 'ALLOW_BULLET_POINTS' || rule.rule === 'ALLOW_LISTS') {
          listAvoidance = '';
        }
      });
    } else if (outputFormat.name === 'Opsommingstekens') {
      listAvoidance = '';
    }
  }
  
  // Prepare image suggestion reminders
  let imageSuggestionReminder = '';
  let imageSuggestionFinalReminder = '';
  if (requiresImageSuggestion) {
    imageSuggestionReminder = '\nIMPORTANT: This format REQUIRES an "Image Suggestion" section. You MUST include this section in your response after the simplified text. This is mandatory, not optional.\n\n';
    imageSuggestionFinalReminder = 'REMINDER: Remember to include the "Image Suggestion" section in your response. This is a mandatory requirement.\n\n';
  }
  
  // Prepare reference list
  let referenceList = '';
  if (referenceSummaries && referenceSummaries.length > 0) {
    referenceSummaries.forEach((ref, index) => {
      referenceList += `${index + 1}. ${ref.title}: ${ref.summary}\n`;
    });
  }
  
  // Prepare dictionary list
  let dictionaryList = '';
  if (dictionaryTerms && dictionaryTerms.length > 0) {
    dictionaryTerms.forEach(entry => {
      dictionaryList += `- ${entry.originalTerm}: ${entry.simplifiedTerm}\n`;
    });
  }
  
  // Prepare structure parts
  let structureParts = [
    'Emotional Core Message: Start with a strong, emotional core message about people.',
    'Problem Statement: Name the problem briefly and clearly.',
    'Concluding Message: Conclude with a clear, impactful message.',
    `${outputFormat?.name === 'Samenvatting' ? 'Summary' : 'Simplified Text'}: Provide the main simplified content.`
  ].join('\n---\n');
  
  if (requiresImageSuggestion) {
    structureParts += '\n---\nImage Suggestion: [MANDATORY - YOU MUST INCLUDE THIS SECTION] Provide a compelling, detailed image description for this Instagram post. The description should be emotionally engaging, relevant to the simplified content, and suitable for a Belgian audience. Describe the visual elements, mood, colors, composition, and any people or objects that should be included. This section is REQUIRED and must be included in your response. Format: ---\nImage Suggestion: [your detailed description here]';
  }
  
  let imageSuggestionReminderForStructure = '';
  if (requiresImageSuggestion) {
    imageSuggestionReminderForStructure = `CRITICAL REMINDER: You MUST include the "Image Suggestion" section in your response. This is a mandatory requirement. Do not skip this section.\n\n`;
  }
  
  // Prepare keywords strings
  const includeKeywordsStr = includeKeywords && includeKeywords.length > 0 ? includeKeywords.join(', ') : '';
  const avoidKeywordsStr = avoidKeywords && avoidKeywords.length > 0 ? avoidKeywords.join(', ') : '';
  
  return {
    context: {
      language,
      lvl,
      lvlStyle,
      place,
      targetAudience,
      targetAudienceInstruction,
      outputFormat,
      formatInstruction,
      listAvoidance,
      imageSuggestionReminder,
      imageSuggestionFinalReminder,
      imageSuggestionReminderForStructure,
      geoContext,
      projectName,
      includeKeywords: includeKeywordsStr,
      avoidKeywords: avoidKeywordsStr,
      referenceSummaries,
      referenceList,
      dictionaryTerms,
      dictionaryList,
      structureParts,
      textToSimplify: text,
    },
    requiresImageSuggestion,
  };
}

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================

/**
 * Build enriched prompt by assembling all sections
 * Tries to use system templates first, falls back to hardcoded functions
 * @param {Object} params - Prompt building parameters
 * @returns {Promise<Object>} Object with { prompt: string, sections: Array }
 */
async function buildPrompt({
  text,
  lvl,
  place,
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
  // Prepare context for templates
  const { context, requiresImageSuggestion } = prepareTemplateContext({
    text,
    lvl,
    place,
    targetAudience,
    outputFormat,
    language,
    geoContext,
    includeKeywords,
    avoidKeywords,
    referenceSummaries,
    dictionaryTerms,
    projectName,
  });
  
  // Store flag for later use
  if (outputFormat) {
    outputFormat.requiresImageSuggestion = requiresImageSuggestion;
  }
  
  // Try to use templates first (if USE_TEMPLATES env var is set or templates exist)
  const useTemplates = process.env.USE_PROMPT_TEMPLATES === 'true';
  
  if (useTemplates) {
    try {
      // Templates expect variables with source 'context.field', so wrap the context
      const templateResult = await buildPromptFromTemplates({ context });
      
      // If templates returned a valid prompt, use it
      if (templateResult.prompt && templateResult.prompt.trim().length > 0) {
        // Merge template sections with tracked sections
        const sections = trackPromptSections({
          lvl,
          place,
          targetAudience,
          outputFormat,
          geoContext,
          includeKeywords,
          avoidKeywords,
          referenceSummaries,
          dictionaryTerms,
          projectName,
        });
        
        return {
          prompt: templateResult.prompt,
          sections,
          source: 'templates', // Indicate that templates were used
          abTestAssignments: templateResult.abTestAssignments || {}, // A/B test info
        };
      }
    } catch (error) {
      // If template building fails, log and fall back to hardcoded functions
      console.warn('Failed to build prompt from templates, falling back to hardcoded functions:', error.message);
    }
  }
  
  // Fallback to hardcoded functions (current implementation)
  let prompt = '';
  
  // 1. Role Definition
  prompt += buildRoleSection(language);
  
  // 2. LVL Context (includes place if selected)
  prompt += buildLvlContextSection(lvl, place);
  
  // 3. Target Audience
  prompt += buildTargetAudienceSection(targetAudience);
  
  // 4. Output Format (returns section and requiresImageSuggestion flag)
  const formatSection = buildOutputFormatSection(outputFormat);
  prompt += formatSection.section;
  
  // 5. Geographic Context
  prompt += buildGeographicContextSection(geoContext);
  
  // 6. Project Context
  prompt += buildProjectContextSection(projectName);
  
  // 7. Keywords (include and avoid)
  prompt += buildKeywordsSection(includeKeywords, avoidKeywords);
  
  // 8. References
  prompt += buildReferencesSection(referenceSummaries);
  
  // 9. Dictionary
  prompt += buildDictionarySection(dictionaryTerms);
  
  // 10. Base Instructions
  prompt += buildBaseInstructionsSection();
  
  // 11. Output Structure (uses requiresImageSuggestion flag)
  prompt += buildOutputStructureSection(outputFormat, formatSection.requiresImageSuggestion);
  
  // 12. Content (text to simplify)
  prompt += buildContentSection(text, language, formatSection.requiresImageSuggestion);
  
  // Track which sections were included
  const sections = trackPromptSections({
    lvl,
    place,
    targetAudience,
    outputFormat,
    geoContext,
    includeKeywords,
    avoidKeywords,
    referenceSummaries,
    dictionaryTerms,
    projectName,
  });
  
  return {
    prompt,
    sections,
    source: 'hardcoded', // Indicate that hardcoded functions were used
  };
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

/**
 * Update A/B test results with request data
 * @param {Object} abTestAssignments - Object mapping template names to A/B test info
 * @param {Object} requestData - Request data (tokens, responseTime, requestId)
 */
async function updateABTestResults(abTestAssignments, requestData) {
  try {
    // Get unique test IDs
    const testIds = [...new Set(Object.values(abTestAssignments).map(info => info.testId))];
    
    for (const testId of testIds) {
      const test = await ABTest.findById(testId);
      if (!test || test.status !== 'ACTIVE') {
        continue;
      }

      // Find which variant was used for this test
      const assignment = Object.values(abTestAssignments).find(a => a.testId === testId);
      if (!assignment) {
        continue;
      }

      // Update results
      await test.updateResults(assignment.variant, requestData);
    }
  } catch (error) {
    console.error('Error updating A/B test results:', error);
    throw error;
  }
}

// POST /api/simplify - Upgraded simplification endpoint
router.post('/', authenticate, simplifyRateLimit, async (req, res) => {
  try {
    const {
      text,
      teamId,
      projectId,
      lvlId,
      place,
      targetAudienceId,
      outputFormatId,
      languageId,
      geoContext,
      includeKeywords,
      avoidKeywords,
      referenceIds,
      customPrompt,
      templateId,
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

    // Use template, custom prompt, or build standard prompt
    let prompt;
    let promptSections = [];
    let promptMeta = {
      sectionsIncluded: [],
      promptLength: 0,
      estimatedTokens: 0,
      sanitizedPrompt: '',
    };
    
    // Priority: templateId > customPrompt > standard prompt
    if (templateId) {
      try {
        // Fetch the template
        const promptTemplate = await PromptTemplate.findById(templateId);
        if (!promptTemplate) {
          return res.status(404).json({ error: 'Prompt template not found' });
        }

        // Check permissions
        if (promptTemplate.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Not authorized to use global templates' });
        }

        if (promptTemplate.scope === 'TEAM' && promptTemplate.team) {
          if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
            if (!req.user.teams.includes(promptTemplate.team.toString())) {
              return res.status(403).json({ error: 'Not authorized to use this template' });
            }
          }
        }

        // Prepare context for template assembly
        const templateContext = {
          language: language.name,
          lvl: {
            name: lvl.name,
            code: lvl.code,
          },
          place: place || '',
          targetAudience: targetAudience?.name || '',
          outputFormat: outputFormat?.name || '',
          geoContext: geoContext || '',
          projectName: project.name,
          includeKeywords: includeKeywords?.join(', ') || '',
          avoidKeywords: avoidKeywords?.join(', ') || '',
          referenceSummaries: referenceSummaries || [],
          dictionaryTerms: dictionaryTerms || [],
          textToSimplify: sanitizedText,
        };

        // Assemble template (handles both component-based and full-text)
        const assembledResult = await assemblePromptTemplate(promptTemplate, templateContext);
        prompt = assembledResult.prompt;
        
        // Add the text to simplify if not already included
        if (!prompt.includes(sanitizedText)) {
          prompt += `\n\nPlease simplify the following ${language.name} text and respond in ${language.name}:\n\n"${sanitizedText}"`;
        }

        // Track that we used a template
        promptSections = [{ type: 'template', included: true, templateId: templateId, source: assembledResult.source }];
        promptSource = 'template';

        // Record template usage
        promptTemplate.usageCount = (promptTemplate.usageCount || 0) + 1;
        promptTemplate.lastUsed = new Date();
        await promptTemplate.save().catch(err => {
          console.error('Error recording template usage:', err);
          // Don't fail the request if usage recording fails
        });
      } catch (err) {
        console.error('Error using template:', err);
        // Fall back to standard prompt if template assembly fails
        // Continue with standard prompt building below
      }
    }
    
    // If template wasn't used or failed, check for custom prompt
    if (!prompt && customPrompt) {
      // If custom prompt is provided, sanitize it as well
      const sanitizedCustomPrompt = sanitizeInputText(customPrompt);
      prompt = sanitizedCustomPrompt;
      if (!prompt.includes(sanitizedText)) {
        prompt += `\n\nPlease simplify the following ${language.name} text and respond in ${language.name}:\n\n"${sanitizedText}"`;
      }
      // For custom prompts, we don't track sections (they're custom)
      promptSections = [{ type: 'custom', included: true }];
      promptSource = 'custom';
    }
    
    // If neither template nor custom prompt, build standard prompt
    if (!prompt) {
      // Build standard enriched prompt
      const promptResult = await buildPrompt({
        text,
        lvl,
        place,
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
      
      if (!promptResult || !promptResult.prompt) {
        throw new Error('Failed to build prompt: buildPrompt returned invalid result');
      }
      
      prompt = promptResult.prompt;
      promptSections = promptResult.sections || [];
      promptSource = promptResult.source || 'hardcoded';
    }

    // Validate prompt was created
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: prompt is not a valid string');
    }

    // Truncate if needed
    prompt = truncatePrompt(prompt);
    
    // Calculate prompt metadata
    promptMeta.promptLength = prompt.length;
    promptMeta.estimatedTokens = estimateTokens(prompt);
    promptMeta.sectionsIncluded = promptSections;
    promptMeta.sanitizedPrompt = sanitizePromptForLogging(prompt);
    
    // Log prompt for debugging (only if LOG_PROMPTS env var is set)
    if (process.env.LOG_PROMPTS === 'true') {
      console.log('=== PROMPT DEBUG INFO ===');
      console.log('Sections included:', promptSections.filter(s => s.included).map(s => s.type).join(', '));
      console.log('Prompt length:', promptMeta.promptLength, 'chars');
      console.log('Estimated tokens:', promptMeta.estimatedTokens);
      console.log('Sanitized prompt (first 2000 chars):');
      console.log(promptMeta.sanitizedPrompt);
      console.log('=== END PROMPT DEBUG ===');
    }

    // Track start time for A/B testing
    const startTime = Date.now();

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const simplifiedText = completion.choices[0].message.content;
    const responseTime = Date.now() - startTime; // in milliseconds

    // Extract token usage
    const usage = completion.usage || {};

    // Create request log
    const logData = {
      user: req.user.id,
      team: teamId,
      project: projectId,
      lvl: lvlId,
      originalText: sanitizedText,
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
    };
    
    // Add promptMeta only if it's valid
    if (promptMeta && promptMeta.sectionsIncluded) {
      logData.promptMeta = {
        ...promptMeta,
        source: promptSource, // Track if templates were used
      };
    }
    
    const requestLog = await RequestLog.create(logData);

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
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    // Try fallback to base prompt if enriched prompt fails
    if (error.message?.includes('token') || error.status === 400) {
      // Fallback logic could go here
      return res.status(500).json({
        error: 'Failed to simplify text. Prompt may be too long.',
        code: 'PROMPT_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    res.status(500).json({
      error: 'Failed to simplify text',
      code: 'SIMPLIFY_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Helper function to generate cache key
function generateCacheKey(query, keywords, lvlCode, place, geoContext) {
  const parts = [
    query,
    (keywords || []).sort().join(','),
    lvlCode || '',
    place || '',
    geoContext || '',
  ];
  return parts.join('|');
}

// Helper function to perform web research
async function performResearch({ query, keywords, lvlCode, place, geoContext, lvlName }) {
  if (!TAVILY_API_KEY) {
    throw new Error('Tavily API key not configured');
  }

  // Build search query
  let searchQuery = query;
  
  // Add context to search query
  const contextParts = [];
  if (keywords && keywords.length > 0) {
    contextParts.push(...keywords);
  }
  if (place) {
    contextParts.push(place);
  }
  if (geoContext) {
    contextParts.push(geoContext);
  }
  if (lvlName) {
    contextParts.push(lvlName);
  }
  
  if (contextParts.length > 0) {
    searchQuery = `${searchQuery} ${contextParts.join(' ')}`;
  }

  // Check cache first
  const cacheKey = generateCacheKey(query, keywords, lvlCode, place, geoContext);
  const cached = await ResearchCache.findOne({
    query: cacheKey,
    expiresAt: { $gt: new Date() },
  });

  if (cached) {
    console.log('Using cached research results');
    return {
      sources: cached.sources,
      aggregatedContext: cached.aggregatedContext,
      cached: true,
    };
  }

  // Perform web search using Tavily API
  console.log('Performing web research with query:', searchQuery);
  const searchResponse = await axios.post(
    TAVILY_API_URL,
    {
      api_key: TAVILY_API_KEY,
      query: searchQuery,
      search_depth: 'advanced',
      max_results: 5,
      include_answer: true,
      include_raw_content: true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const searchResults = searchResponse.data;

  // Extract and format sources
  const sources = (searchResults.results || []).map((result, index) => ({
    url: result.url,
    title: result.title,
    content: result.content || result.rawContent || '',
    publishedDate: result.publishedDate ? new Date(result.publishedDate) : null,
    relevanceScore: result.score || (1 - index * 0.1), // Higher score for top results
  }));

  // Aggregate context from sources
  const aggregatedContext = sources
    .map((source, index) => {
      return `[Bron ${index + 1}: ${source.title} (${source.url})]\n${source.content.substring(0, 500)}...`;
    })
    .join('\n\n');

  // Cache results for 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await ResearchCache.create({
    query: cacheKey,
    keywords: keywords || [],
    lvlCode,
    place,
    geoContext,
    results: searchResults,
    sources,
    aggregatedContext,
    expiresAt,
  });

  return {
    sources,
    aggregatedContext,
    cached: false,
  };
}

// POST /api/simplify/research - Research mode endpoint
router.post('/research', authenticate, researchRateLimit, async (req, res) => {
  try {
    const {
      text,
      teamId,
      projectId,
      lvlId,
      place,
      targetAudienceId,
      outputFormatId,
      languageId,
      geoContext,
      includeKeywords,
      avoidKeywords,
      referenceIds,
      customPrompt,
    } = req.body;

    // Validate required fields
    if (!text || !teamId || !projectId || !lvlId) {
      return res.status(400).json({
        error: 'Text, teamId, projectId, and lvlId are required',
      });
    }

    // Check if research mode is enabled
    if (!TAVILY_API_KEY) {
      return res.status(503).json({
        error: 'Research mode is not available. Tavily API key not configured.',
        code: 'RESEARCH_DISABLED',
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

    // Perform research
    let researchResults = null;
    let researchSources = [];
    
    try {
      researchResults = await performResearch({
        query: sanitizedText.substring(0, 200), // Use first 200 chars as query
        keywords: includeKeywords || [],
        lvlCode: lvl.code,
        place: place,
        geoContext: geoContext,
        lvlName: lvl.name,
      });
      researchSources = researchResults.sources;
    } catch (researchError) {
      console.error('Research error:', researchError);
      // Continue with simplification even if research fails
      // but log the error
    }

    // Build enriched prompt with research context
    const referenceSummaries = references
      .filter(ref => ref.summary)
      .map(ref => ({ title: ref.title, summary: ref.summary }))
      .slice(0, 5);

    const dictionaryTerms = dictionaryEntries.map(entry => ({
      originalTerm: entry.originalTerm,
      simplifiedTerm: entry.simplifiedTerm,
    }));

    // Use template, custom prompt, or build standard prompt
    let prompt;
    let promptSections = [];
    let promptMeta = {
      sectionsIncluded: [],
      promptLength: 0,
      estimatedTokens: 0,
      sanitizedPrompt: '',
    };
    
    // Priority: templateId > customPrompt > standard prompt
    if (templateId) {
      try {
        // Fetch the template
        const promptTemplate = await PromptTemplate.findById(templateId);
        if (!promptTemplate) {
          return res.status(404).json({ error: 'Prompt template not found' });
        }

        // Check permissions
        if (promptTemplate.scope === 'GLOBAL' && req.user.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Not authorized to use global templates' });
        }

        if (promptTemplate.scope === 'TEAM' && promptTemplate.team) {
          if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEADER') {
            if (!req.user.teams.includes(promptTemplate.team.toString())) {
              return res.status(403).json({ error: 'Not authorized to use this template' });
            }
          }
        }

        // Prepare context for template assembly
        const templateContext = {
          language: language.name,
          lvl: {
            name: lvl.name,
            code: lvl.code,
          },
          place: place || '',
          targetAudience: targetAudience?.name || '',
          outputFormat: outputFormat?.name || '',
          geoContext: geoContext || '',
          projectName: project.name,
          includeKeywords: includeKeywords?.join(', ') || '',
          avoidKeywords: avoidKeywords?.join(', ') || '',
          referenceSummaries: referenceSummaries || [],
          dictionaryTerms: dictionaryTerms || [],
          textToSimplify: sanitizedText,
        };

        // Assemble template (handles both component-based and full-text)
        const assembledResult = await assemblePromptTemplate(promptTemplate, templateContext);
        prompt = assembledResult.prompt;
        
        // Add the text to simplify if not already included
        if (!prompt.includes(sanitizedText)) {
          prompt += `\n\nPlease simplify the following ${language.name} text and respond in ${language.name}:\n\n"${sanitizedText}"`;
        }

        // Track that we used a template
        promptSections = [{ type: 'template', included: true, templateId: templateId, source: assembledResult.source }];
        promptSource = 'template';

        // Record template usage
        promptTemplate.usageCount = (promptTemplate.usageCount || 0) + 1;
        promptTemplate.lastUsed = new Date();
        await promptTemplate.save().catch(err => {
          console.error('Error recording template usage:', err);
          // Don't fail the request if usage recording fails
        });
      } catch (err) {
        console.error('Error using template:', err);
        // Fall back to standard prompt if template assembly fails
        // Continue with standard prompt building below
      }
    }
    
    // If template wasn't used or failed, check for custom prompt
    if (!prompt && customPrompt) {
      const sanitizedCustomPrompt = sanitizeInputText(customPrompt);
      prompt = sanitizedCustomPrompt;
      if (!prompt.includes(sanitizedText)) {
        prompt += `\n\nPlease simplify the following ${language.name} text and respond in ${language.name}:\n\n"${sanitizedText}"`;
      }
      // For custom prompts, we don't track sections (they're custom)
      promptSections = [{ type: 'custom', included: true }];
      promptSource = 'custom';
    }
    
    // If neither template nor custom prompt, build standard prompt
    if (!prompt) {
      // Build standard enriched prompt
      const promptResult = await buildPrompt({
        text: sanitizedText,
        lvl,
        place,
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
      
      if (!promptResult || !promptResult.prompt) {
        throw new Error('Failed to build prompt: buildPrompt returned invalid result');
      }
      
      prompt = promptResult.prompt;
      promptSections = promptResult.sections || [];
      promptSource = promptResult.source || 'hardcoded';
    }

    // Validate prompt was created
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: prompt is not a valid string');
    }

    // Add research context to prompt
    if (researchResults && researchResults.aggregatedContext) {
      prompt += `\n\n--- RESEARCH CONTEXT (from web sources) ---\n`;
      prompt += `The following information was gathered from web research to provide additional context:\n\n`;
      prompt += researchResults.aggregatedContext;
      prompt += `\n\nUse this research context to enhance the simplification while maintaining accuracy. Cite sources when using information from research.\n`;
      prompt += `--- END RESEARCH CONTEXT ---\n\n`;
      // Add research context to sections tracking
      promptSections.push({ type: 'researchContext', included: true });
    }

    // Truncate if needed
    prompt = truncatePrompt(prompt);
    
    // Calculate prompt metadata
    promptMeta.promptLength = prompt.length;
    promptMeta.estimatedTokens = estimateTokens(prompt);
    promptMeta.sectionsIncluded = promptSections;
    promptMeta.sanitizedPrompt = sanitizePromptForLogging(prompt);
    
    // Log prompt for debugging (only if LOG_PROMPTS env var is set)
    if (process.env.LOG_PROMPTS === 'true') {
      console.log('=== PROMPT DEBUG INFO (RESEARCH MODE) ===');
      console.log('Sections included:', promptSections.filter(s => s.included).map(s => s.type).join(', '));
      console.log('Prompt length:', promptMeta.promptLength, 'chars');
      console.log('Estimated tokens:', promptMeta.estimatedTokens);
      console.log('Sanitized prompt (first 2000 chars):');
      console.log(promptMeta.sanitizedPrompt);
      console.log('=== END PROMPT DEBUG ===');
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const simplifiedText = completion.choices[0]?.message?.content;

    if (!simplifiedText) {
      return res.status(500).json({ error: 'Failed to generate simplified text' });
    }

    // Log the request
    const logData = {
      user: req.user.id,
      team: teamId,
      project: projectId,
      lvl: lvlId,
      place: place || undefined,
      targetAudience: targetAudienceId || undefined,
      outputFormat: outputFormatId || undefined,
      language: languageId || undefined,
      originalText: sanitizedText,
      simplifiedText,
      geoContext: geoContext || undefined,
      includeKeywords: includeKeywords || [],
      avoidKeywords: avoidKeywords || [],
      referenceIds: referenceIds || [],
      modelMeta: {
        model: process.env.OPENAI_MODEL || 'gpt-4',
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
      researchMode: true,
      researchSources: researchSources.map(s => ({
        url: s.url,
        title: s.title,
      })),
    };
    
      // Add promptMeta only if it's valid
      if (promptMeta && promptMeta.sectionsIncluded) {
        logData.promptMeta = {
          ...promptMeta,
          source: promptSource, // Track if templates were used
        };
      }
    
    await RequestLog.create(logData);

    res.json({
      simplifiedText,
      meta: {
        model: process.env.OPENAI_MODEL || 'gpt-4',
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
        researchMode: true,
        sources: researchSources.map(s => ({
          url: s.url,
          title: s.title,
          relevanceScore: s.relevanceScore,
        })),
        cached: researchResults?.cached || false,
      },
    });
  } catch (error) {
    console.error('Error in research mode:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    res.status(500).json({
      error: 'Failed to simplify text with research',
      code: 'RESEARCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;

