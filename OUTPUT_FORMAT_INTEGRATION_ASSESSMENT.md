# Output Format Integration Assessment

**Date:** 2024-12-19  
**Issue:** Output formats (specifically "landing page") are not producing expected results  
**Status:** Critical Gap Identified

---

## Executive Summary

The prompt composition framework has a **critical gap**: the `outputStructure` field defined in the `OutputFormat` model is **completely ignored** during prompt building. The system always uses a hardcoded output structure regardless of the format selected, which prevents custom formats (like "landing page") from working as intended.

---

## Current Implementation Analysis

### 1. OutputFormat Model Structure

**Location:** `backend/models/OutputFormat.js`

The model supports:
- ✅ `name` - Used correctly
- ✅ `description` - Used in `buildOutputFormatSection()`
- ✅ `requiresImageSuggestion` - Used correctly
- ✅ `behavioralRules` - Used correctly
- ❌ **`outputStructure`** - **DEFINED BUT NEVER USED**
- ❌ `requiresStructuredOutput` - **DEFINED BUT NEVER USED**

### 2. Prompt Building Logic

**Location:** `backend/routes/simplify.js`

#### Function: `buildOutputStructureSection()` (Lines 298-323)

**Current Behavior:**
- Always generates the same hardcoded structure:
  1. Emotional Core Message
  2. Problem Statement
  3. Concluding Message
  4. Summary/Simplified Text
  5. Image Suggestion (if `requiresImageSuggestion` is true)

**Problem:**
- Does NOT check `outputFormat.outputStructure`
- Does NOT use custom sections defined in the database
- Ignores section order, descriptions, and requirements from the model

**Code Reference:**
```javascript
function buildOutputStructureSection(outputFormat, requiresImageSuggestion) {
  let structureParts = [
    'Emotional Core Message: Start with a strong, emotional core message about people.',
    'Problem Statement: Name the problem briefly and clearly.',
    'Concluding Message: Conclude with a clear, impactful message.',
    `${outputFormat?.name === 'Samenvatting' ? 'Summary' : 'Simplified Text'}: Provide the main simplified content.`
  ];
  // ... hardcoded logic continues
}
```

#### Function: `buildOutputFormatSection()` (Lines 129-200)

**Current Behavior:**
- Uses `outputFormat.description` ✅
- Uses `outputFormat.requiresImageSuggestion` ✅
- Uses `outputFormat.behavioralRules` ✅
- **Does NOT use `outputFormat.outputStructure`** ❌

**Fallback Logic:**
- If `description` is missing, falls back to hardcoded switch statement based on format name
- Only handles 4 formats: Samenvatting, Instagram, LinkedIn, Opsommingstekens
- No handling for new formats like "landing page"

### 3. Template Context Preparation

**Location:** `backend/routes/simplify.js` - `prepareTemplateContext()` (Lines 418-566)

**Current Behavior:**
- Prepares `structureParts` as a hardcoded array (lines 519-528)
- Does NOT read from `outputFormat.outputStructure`
- Only conditionally adds Image Suggestion based on `requiresImageSuggestion`

---

## Root Cause Analysis

### Primary Issue: Missing Integration

The `outputStructure` field exists in the database model and can be set via the API (`/api/config/output-formats`), but the prompt building logic **never reads or uses this field**.

### Secondary Issues

1. **Hardcoded Structure Logic**
   - The output structure is hardcoded in multiple places
   - No dynamic structure building based on format configuration
   - New formats cannot define custom structures

2. **Incomplete Format Handling**
   - `buildOutputFormatSection()` has a hardcoded switch statement
   - Only 4 formats are explicitly handled
   - New formats fall back to generic description or empty instructions

3. **Template System Gap**
   - System prompt templates can be used (if `USE_PROMPT_TEMPLATES=true`)
   - But even templates don't use `outputStructure` from the format
   - Templates would need to be manually updated for each new format

4. **No Validation**
   - No validation that `outputStructure` sections are properly formatted
   - No check that required sections are present
   - No warning when `outputStructure` is defined but ignored

---

## Impact Assessment

### For "Landing Page" Format

When a user creates a "landing page" output format with:
- Custom `description`: "Create a landing page structure with hero, features, CTA sections"
- Custom `outputStructure` with sections like:
  - Hero Section
  - Features Section
  - Call-to-Action Section
  - Contact Information

**What Actually Happens:**
1. ✅ The `description` is included in the prompt
2. ❌ The custom `outputStructure` is **completely ignored**
3. ❌ The AI receives the standard 4-section structure instead
4. ❌ The output doesn't match the intended landing page format

**Result:** The AI tries to create a landing page based only on the description, but is constrained by the hardcoded structure instructions, leading to mismatched output.

---

## Code Locations Requiring Changes

### 1. `buildOutputStructureSection()` Function
**File:** `backend/routes/simplify.js`  
**Lines:** 298-323  
**Action Required:** Refactor to read from `outputFormat.outputStructure` if available

### 2. `prepareTemplateContext()` Function
**File:** `backend/routes/simplify.js`  
**Lines:** 418-566 (specifically 519-528)  
**Action Required:** Use `outputFormat.outputStructure` to build `structureParts`

### 3. Template Context Building
**File:** `backend/routes/simplify.js`  
**Lines:** 592-606  
**Action Required:** Ensure `outputStructure` is passed to template context

### 4. System Prompt Templates (if used)
**Files:** `backend/utils/promptTemplateEngine.js`, template definitions  
**Action Required:** Ensure templates can access and use `outputStructure` from context

---

## Recommended Solution Approach

### Phase 1: Core Integration (High Priority)

1. **Refactor `buildOutputStructureSection()`**
   - Check if `outputFormat.outputStructure.sections` exists
   - If yes, use it to build the structure dynamically
   - If no, fall back to current hardcoded structure
   - Respect section `order`, `required`, and `description` fields

2. **Update `prepareTemplateContext()`**
   - Build `structureParts` from `outputFormat.outputStructure` if available
   - Maintain backward compatibility with formats that don't have `outputStructure`

3. **Add Validation**
   - Validate `outputStructure` format when saving output formats
   - Log warnings when `outputStructure` is defined but sections are empty

### Phase 2: Enhanced Features (Medium Priority)

1. **Dynamic Section Rendering**
   - Support conditional sections based on format requirements
   - Allow sections to have dependencies (e.g., "Image Suggestion" only if `requiresImageSuggestion`)

2. **Template Integration**
   - Update system prompt templates to use `outputStructure` from context
   - Create template variables for dynamic structure building

3. **Format-Specific Instructions**
   - Allow each section in `outputStructure` to have detailed instructions
   - Support section-level behavioral rules

### Phase 3: Testing & Validation (Ongoing)

1. **Test Existing Formats**
   - Verify all 4 existing formats still work correctly
   - Ensure backward compatibility is maintained

2. **Test New Formats**
   - Create test cases for "landing page" format
   - Verify custom structures produce expected output
   - Test edge cases (empty structures, missing sections, etc.)

---

## Backward Compatibility Considerations

### Current Formats (Must Continue Working)

1. **Samenvatting** - No `outputStructure` defined, should use hardcoded fallback
2. **Korte versie (Instagram-achtig)** - Has `requiresImageSuggestion`, should continue working
3. **Medium versie (LinkedIn-achtig)** - Should continue working
4. **Opsommingstekens** - Has `behavioralRules` for lists, should continue working

### Migration Strategy

- Formats without `outputStructure` → Use hardcoded structure (current behavior)
- Formats with `outputStructure` → Use custom structure (new behavior)
- No database migration needed (field already exists, just unused)

---

## Testing Checklist

After implementation, verify:

- [ ] Existing formats (Samenvatting, Instagram, LinkedIn, Opsommingstekens) still work
- [ ] "Landing page" format with custom `outputStructure` produces correct structure
- [ ] Formats without `outputStructure` fall back to hardcoded structure
- [ ] Section ordering is respected
- [ ] Required sections are enforced
- [ ] Image suggestion still works when `requiresImageSuggestion` is true
- [ ] Behavioral rules still apply correctly
- [ ] Template system (if enabled) uses `outputStructure`
- [ ] API endpoints accept and validate `outputStructure`

---

## Estimated Impact

### Development Effort
- **Phase 1:** 4-6 hours (core integration)
- **Phase 2:** 8-12 hours (enhanced features)
- **Phase 3:** 4-6 hours (testing and validation)
- **Total:** 16-24 hours

### Risk Level
- **Low-Medium:** Changes are isolated to prompt building logic
- **Backward Compatible:** Existing formats continue working
- **No Database Changes:** Field already exists

### Priority
- **High:** Blocks custom format functionality
- **User Impact:** Prevents users from creating effective custom formats

---

## Conclusion

The prompt composition framework has a **critical gap** where the `outputStructure` field is defined in the model but never used in the prompt building logic. This prevents custom output formats (like "landing page") from working as intended.

**Recommended Action:** Implement Phase 1 (Core Integration) to fix the immediate issue, then proceed with Phase 2 for enhanced functionality.

---

## Next Steps

1. Review this assessment
2. Decide on implementation approach (Phase 1 only, or full solution)
3. Implement changes
4. Test with "landing page" format
5. Verify backward compatibility
6. Deploy and monitor

