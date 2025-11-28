/**
 * Utility to assemble prompts from PromptTemplate components
 * Handles both component-based and full-text templates
 */

import SystemPromptTemplate from '../models/SystemPromptTemplate.js';
import { buildPromptFromTemplates } from './promptTemplateEngine.js';

/**
 * Assemble a prompt from a PromptTemplate
 * Supports both component-based and full-text templates
 * 
 * @param {Object} promptTemplate - The PromptTemplate document
 * @param {Object} context - Context object for variable resolution
 * @returns {Promise<Object>} - { prompt: string, source: 'components' | 'fulltext', componentsUsed: array }
 */
export async function assemblePromptTemplate(promptTemplate, context) {
  // If using components, assemble from System Templates
  if (promptTemplate.useComponents && promptTemplate.componentReferences && promptTemplate.componentReferences.length > 0) {
    try {
      // Get enabled components in order
      const enabledComponents = promptTemplate.componentReferences
        .filter(ref => ref.enabled !== false)
        .sort((a, b) => a.order - b.order);

      if (enabledComponents.length === 0) {
        throw new Error('No enabled components found in template');
      }

      // Fetch System Templates
      const systemTemplateIds = enabledComponents.map(ref => ref.systemTemplateId);
      const systemTemplates = await SystemPromptTemplate.find({
        _id: { $in: systemTemplateIds },
        isActive: true,
      });

      if (systemTemplates.length === 0) {
        throw new Error('No active system templates found for components');
      }

      // Create a filtered context that only includes the specific templates we want
      // We'll use the template engine but filter to only our selected templates
      const templateMap = new Map();
      systemTemplates.forEach(template => {
        templateMap.set(template._id.toString(), template);
      });

      // Build prompt using only the selected components
      // We need to manually assemble since buildPromptFromTemplates selects all matching templates
      // Instead, we'll build it manually from our selected components
      let assembledPrompt = '';
      const componentsUsed = [];

      for (const componentRef of enabledComponents) {
        const systemTemplate = templateMap.get(componentRef.systemTemplateId.toString());
        if (!systemTemplate) {
          console.warn(`System template ${componentRef.systemTemplateId} not found, skipping`);
          continue;
        }

        // Resolve variables in this component
        let componentContent = systemTemplate.content;
        
        // Resolve variables if any
        if (systemTemplate.variables && systemTemplate.variables.length > 0) {
          for (const variable of systemTemplate.variables) {
            const value = resolveVariable(variable.source, context);
            const placeholder = `{{${variable.name}}}`;
            componentContent = componentContent.replace(new RegExp(placeholder, 'g'), value || variable.defaultValue || '');
          }
        }

        assembledPrompt += componentContent + '\n\n';
        componentsUsed.push({
          name: systemTemplate.name,
          type: systemTemplate.type,
          order: componentRef.order,
        });
      }

      return {
        prompt: assembledPrompt.trim(),
        source: 'components',
        componentsUsed,
      };
    } catch (error) {
      console.error('Error assembling component-based template:', error);
      // Fallback to full text if available
      if (promptTemplate.prompt) {
        return {
          prompt: promptTemplate.prompt,
          source: 'fulltext',
          componentsUsed: [],
          error: 'Component assembly failed, using full text fallback',
        };
      }
      throw error;
    }
  }

  // Fallback to full-text prompt
  if (promptTemplate.prompt) {
    return {
      prompt: promptTemplate.prompt,
      source: 'fulltext',
      componentsUsed: [],
    };
  }

  throw new Error('Template has neither components nor full text prompt');
}

/**
 * Resolve a variable from context using dot notation
 * @param {string} path - Dot notation path (e.g., 'context.lvl.name')
 * @param {Object} context - Context object
 * @returns {any} - Resolved value or null
 */
function resolveVariable(path, context) {
  const parts = path.split('.');
  let value = context;
  
  for (const part of parts) {
    if (value == null) {
      return null;
    }
    value = value[part];
  }
  
  return value;
}

