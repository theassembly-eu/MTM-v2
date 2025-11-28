/**
 * Migration Script: Convert hardcoded prompt sections to SystemPromptTemplate entries
 * 
 * This script creates system prompt templates from the current hardcoded prompt sections.
 * Run this once to seed the database with templates.
 * 
 * Usage: node backend/scripts/migratePromptSectionsToTemplates.js
 */

import mongoose from 'mongoose';
import SystemPromptTemplate from '../models/SystemPromptTemplate.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// LVL style context mapping (same as in simplify.js)
const lvlStyleMap = {
  LOCAL: 'Use informal, direct, community-focused language. Keep it simple and relatable to local residents.',
  PROVINCIAL: 'Use balanced formality with regional context. Structure clearly for provincial audiences.',
  REGIONAL: 'Use formal but accessible language, policy-focused. Structure for regional governance context.',
  COMMUNITY: 'Use language-community specific terminology and cultural context. Maintain formal but approachable tone.',
  FEDERAL: 'Use highly formal, policy-precise, institutional tone. Maintain clarity while respecting federal governance standards.',
};

// Target audience instructions
const targetAudienceMap = {
  'Algemeen': 'for a broad audience, like "your uncle at the family party."',
  'Jongeren': 'for a 20-year-old audience, using modern, engaging, and slightly informal language, including relevant slang or expressions where appropriate, but maintaining clarity.',
  'Ouderen': 'for an elderly audience, using formal, respectful, and very clear language, avoiding jargon and complex sentence structures.',
};

async function migratePromptSections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing system templates (optional - comment out if you want to keep existing)
    // await SystemPromptTemplate.deleteMany({});
    // console.log('Cleared existing system templates');

    const templates = [];

    // 1. Role Section Template
    templates.push({
      name: 'role_definition',
      description: 'Defines the AI role as a marketing professional specializing in text simplification',
      type: 'role',
      content: 'You are a helpful seasoned professional in marketing with years of experience that simplifies complex {{languageName}} political texts into clear, active, empathetic, and non-condescending language. You pay a lot of attention to Solidarity & social justice, Equal opportunity, Protecting purchasing power and fair taxation, Social-democratic economy. You are never condescending, very approachable and direct. Your tone is tailored on the Belgian audience.\n\n',
      variables: [
        {
          name: 'languageName',
          source: 'context.language.name',
          required: true,
          defaultValue: 'Dutch',
        },
      ],
      conditions: [],
      priority: 100, // Highest priority - always first
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Base role definition for all simplification requests',
      },
    });

    // 2. LVL Context Template
    templates.push({
      name: 'lvl_context',
      description: 'Provides communication level context based on LVL code',
      type: 'context',
      content: 'Communication Level Context: {{lvlStyle}}\n\n',
      variables: [
        {
          name: 'lvlStyle',
          source: 'context.lvlStyle',
          required: true,
          defaultValue: '',
        },
      ],
      conditions: [
        {
          field: 'context.lvl',
          operator: 'exists',
        },
      ],
      priority: 90,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'LVL style context - only included if LVL is provided',
      },
    });

    // 3. Place Context Template
    templates.push({
      name: 'place_context',
      description: 'Provides place-specific context when a place is selected',
      type: 'context',
      content: 'IMPORTANT: This text is specifically for {{place}}. Use local terminology, names of institutions, and context specific to {{place}}. Reference local landmarks, districts, or relevant local information when appropriate.\n\n',
      variables: [
        {
          name: 'place',
          source: 'context.place',
          required: true,
        },
      ],
      conditions: [
        {
          field: 'context.place',
          operator: 'exists',
        },
      ],
      priority: 85,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Place-specific context - only included if place is selected',
      },
    });

    // 4. Target Audience Template
    templates.push({
      name: 'target_audience',
      description: 'Provides target audience instructions',
      type: 'instruction',
      content: 'Target Audience: {{audienceInstruction}}\n\n',
      variables: [
        {
          name: 'audienceInstruction',
          source: 'context.targetAudienceInstruction',
          required: true,
          defaultValue: '',
        },
      ],
      conditions: [
        {
          field: 'context.targetAudience',
          operator: 'exists',
        },
      ],
      priority: 80,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Target audience instructions - only included if target audience is provided',
      },
    });

    // 5. Output Format Template
    templates.push({
      name: 'output_format',
      description: 'Provides output format instructions',
      type: 'instruction',
      content: 'Output Format: {{formatInstruction}}\n{{listAvoidance}}\n{{imageSuggestionReminder}}\n',
      variables: [
        {
          name: 'formatInstruction',
          source: 'context.formatInstruction',
          required: true,
          defaultValue: 'Provide a concise summary.',
        },
        {
          name: 'listAvoidance',
          source: 'context.listAvoidance',
          required: false,
          defaultValue: '',
        },
        {
          name: 'imageSuggestionReminder',
          source: 'context.imageSuggestionReminder',
          required: false,
          defaultValue: '',
        },
      ],
      conditions: [
        {
          field: 'context.outputFormat',
          operator: 'exists',
        },
      ],
      priority: 75,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Output format instructions - only included if output format is provided',
      },
    });

    // 6. Geographic Context Template
    templates.push({
      name: 'geographic_context',
      description: 'Provides geographic context',
      type: 'context',
      content: 'Geographic Context: This text is for {{geoContext}}. Use local terminology and context where appropriate.\n\n',
      variables: [
        {
          name: 'geoContext',
          source: 'context.geoContext',
          required: true,
        },
      ],
      conditions: [
        {
          field: 'context.geoContext',
          operator: 'exists',
        },
      ],
      priority: 70,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Geographic context - only included if geoContext is provided',
      },
    });

    // 7. Project Context Template
    templates.push({
      name: 'project_context',
      description: 'Provides project context',
      type: 'context',
      content: 'Project Context: This simplification is part of the "{{projectName}}" project. Maintain consistency with this project\'s communication style.\n\n',
      variables: [
        {
          name: 'projectName',
          source: 'context.projectName',
          required: true,
        },
      ],
      conditions: [
        {
          field: 'context.projectName',
          operator: 'exists',
        },
      ],
      priority: 65,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Project context - only included if projectName is provided',
      },
    });

    // 8. Keywords Template (Include)
    templates.push({
      name: 'keywords_include',
      description: 'Provides include keywords instructions',
      type: 'instruction',
      content: 'IMPORTANT: You MUST include or reference these keywords: {{includeKeywords}}\n\n',
      variables: [
        {
          name: 'includeKeywords',
          source: 'context.includeKeywords',
          required: true,
        },
      ],
      conditions: [
        {
          field: 'context.includeKeywords',
          operator: 'exists',
        },
      ],
      priority: 60,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Include keywords - only included if includeKeywords are provided',
      },
    });

    // 9. Keywords Template (Avoid)
    templates.push({
      name: 'keywords_avoid',
      description: 'Provides avoid keywords instructions',
      type: 'instruction',
      content: 'IMPORTANT: You MUST avoid using these keywords or terms: {{avoidKeywords}}\n\n',
      variables: [
        {
          name: 'avoidKeywords',
          source: 'context.avoidKeywords',
          required: true,
        },
      ],
      conditions: [
        {
          field: 'context.avoidKeywords',
          operator: 'exists',
        },
      ],
      priority: 55,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Avoid keywords - only included if avoidKeywords are provided',
      },
    });

    // 10. References Template
    templates.push({
      name: 'references',
      description: 'Provides contextual references',
      type: 'context',
      content: 'Contextual References:\n{{referenceList}}\n',
      variables: [
        {
          name: 'referenceList',
          source: 'context.referenceList',
          required: true,
          defaultValue: '',
        },
      ],
      conditions: [
        {
          field: 'context.referenceSummaries',
          operator: 'exists',
        },
      ],
      priority: 50,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'References - only included if references are provided',
      },
    });

    // 11. Dictionary Template
    templates.push({
      name: 'dictionary',
      description: 'Provides dictionary terms for simplification',
      type: 'instruction',
      content: 'Use the following dictionary for simplification:\n{{dictionaryList}}\n',
      variables: [
        {
          name: 'dictionaryList',
          source: 'context.dictionaryList',
          required: true,
          defaultValue: '',
        },
      ],
      conditions: [
        {
          field: 'context.dictionaryTerms',
          operator: 'exists',
        },
      ],
      priority: 45,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Dictionary - only included if dictionary terms are provided',
      },
    });

    // 12. Base Instructions Template
    templates.push({
      name: 'base_instructions',
      description: 'Base instructions for text simplification',
      type: 'instruction',
      content: 'Your output should consist of short sentences and short words, with no more than 3 syllables per word, unless absolutely necessary for clarity or specific audience tone. ABSOLUTELY AVOID technical terms; if a technical term is unavoidable, rephrase it in simple language.\n\n',
      variables: [],
      conditions: [],
      priority: 40,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Base instructions - always included',
      },
    });

    // 13. Output Structure Template
    templates.push({
      name: 'output_structure',
      description: 'Defines the structure of the output',
      type: 'structure',
      content: 'Structure your response as follows, clearly separating each part with a "---" separator, and use paragraphs and line breaks for readability:\n{{structureParts}}\n{{imageSuggestionReminder}}\n',
      variables: [
        {
          name: 'structureParts',
          source: 'context.structureParts',
          required: true,
          defaultValue: '',
        },
        {
          name: 'imageSuggestionReminder',
          source: 'context.imageSuggestionReminder',
          required: false,
          defaultValue: '',
        },
      ],
      conditions: [],
      priority: 30,
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Output structure - always included',
      },
    });

    // 14. Content Template
    templates.push({
      name: 'content',
      description: 'The text to simplify',
      type: 'instruction',
      content: 'Please simplify the following {{languageName}} text and respond in {{languageName}}. Ensure the tone is strongly connotated and impactful.\n\n{{imageSuggestionFinalReminder}}\n"{{textToSimplify}}"',
      variables: [
        {
          name: 'languageName',
          source: 'context.language.name',
          required: true,
          defaultValue: 'Dutch',
        },
        {
          name: 'imageSuggestionFinalReminder',
          source: 'context.imageSuggestionFinalReminder',
          required: false,
          defaultValue: '',
        },
        {
          name: 'textToSimplify',
          source: 'context.textToSimplify',
          required: true,
        },
      ],
      conditions: [],
      priority: 10, // Lowest priority - always last
      version: '1.0.0',
      isActive: true,
      metadata: {
        author: 'system',
        notes: 'Content to simplify - always included, always last',
      },
    });

    // Insert templates (using upsert to avoid duplicates)
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      try {
        const result = await SystemPromptTemplate.findOneAndUpdate(
          { name: template.name },
          template,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        if (result.isNew) {
          created++;
          console.log(`✓ Created template: ${template.name}`);
        } else {
          updated++;
          console.log(`↻ Updated template: ${template.name}`);
        }
      } catch (error) {
        console.error(`✗ Error processing template ${template.name}:`, error.message);
        skipped++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${templates.length}`);

    await mongoose.disconnect();
    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migratePromptSections();

