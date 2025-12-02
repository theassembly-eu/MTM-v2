# Output Format UI Audit

**Date:** 2024-12-19  
**Status:** ⚠️ Missing Critical Features

---

## Current State

### ✅ What Works

1. **Basic CRUD Operations**
   - Create/Edit/Delete output formats ✅
   - Name and description fields ✅
   - `requiresImageSuggestion` checkbox ✅
   - `requiresStructuredOutput` checkbox ✅

2. **Display**
   - Formats are listed in ConfigList ✅
   - Basic format info is shown ✅

### ❌ What's Missing

1. **Output Structure Management**
   - ❌ No UI to add/edit/delete sections
   - ❌ No UI to set section order
   - ❌ No UI to set section descriptions
   - ❌ No UI to mark sections as required/optional
   - ❌ No visual representation of the structure

2. **Behavioral Rules Management**
   - ❌ No UI to add/edit/delete behavioral rules
   - ❌ No UI to set rule conditions

3. **Form Data Handling**
   - ❌ `outputStructure` is not included in `itemForm`
   - ❌ `behavioralRules` is not included in `itemForm`
   - ❌ Data is fetched but not used in form

4. **Display Enhancement**
   - ❌ ConfigList doesn't show outputStructure info
   - ❌ No preview of structure sections
   - ❌ No indication if format has custom structure

---

## Required Changes

### 1. Update Configuration.vue

**Add to itemForm:**
- `outputStructure: { sections: [] }`
- `behavioralRules: []`

**Add UI Components:**
- Section manager (add/edit/delete/reorder sections)
- Behavioral rules manager
- Structure preview

### 2. Create OutputStructureEditor Component

**Features:**
- Add new section
- Edit section (name, description, order, required)
- Delete section
- Reorder sections (drag & drop or up/down buttons)
- Visual preview of structure
- Validation

### 3. Update ConfigList.vue

**Enhancements:**
- Show if format has custom outputStructure
- Show number of sections
- Show if image suggestion is required
- Show behavioral rules count

### 4. Form Validation

**Add:**
- Validate section names are not empty
- Validate order is numeric
- Show helpful error messages

---

## Implementation Plan

### Phase 1: Core Structure Editor
1. Create OutputStructureEditor component
2. Add to Configuration.vue modal
3. Update itemForm to include outputStructure
4. Update saveItem to send outputStructure

### Phase 2: Enhanced Features
1. Add drag & drop reordering
2. Add structure preview
3. Add behavioral rules editor
4. Enhance ConfigList display

### Phase 3: Polish
1. Add validation messages
2. Add help text/tooltips
3. Add structure templates/examples

---

## Files to Modify

1. `frontend/src/components/admin/Configuration.vue`
   - Add outputStructure to itemForm
   - Add OutputStructureEditor component
   - Update saveItem function

2. `frontend/src/components/admin/ConfigList.vue`
   - Enhance display for formats
   - Show structure info

3. **NEW:** `frontend/src/components/admin/OutputStructureEditor.vue`
   - Complete structure management UI

4. **NEW:** `frontend/src/components/admin/BehavioralRulesEditor.vue` (optional)
   - Behavioral rules management UI

