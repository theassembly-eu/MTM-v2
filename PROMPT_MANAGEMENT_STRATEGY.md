# Prompt Management Strategy for MTM 2.0

## Executive Summary

This document outlines an advanced prompt management system for MensentaalMachine 2.0, addressing current limitations and proposing a scalable, maintainable architecture for AI prompt engineering.

---

## 1. Current State Analysis

### 1.1 Current Architecture

The current prompt building system (`backend/routes/simplify.js`) uses a monolithic `buildPrompt()` function that:

- **Linearly constructs prompts** by concatenating strings
- **Mixes concerns**: Format instructions, structure definitions, and behavioral rules are interleaved
- **Uses hardcoded fallbacks** when database values are missing
- **Lacks modularity**: Changes to one section can affect others
- **No versioning**: Cannot track prompt evolution or A/B test variations
- **Limited observability**: Difficult to debug which parts of the prompt caused specific outputs

### 1.2 Identified Issues

#### Issue 1: Image Suggestion Not Returned
**Root Cause**: The image suggestion instruction was placed in the "Output Format" section but not included in the structured output format definition. The AI was told to follow a specific structure that didn't include the image suggestion.

**Solution Applied**: Integrated image suggestion into the structured output format as a required section when the Instagram format is selected.

#### Issue 2: Prompt Structure Inconsistency
- Instructions scattered across multiple sections
- No clear separation between "what to do" and "how to format"
- Format-specific behaviors mixed with general instructions

#### Issue 3: Limited Extensibility
- Adding new output formats requires code changes
- Format-specific behaviors are hardcoded
- No way to test prompt variations

---

## 2. Prompt Engineering Best Practices

### 2.1 Core Principles

1. **Explicit Structure Over Implicit Hints**
   - ✅ DO: "Structure your response as: --- Section 1 --- Section 2"
   - ❌ DON'T: "Also include an image suggestion somewhere"

2. **Place Critical Instructions in Output Structure**
   - Instructions about required sections must be in the structure definition
   - Don't rely on the AI to remember instructions from earlier in the prompt

3. **Use Clear Delimiters**
   - Consistent separators (e.g., "---") help parsing and AI understanding
   - Mark required vs optional sections explicitly

4. **Separate Concerns**
   - **Context**: What the AI needs to know (LVL, place, references)
   - **Instructions**: What the AI should do (format, tone, style)
   - **Structure**: How to format the output (sections, separators)

5. **Progressive Disclosure**
   - Most important instructions first
   - Context before structure
   - Structure before content

### 2.2 Prompt Composition Pattern

```
[Role Definition]
[Context Layer 1: High-level context]
[Context Layer 2: Specific context]
[Behavioral Instructions]
[Output Structure Definition]
[Content to Process]
```

### 2.3 Format-Specific Instructions

When a format requires special handling:
1. **Flag it early** (in format instruction section)
2. **Include it in structure** (in output structure definition)
3. **Reinforce it** (in behavioral instructions if needed)

---

## 3. Proposed Advanced Prompt Management System

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Prompt Management Layer                    │
├─────────────────────────────────────────────────────────┤
│  Prompt Template Engine  │  Prompt Versioning          │
│  Prompt Builder          │  Prompt Testing             │
│  Context Assembler       │  Prompt Analytics           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│              Configuration Layer                        │
├─────────────────────────────────────────────────────────┤
│  OutputFormat Model      │  PromptTemplate Model        │
│  LVL Model              │  TargetAudience Model        │
│  (Database-driven)                                      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│              Execution Layer                             │
├─────────────────────────────────────────────────────────┤
│  OpenAI API Client      │  Response Parser             │
│  Research Integration    │  Logging & Analytics         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Core Components

#### 3.2.1 Prompt Template System

**Concept**: Modular, reusable prompt components stored as templates.

**Structure**:
```javascript
{
  id: 'base-role',
  type: 'role',
  content: 'You are a helpful seasoned professional...',
  priority: 1,
  conditions: []
}

{
  id: 'lvl-context',
  type: 'context',
  content: 'Communication Level Context: {{lvlStyle}}',
  priority: 2,
  conditions: ['lvl.exists']
}

{
  id: 'output-structure-instagram',
  type: 'structure',
  content: [
    'Emotional Core Message: ...',
    'Problem Statement: ...',
    'Simplified Text: ...',
    'Image Suggestion: REQUIRED - Provide detailed description...'
  ],
  priority: 10,
  conditions: ['outputFormat.name === "Korte versie (Instagram-achtig)"']
}
```

**Benefits**:
- Reusable components
- Easy to test variations
- Version control for templates
- A/B testing capability

#### 3.2.2 Prompt Builder

**Responsibilities**:
- Assemble templates based on conditions
- Resolve variables ({{lvlStyle}}, {{place}}, etc.)
- Apply priority ordering
- Validate completeness

**Example**:
```javascript
class PromptBuilder {
  constructor(templates, context) {
    this.templates = templates;
    this.context = context;
  }
  
  build() {
    const activeTemplates = this.selectTemplates();
    const orderedTemplates = this.orderByPriority(activeTemplates);
    const resolvedTemplates = this.resolveVariables(orderedTemplates);
    return this.combine(resolvedTemplates);
  }
  
  selectTemplates() {
    return this.templates.filter(t => 
      this.evaluateConditions(t.conditions, this.context)
    );
  }
}
```

#### 3.2.3 Context Assembler

**Responsibilities**:
- Gather all context data (LVL, place, references, etc.)
- Normalize data formats
- Apply business rules (e.g., only show selected place, not all places)
- Prepare data for template resolution

#### 3.2.4 Prompt Versioning

**Concept**: Track prompt versions for:
- Rollback capability
- A/B testing
- Performance analysis
- Compliance/audit trails

**Implementation**:
```javascript
{
  promptId: 'simplify-v2.1',
  version: '2.1.0',
  templates: ['base-role-v1', 'lvl-context-v2', ...],
  createdAt: '2025-11-28',
  performance: {
    avgTokens: 1250,
    avgQuality: 4.2,
    imageSuggestionRate: 0.95
  }
}
```

### 3.3 Database Schema Extensions

#### 3.3.1 PromptTemplate Model (Enhanced)

```javascript
{
  name: String,
  description: String,
  type: Enum['role', 'context', 'instruction', 'structure', 'behavior'],
  content: String | Array, // Template content with variables
  variables: [{
    name: String,
    source: String, // 'context.lvl', 'outputFormat.name', etc.
    required: Boolean,
    defaultValue: String
  }],
  conditions: [{
    field: String,
    operator: String, // 'equals', 'exists', 'in', etc.
    value: Any
  }],
  priority: Number,
  version: String,
  isActive: Boolean,
  metadata: {
    author: String,
    createdAt: Date,
    updatedAt: Date,
    testResults: Object
  }
}
```

#### 3.3.2 OutputFormat Model (Enhanced)

```javascript
{
  name: String,
  description: String,
  requiresImageSuggestion: Boolean,
  requiresStructuredOutput: Boolean,
  outputStructure: {
    sections: [{
      name: String,
      required: Boolean,
      description: String,
      order: Number
    }]
  },
  behavioralRules: [{
    rule: String,
    condition: String
  }]
}
```

### 3.4 Implementation Phases

#### Phase 1: Refactoring (Current)
- ✅ Fix image suggestion integration
- ✅ Improve prompt structure clarity
- ✅ Separate format-specific behaviors

#### Phase 2: Modularization
- Extract prompt sections into functions
- Create template-like structure in code
- Add configuration-driven format behaviors

#### Phase 3: Database-Driven Templates
- Create PromptTemplate model
- Migrate hardcoded templates to database
- Build template selection engine

#### Phase 4: Advanced Features
- Prompt versioning system
- A/B testing framework
- Prompt analytics dashboard
- Template library UI

---

## 4. Immediate Improvements (Applied)

### 4.1 Image Suggestion Fix

**Before**:
```javascript
// Instruction in Output Format section
imageSuggestion = '...Format it as: ---\nImage Suggestion: [your description here]';

// But structure definition didn't include it
prompt += `Structure: ---\nEmotional Core Message...\n---\nSimplified Text...`;
```

**After**:
```javascript
// Flag the requirement
outputFormat.requiresImageSuggestion = true;

// Include in structure definition
structureParts.push('Image Suggestion: REQUIRED - Provide detailed description...');
```

**Key Insight**: Required output sections must be in the structure definition, not just mentioned in instructions.

### 4.2 Structure Definition Pattern

**Pattern**: Build structure dynamically based on format requirements

```javascript
let structureParts = [/* base sections */];

if (outputFormat?.requiresImageSuggestion) {
  structureParts.push(/* image section */);
}

prompt += `Structure: ${structureParts.map(p => `---\n${p}`).join('\n')}`;
```

---

## 5. Recommended Next Steps

### 5.1 Short Term (1-2 weeks)

1. **Extract Prompt Sections**
   - Create separate functions for each prompt section
   - Document each section's purpose and dependencies

2. **Add Format Configuration**
   - Extend OutputFormat model with `requiresImageSuggestion`, `outputStructure`
   - Move format-specific behaviors to database

3. **Improve Observability**
   - Log full prompts (sanitized) for debugging
   - Track which sections were included in each request

### 5.2 Medium Term (1-2 months)

1. **Template System**
   - Create PromptTemplate model
   - Build template engine
   - Migrate existing prompts to templates

2. **Testing Framework**
   - Unit tests for prompt building
   - Integration tests with OpenAI (mock responses)
   - Prompt quality metrics

### 5.3 Long Term (3+ months)

1. **Advanced Features**
   - Prompt versioning
   - A/B testing
   - Analytics dashboard
   - Template library UI for admins

---

## 6. Prompt Quality Metrics

### 6.1 Success Criteria

- **Completeness**: All required sections present in output
- **Compliance**: Output follows specified structure
- **Relevance**: Content matches context (LVL, place, audience)
- **Quality**: User satisfaction scores

### 6.2 Monitoring

- Track section presence in responses
- Measure token usage per section
- Monitor error rates
- Collect user feedback

---

## 7. Risk Mitigation

### 7.1 Prompt Injection Prevention

- Sanitize user inputs
- Validate template variables
- Use parameterized templates (not string interpolation)

### 7.2 Backward Compatibility

- Maintain fallback to hardcoded values
- Version templates
- Gradual migration path

### 7.3 Performance

- Cache compiled prompts
- Optimize template selection
- Monitor prompt length (token limits)

---

## 8. Conclusion

The current prompt system works but lacks scalability and maintainability. The proposed architecture provides:

- **Modularity**: Reusable, testable components
- **Flexibility**: Easy to add new formats and behaviors
- **Observability**: Better debugging and analytics
- **Quality**: Consistent, reliable outputs

**Recommended Approach**: Start with Phase 1 improvements (already applied), then gradually move toward the template-based system as needs evolve.

---

## Appendix A: Prompt Engineering Checklist

When creating or modifying prompts:

- [ ] Required sections are in structure definition
- [ ] Instructions are clear and unambiguous
- [ ] Format-specific behaviors are flagged and included
- [ ] Variables are properly resolved
- [ ] Conditions are correctly evaluated
- [ ] Output structure matches instructions
- [ ] Tested with various inputs
- [ ] Documented with examples

---

## Appendix B: Example Prompt Structure

```
ROLE: You are a marketing professional...

CONTEXT:
- Communication Level: [LVL style]
- Place: [Selected place if any]
- Target Audience: [Audience description]
- Geographic Context: [If provided]

INSTRUCTIONS:
- Output Format: [Format description]
- Behavioral Rules: [Format-specific rules]

OUTPUT STRUCTURE:
---
Emotional Core Message: [Description]
---
Problem Statement: [Description]
---
Concluding Message: [Description]
---
Simplified Text: [Description]
---
Image Suggestion: [If required - Description]
---

CONTENT:
[Text to simplify]
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-28  
**Author**: AI Assistant (Prompt Engineering Analysis)  
**Status**: Proposal for Review

