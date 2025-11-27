Features to add:

## HIGH PRIORITY (Showcase/Demo - "Wow" Factors)

- **Add a feature that given lvl, location and keywords, ask AI to look for all info related and creates the output from those, with or without text given**
  - This is a "research mode" - AI gathers context before simplifying
  - **Showcase value**: Demonstrates advanced AI capabilities, autonomous research, and intelligent context gathering
  - Implementation: New endpoint `/api/simplify/research` or optional flag in existing endpoint
  - Use OpenAI's web browsing capability or structured web search
  - UI: Toggle "Research Mode" in SimplifyText.vue with visual indicators of research progress
  - Consider: Rate limiting (more expensive), fact-checking, source attribution displayed in UI

- **Add AI to auto generate prompts feature because of customs keywords**
  - Meta-feature: Use AI to generate optimal prompts based on keywords
  - **Showcase value**: AI-optimizing-AI, demonstrates intelligent automation and meta-learning
  - Implementation: New endpoint `/api/prompts/generate` that takes keywords and generates prompt
  - UI: "AI Prompt Generator" section in SimplifyText.vue, show generated prompt with edit option
  - Consider: Show confidence score or explanation of why prompt was generated this way

- **User activity dashboard**
  - Analytics: requests per user/team/project, most used LVLs, popular keywords
  - **Showcase value**: Professional, data-driven, demonstrates platform maturity and insights
  - Charts and visualizations (interactive charts, trends over time)
  - Useful for SUPER_ADMIN to understand platform usage
  - UI: New `/admin/analytics` page with beautiful charts (Chart.js or similar)

- **Add customs prompts feature with AI enhancement**
  - Allow saving custom prompt templates (separate from override)
  - **Showcase value**: Flexibility, customization, shows platform adaptability
  - Create new model: `PromptTemplate` (name, description, prompt, createdBy, team/project scope)
  - CRUD endpoints for prompt templates
  - UI: Prompt template selector in SimplifyText.vue, template library view
  - Combine with AI prompt generation for "AI-assisted template creation"

- **Rework the LVLs system**: The actual LVLs are ok for semanthical value, but we need to add list of places for context value
  - Suggestion: Add a `places` array field to LVL model (e.g., ["Antwerpen", "Gent", "Brussel"] for LOCAL)
  - This aligns with existing `geoContext` in References and enhances geographic awareness
  - Consider: Should places be hierarchical? (e.g., Local → Municipalities, Provincial → Provinces)
  - **Showcase value**: Shows sophisticated context understanding and Belgian governance awareness

## MEDIUM PRIORITY (Important Enhancements)

- **Add checkbox to override the prompt with a custom prompt**
  - Restrict to SUPER_ADMIN and ADMIN roles only (governance concern)
  - Add `customPrompt` field to RequestLog for audit trail
  - UI: Advanced options toggle in SimplifyText.vue (only visible to authorized roles)
  - Consider: Should custom prompts be saved as templates for reuse?

- **Export functionality for history**
  - Export request logs to CSV/PDF for reporting
  - **Showcase value**: Shows enterprise readiness and institutional compliance
  - Filter by date range, team, project, user
  - Useful for institutional reporting and audits
  - UI: Export button in HistoryPage.vue with format selection

- **Search functionality**
  - Full-text search across request logs
  - Search references by keywords, title, content
  - Search dictionary entries
  - **Showcase value**: Professional feature, demonstrates platform completeness

## LOWER PRIORITY (Necessary but Less Exciting for Showcase)

- **Give the team leader the ability to add or remove team members to the team**
  - Currently only SUPER_ADMIN/ADMIN can manage members (backend restriction)
  - Implementation: Update `requireRoleOrHigher('ADMIN')` to allow TEAM_LEADER for their own teams
  - Add UI in TeamsProjects.vue for team leaders to manage members
  - **Note**: Important for functionality but not innovative for showcase

- **History management: ability to remove items in the history catalogue**
  - Add DELETE endpoint to `/api/request-logs/:id` with proper authorization
  - Consider: Soft delete vs hard delete? (soft delete recommended for audit trail)
  - Add delete button in HistoryPage.vue with confirmation modal
  - **Note**: Standard CRUD operation, necessary but not exciting

- **Bulk operations**
  - Bulk simplify multiple texts at once
  - Bulk import references (CSV upload)
  - Bulk assign team members to projects
  - **Note**: Useful for efficiency but not visually impressive

- **Reference versioning**
  - Track changes to references over time
  - Show which version was used in each request log
  - Important for audit trail when references are updated
  - **Note**: Important for production but not exciting for demo

- **Project templates**
  - Save project configurations as templates
  - Quick setup for similar projects (e.g., "Subsidies 2025" template)
  - **Note**: Nice UX improvement but not innovative

- **Notification system**
  - Email notifications for team invitations, project updates
  - In-app notifications for important events
  - **Note**: Standard feature, not innovative

- **Multi-language support (beyond Dutch)**
  - Currently focused on Dutch, but could expand to French/German for Belgian context
  - Language-specific LVL styles and terminology
  - **Note**: Could be interesting for Belgian context but not priority for showcase

## DEFERRED (Requires Intensive Refactoring)

- **Add image generation feature**
  - Use DALL-E or similar for generating images to accompany simplified text
  - **Showcase value**: Multi-modal AI, visually impressive, demonstrates modern AI capabilities
  - Currently system suggests image descriptions for Instagram format - extend to actual generation
  - Implementation: New endpoint `/api/generate-image` or extend simplify endpoint
  - UI: Show generated image alongside simplified text, download option, regeneration button
  - Consider: Cost implications, image storage, moderation
  - **Status**: Deferred - requires significant codebase refactoring for image storage, API integration, and UI updates
