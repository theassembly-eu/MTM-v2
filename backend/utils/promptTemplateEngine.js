import SystemPromptTemplate from '../models/SystemPromptTemplate.js';

/**
 * Prompt Template Engine
 * Handles loading, selecting, and assembling system prompt templates
 */

/**
 * Resolve a variable path from context (e.g., 'context.lvl.code' -> actual value)
 * @param {string} path - Dot-separated path (e.g., 'context.lvl.code')
 * @param {Object} context - Context object containing the data
 * @returns {any} Resolved value or undefined
 */
function resolveVariable(path, context) {
  const parts = path.split('.');
  let value = context;
  
  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }
  
  return value;
}

/**
 * Evaluate a condition against context
 * @param {Object} condition - Condition object with field, operator, value
 * @param {Object} context - Context object
 * @returns {boolean} Whether condition is met
 */
function evaluateCondition(condition, context) {
  const { field, operator, value } = condition;
  const fieldValue = resolveVariable(field, context);
  
  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'notExists':
      return fieldValue === undefined || fieldValue === null;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    default:
      console.warn(`Unknown condition operator: ${operator}`);
      return false;
  }
}

/**
 * Resolve variables in template content
 * @param {string} content - Template content with {{variable}} placeholders
 * @param {Array} variables - Variable definitions
 * @param {Object} context - Context object
 * @returns {string} Resolved content
 */
function resolveTemplateVariables(content, variables, context) {
  let resolved = content;
  
  if (!variables || variables.length === 0) {
    return resolved;
  }
  
  variables.forEach(variable => {
    const { name, source, required, defaultValue } = variable;
    const value = resolveVariable(source, context);
    
    if (value === undefined || value === null) {
      if (required) {
        console.warn(`Required variable ${name} (${source}) not found in context`);
        resolved = resolved.replace(new RegExp(`{{${name}}}`, 'g'), defaultValue || '');
      } else {
        resolved = resolved.replace(new RegExp(`{{${name}}}`, 'g'), defaultValue || '');
      }
    } else {
      resolved = resolved.replace(new RegExp(`{{${name}}}`, 'g'), String(value));
    }
  });
  
  return resolved;
}

/**
 * Select templates that match the given context
 * @param {Array} templates - Array of SystemPromptTemplate documents
 * @param {Object} context - Context object
 * @returns {Array} Filtered templates that match conditions
 */
function selectTemplates(templates, context) {
  return templates.filter(template => {
    // Skip inactive templates
    if (!template.isActive) {
      return false;
    }
    
    // If no conditions, include template
    if (!template.conditions || template.conditions.length === 0) {
      return true;
    }
    
    // All conditions must be met (AND logic)
    return template.conditions.every(condition => evaluateCondition(condition, context));
  });
}

/**
 * Order templates by priority
 * @param {Array} templates - Array of templates
 * @returns {Array} Sorted templates
 */
function orderTemplates(templates) {
  return [...templates].sort((a, b) => {
    // Higher priority first
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    // Then by name for consistency
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get template content for a specific version
 * @param {Object} template - Template document
 * @param {string} version - Optional version string (if not provided, uses currentVersion)
 * @returns {Object} Template content object with content, variables, conditions
 */
function getTemplateVersion(template, version = null) {
  // If no version specified, use current version
  const targetVersion = version || template.currentVersion || template.version;
  
  // If requesting current version, return current template data
  if (targetVersion === (template.currentVersion || template.version)) {
    return {
      content: template.content,
      variables: template.variables || [],
      conditions: template.conditions || [],
      priority: template.priority,
      version: targetVersion,
    };
  }
  
  // Otherwise, find in version history
  if (template.versionHistory && template.versionHistory.length > 0) {
    const versionEntry = template.versionHistory.find(v => v.version === targetVersion);
    if (versionEntry) {
      return {
        content: versionEntry.content,
        variables: versionEntry.variables || [],
        conditions: versionEntry.conditions || [],
        priority: versionEntry.priority,
        version: targetVersion,
      };
    }
  }
  
  // Fallback to current version if requested version not found
  console.warn(`Version ${targetVersion} not found for template ${template.name}, using current version`);
  return {
    content: template.content,
    variables: template.variables || [],
    conditions: template.conditions || [],
    priority: template.priority,
    version: template.currentVersion || template.version,
  };
}

/**
 * Build prompt from system templates
 * @param {Object} context - Context object with all data needed for templates
 * @param {Array} templateTypes - Optional array of types to include (if not provided, includes all)
 * @param {Object} versionOverrides - Optional object mapping template names to specific versions
 * @returns {Object} Object with { prompt: string, sections: Array }
 */
export async function buildPromptFromTemplates(context, templateTypes = null, versionOverrides = {}) {
  try {
    // Load all active templates
    const filter = { isActive: true };
    if (templateTypes && templateTypes.length > 0) {
      filter.type = { $in: templateTypes };
    }
    
    const allTemplates = await SystemPromptTemplate.find(filter);
    
    if (allTemplates.length === 0) {
      // Fallback: return empty prompt if no templates found
      console.warn('No system prompt templates found, returning empty prompt');
      return {
        prompt: '',
        sections: [],
      };
    }
    
    // Select templates that match conditions
    const selectedTemplates = selectTemplates(allTemplates, context);
    
    // Order by priority
    const orderedTemplates = orderTemplates(selectedTemplates);
    
    // Resolve variables and assemble prompt
    let prompt = '';
    const sections = [];
    
    orderedTemplates.forEach(template => {
      // Get the appropriate version of the template
      const requestedVersion = versionOverrides[template.name] || null;
      const templateVersion = getTemplateVersion(template, requestedVersion);
      
      const resolvedContent = resolveTemplateVariables(
        templateVersion.content,
        templateVersion.variables,
        context
      );
      
      prompt += resolvedContent;
      
      sections.push({
        type: template.type,
        name: template.name,
        version: templateVersion.version,
        included: true,
      });
    });
    
    return {
      prompt,
      sections: sections.map(s => ({ type: s.type, name: s.name, version: s.version, included: s.included })),
    };
  } catch (error) {
    console.error('Error building prompt from templates:', error);
    throw error;
  }
}

/**
 * Get available template types
 * @returns {Array} Array of template type strings
 */
export function getTemplateTypes() {
  return ['role', 'context', 'instruction', 'structure', 'behavior'];
}

/**
 * Validate template content and variables
 * @param {Object} template - Template object to validate
 * @returns {Object} Validation result with { valid: boolean, errors: Array }
 */
export function validateTemplate(template) {
  const errors = [];
  
  if (!template.name || template.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!template.type || !getTemplateTypes().includes(template.type)) {
    errors.push(`Type must be one of: ${getTemplateTypes().join(', ')}`);
  }
  
  if (!template.content || template.content.trim().length === 0) {
    errors.push('Content is required');
  }
  
  // Validate variables reference content placeholders
  if (template.variables && template.variables.length > 0) {
    template.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      if (!template.content.includes(placeholder)) {
        errors.push(`Variable ${variable.name} is defined but not used in content`);
      }
    });
    
    // Check for unresolved placeholders
    const placeholderRegex = /{{(\w+)}}/g;
    const matches = template.content.match(placeholderRegex);
    if (matches) {
      const definedVariables = template.variables.map(v => v.name);
      matches.forEach(match => {
        const varName = match.replace(/[{}]/g, '');
        if (!definedVariables.includes(varName)) {
          errors.push(`Placeholder ${match} found in content but variable not defined`);
        }
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

