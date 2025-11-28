# SimplifyText Page Reorganization Proposal

## Current Issues
- Long vertical form with all features visible
- No clear visual hierarchy
- Core task (text input) is buried in the middle
- Advanced features mixed with basic settings
- Hard to focus on the main task

## Proposed Structure

### Option 1: Two-Column Layout with Collapsible Sections (Recommended)

**Left Column (Main Focus):**
1. **Text Input** (prominent, large)
   - Textarea for input text
   - Character count
   - Submit button (always visible)

2. **Essential Settings** (compact grid)
   - Team | Project
   - LVL | Place (if available)
   - Target Audience | Output Format | Language

**Right Column (Context & Options):**
3. **Context & Enrichment** (collapsible card)
   - Geographic Context
   - Keywords (include/avoid)
   - References

4. **Advanced Features** (collapsible card)
   - Research Mode toggle
   - Prompt Templates
   - AI Prompt Generator

### Option 2: Tabbed Interface

**Tab 1: Vereenvoudigen** (default)
- Text input (prominent)
- Essential settings (Team, Project, LVL, Target Audience, Output Format, Language)
- Submit button

**Tab 2: Context & Verrijking**
- Place selection
- Geographic context
- Keywords
- References

**Tab 3: Geavanceerd**
- Research Mode
- Prompt Templates
- AI Prompt Generator

### Option 3: Accordion/Collapsible Sections (Recommended for MVP)

**Section 1: Tekst Vereenvoudigen** (always expanded)
- Text input (large, prominent)
- Essential settings in compact grid
- Submit button

**Section 2: Context & Verrijking** (collapsed by default)
- Place, Geographic context
- Keywords, References

**Section 3: Geavanceerde Opties** (collapsed by default)
- Research Mode
- Prompt Templates
- AI Prompt Generator

## Recommendation: Option 3 (Accordion)

**Benefits:**
- Keeps main task visible and prominent
- Progressive disclosure (show advanced when needed)
- Maintains single-page flow
- Easy to implement
- Mobile-friendly

**Visual Hierarchy:**
1. Text input = 60% of visual weight
2. Essential settings = 30% (compact)
3. Advanced features = 10% (collapsed, expandable)

