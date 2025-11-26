# MTM 2.0 Implementation Strategy

## Project Context
- **Client**: Vooruit (Belgian political party)
- **Country**: Belgium
- **Purpose**: Governance-driven text simplification platform for Belgian public institutions

## LVL Structure (Belgian Government Levels)
1. **LOCAL** - Gemeentelijk niveau
2. **PROVINCIAL** - Provinciaal niveau
3. **REGIONAL** - Gewestelijk niveau (Vlaams Gewest, Brussels Gewest, Waals Gewest)
4. **COMMUNITY** - Gemeenschapsniveau (Vlaamse Gemeenschap, Franse Gemeenschap, Duitstalige Gemeenschap)
5. **FEDERAL** - Federaal niveau

## Implementation Approach

### Phase 1: Data Models & Database Setup
**Goal**: Create all MongoDB models and seed initial data

#### New Models to Create:
1. **LVL Model** - Communication levels (seed with 5 Belgian levels)
2. **User Model** - With roles and team membership
3. **Team Model** - Organizations/units
4. **Project Model** - Communication domains
5. **Reference Model** - Contextual materials
6. **RequestLog Model** - Full request logging

#### Existing Models to Keep:
- DictionaryEntry (make project-specific, not global)
- SavedResult (may be replaced/supplemented by RequestLog)

#### Models to Add for v1.0.2 Features:
- TargetAudience model (Algemeen, Jongeren, Ouderen) - SUPER_ADMIN CRUD
- OutputFormat model (Samenvatting, Instagram, LinkedIn, etc.) - SUPER_ADMIN CRUD
- Language model (Dutch, English, French) - SUPER_ADMIN CRUD

#### Tasks:
- [ ] Create LVL model and seed with 5 Belgian levels
- [ ] Create User model with JWT support
- [ ] Create Team model
- [ ] Create Project model
- [ ] Create Reference model
- [ ] Create RequestLog model
- [ ] Set up relationships between models
- [ ] **Data Relationship Strategy**: Use Team.members[] as source of truth, query Users by team (avoid bidirectional sync issues)
- [ ] **Database Indexes**: Add indexes on:
  - User.email (unique)
  - Team.name (unique)
  - Project.team, Project.lvls
  - Reference.project
  - RequestLog.user, RequestLog.project, RequestLog.createdAt
- [ ] **Cascade Rules**: Define deletion behavior:
  - Prevent Team deletion if Projects exist
  - Prevent Project deletion if References exist
  - Soft delete option (deletedAt field) for audit trail
- [ ] **Seed Script**: Create script to seed:
  - [ ] 5 LVLs (LOCAL, PROVINCIAL, REGIONAL, COMMUNITY, FEDERAL)
  - [ ] Initial SUPER_ADMIN user
  - [ ] Default TargetAudiences (Algemeen, Jongeren, Ouderen)
  - [ ] Default OutputFormats (Samenvatting, Instagram, LinkedIn, Opsommingstekens)
  - [ ] Default Languages (Dutch, English, French)

---

### Phase 2: Authentication System
**Goal**: JWT-based authentication with role middleware

#### Tasks:
- [ ] Create JWT utilities (sign, verify)
- [ ] Create password hashing (bcrypt)
- [ ] POST /api/auth/login endpoint
- [ ] Authentication middleware (verify JWT, attach req.user)
- [ ] Role-based middleware (requireRole, requireTeamMembership)
- [ ] Password validation utilities
- [ ] **Security Note**: Use localStorage for MVP (document httpOnly cookies for production)
- [ ] **Initial User**: Seed script creates first SUPER_ADMIN
- [ ] **User Management**: POST /api/users (SUPER_ADMIN/ADMIN can create users)
- [ ] GET /api/users (filtered by role/permissions)
- [ ] PUT /api/users/:id (update user)
- [ ] DELETE /api/users/:id (SUPER_ADMIN only)

---

### Phase 3: API Endpoints
**Goal**: Build all CRUD endpoints with proper permissions

#### 3.1 LVL Endpoints
- [ ] GET /api/lvls (authenticated users, with pagination)
- [ ] POST /api/lvls (SUPER_ADMIN only)
- [ ] **Pagination**: Default limit 50, optional page/limit query params

#### 3.2 Team Endpoints
- [ ] GET /api/teams (filtered by user role, with pagination)
- [ ] POST /api/teams (SUPER_ADMIN/ADMIN)
- [ ] PUT /api/teams/:id (SUPER_ADMIN/ADMIN)
  - [ ] **Validation**: Prevent LVL changes if projects depend on removed LVLs
- [ ] DELETE /api/teams/:id (SUPER_ADMIN)
  - [ ] **Validation**: Prevent deletion if projects exist (return error with project count)
- [ ] POST /api/teams/:id/members (add member)
- [ ] DELETE /api/teams/:id/members/:userId (remove member)

#### 3.3 Project Endpoints
- [ ] GET /api/projects?teamId=... (filtered by permissions, with pagination)
- [ ] POST /api/projects (validate LVLs ⊆ team LVLs)
  - [ ] **Validation**: Use Zod schema to validate LVL subset
- [ ] PUT /api/projects/:id
  - [ ] **Validation**: Ensure updated LVLs still ⊆ team LVLs
- [ ] DELETE /api/projects/:id
  - [ ] **Validation**: Prevent deletion if references exist (or cascade delete references)

#### 3.4 Reference Endpoints
- [ ] GET /api/projects/:projectId/references (with pagination)
- [ ] POST /api/projects/:projectId/references
  - [ ] **URL Type**: Fetch URL content and generate automatic summary (use OpenAI or web scraping)
  - [ ] **KEYWORDS Type**: Manual entry
  - [ ] **FILE Type**: Disabled for MVP
- [ ] PUT /api/references/:id
- [ ] DELETE /api/references/:id
- [ ] **URL Fetching & Summarization**:
  - [ ] Use library (e.g., cheerio, jsdom, or puppeteer) to fetch URL content
  - [ ] Extract main text content (remove HTML, scripts, etc.)
  - [ ] Use OpenAI to generate summary of fetched content
  - [ ] Store summary in reference.summary field
  - [ ] Handle errors (invalid URLs, timeouts, CORS issues, etc.)
  - [ ] Show loading state during fetch/summarization
  - [ ] Allow manual override if automatic summary fails

#### 3.6 User Management Endpoints
- [ ] GET /api/users (filtered by role: SUPER_ADMIN sees all, ADMIN sees their teams' users)
- [ ] POST /api/users (SUPER_ADMIN/ADMIN can create users)
- [ ] PUT /api/users/:id (SUPER_ADMIN/ADMIN, with permission checks)
- [ ] DELETE /api/users/:id (SUPER_ADMIN only)

#### 3.7 Configuration Endpoints (v1.0.2 Features)
- [ ] GET /api/target-audiences (all authenticated users)
- [ ] POST /api/target-audiences (SUPER_ADMIN only)
- [ ] PUT /api/target-audiences/:id (SUPER_ADMIN only)
- [ ] DELETE /api/target-audiences/:id (SUPER_ADMIN only)
- [ ] Same CRUD for /api/output-formats and /api/languages

#### 3.5 Upgraded Simplification Endpoint
- [ ] Refactor POST /api/simplify
- [ ] Add context validation (team, project, LVL)
- [ ] **Rate Limiting**: Add express-rate-limit middleware (e.g., 20 requests per user per hour)
- [ ] Build enriched prompt (LVL style + references + keywords + geo)
  - [ ] **Token Management**: Count tokens, truncate if >8000 tokens (leave room for response)
  - [ ] **Truncation Strategy**: Limit reference summaries, prioritize selected references
- [ ] Call existing OpenAI logic with enriched prompt
  - [ ] **Error Handling**: Try-catch with fallback to base prompt if enriched fails
  - [ ] **Retry Logic**: Retry once on transient OpenAI errors
- [ ] Log to RequestLog
- [ ] Return result with metadata
- [ ] **Request Logging**: Include token usage (promptTokens, completionTokens) in modelMeta

---

### Phase 4: Frontend - Authentication
**Goal**: Login system and route protection

#### Tasks:
- [ ] Create Login.vue component
- [ ] JWT storage (localStorage for MVP)
- [ ] Auth guard for Vue Router (redirect to login if not authenticated)
- [ ] User context/store (Vue 3 composable with reactive refs)
- [ ] Logout functionality
- [ ] **Error Handling**: Display login errors (invalid credentials, network errors)
- [ ] **Loading State**: Show loading spinner during login
- [ ] **Route Structure**:
  - [ ] `/login` - Login page
  - [ ] `/simplify` - Main simplify page (all authenticated users)
  - [ ] `/admin/teams` - Teams management (SUPER_ADMIN/ADMIN)
  - [ ] `/admin/projects` - Projects management (TEAM_LEADER+)
  - [ ] `/admin/references` - References management (TEAM_LEADER+)
  - [ ] `/admin/users` - User management (SUPER_ADMIN/ADMIN)
  - [ ] `/admin/config` - Configuration (TargetAudiences, OutputFormats, Languages) (SUPER_ADMIN)
  - [ ] `/history` - Request logs (role-based filtering)
- [ ] **Role-based Navigation**: Show/hide menu items based on user role

---

### Phase 5: Frontend - Main Simplify Page
**Goal**: Context-aware simplification form

#### Tasks:
- [ ] Create SimplifyText.vue component
- [ ] Team dropdown (filtered by user's teams)
- [ ] Project dropdown (filtered by selected team, disabled until team selected)
- [ ] LVL dropdown (filtered by project's LVLs, disabled until project selected)
- [ ] Text input area (with character count)
- [ ] Optional context fields:
  - [ ] Geo context input (text field)
  - [ ] Include keywords (chip/tag input with add/remove)
  - [ ] Avoid keywords (chip/tag input with add/remove)
  - [ ] References multi-select (checkboxes or multi-select dropdown)
- [ ] **Loading States**: 
  - [ ] Disable "Simplify" button during request
  - [ ] Show loading spinner/progress indicator
  - [ ] Display "Processing..." message
- [ ] **Error Handling**: 
  - [ ] Display API errors (network, validation, rate limit)
  - [ ] Show user-friendly error messages
- [ ] Result display with context summary
- [ ] Integration with POST /api/simplify
- [ ] **Request Prevention**: Debounce or disable button to prevent duplicate requests

---

### Phase 6: Frontend - Admin Views
**Goal**: Minimal admin UI for structure demonstration

#### Tasks:
- [ ] Teams & Projects view (`/admin/teams`, `/admin/projects`)
  - [ ] List teams (role-based)
  - [ ] Show projects per team
  - [ ] Create/edit project form
- [ ] References view (`/admin/references`)
  - [ ] List references for selected project
  - [ ] Add URL reference form (with automatic fetch & summary)
  - [ ] Add Keywords reference form
- [ ] User Management view (`/admin/users`) - SUPER_ADMIN/ADMIN only
  - [ ] List users (filtered by permissions)
  - [ ] Create user form
  - [ ] Edit user form
  - [ ] Assign users to teams
- [ ] Configuration view (`/admin/config`) - SUPER_ADMIN only
  - [ ] Manage Target Audiences (CRUD)
  - [ ] Manage Output Formats (CRUD)
  - [ ] Manage Languages (CRUD)
- [ ] Dictionary Management (per project)
  - [ ] List dictionary entries for selected project
  - [ ] Add/edit/delete dictionary entries

---

### Phase 7: Prompt Engineering
**Goal**: Enrich existing prompt with all context

#### Prompt Structure:
```
Base prompt (from v1.0.2) +
LVL context (institutional level, appropriate vocabulary) +
Target Audience (user-selected: Algemeen/Jongeren/Ouderen) +
Output Format (user-selected: Samenvatting/Instagram/LinkedIn/etc.) +
Language (user-selected: Dutch/English/French) +
Project-specific dictionary +
Geographic context +
Include keywords (must use) +
Avoid keywords (must avoid) +
Reference summaries (contextual knowledge) +
Project name (for consistency)
```

#### Tasks:
- [ ] Create prompt builder function
- [ ] **LVL Context**: LVL provides context (who the text is for), but style is chosen by user
  - [ ] LVL helps determine appropriate vocabulary and institutional alignment
  - [ ] User selects: targetAudience, outputFormat, language (from v1.0.2 features)
  - [ ] LVL + user selections = complete style context
- [ ] Integrate reference summaries (truncate if too long)
- [ ] Add keyword instructions (include/avoid)
- [ ] Add geographic context to prompt
- [ ] **Token Counting**: 
  - [ ] Count tokens before sending (use tiktoken or estimate)
  - [ ] Truncate if >8000 tokens (leave room for response)
  - [ ] Prioritize: LVL context + user selections > project dictionary > selected references > keywords > geo context
- [ ] **Fallback Strategy**: If enriched prompt fails, fall back to base prompt
- [ ] Test prompt quality with various contexts

---

## Dependencies to Add

### Backend Dependencies
- [ ] **bcrypt** - Password hashing
- [ ] **jsonwebtoken** - Already in package.json ✓
- [ ] **zod** - Already in package.json ✓
- [ ] **express-rate-limit** - Rate limiting middleware
- [ ] **cheerio** or **jsdom** - HTML parsing for URL content extraction
- [ ] **axios** or **node-fetch** - HTTP client for fetching URLs
- [ ] **tiktoken** (optional) - Token counting for OpenAI

### Frontend Dependencies
- [ ] **axios** - Already in frontend/package.json ✓
- [ ] **vue-router** - Already in frontend/package.json ✓

---

## Technical Decisions

### Authentication
- **Library**: jsonwebtoken for JWT
- **Password**: bcrypt for hashing
- **Storage**: localStorage for JWT (MVP)
- **JWT Secret**: Use existing JWT_SECRET from EvenNode environment variables

### Permissions
- Middleware-based checks
- Role hierarchy: SUPER_ADMIN > ADMIN > TEAM_LEADER > TEAM_MEMBER
- Team membership validation

### Data Validation
- **Zod Schemas**: Create validation schemas for all API endpoints
- Validate LVL subsets (project LVLs ⊆ team LVLs)
- Validate team membership before operations
- Email format validation
- Required field validation

### Error Handling
- **Centralized Error Middleware**: Create error handler middleware
- Consistent error response format: `{ error: string, code?: string, details?: any }`
- Permission denied messages (403)
- Validation error details (400)
- OpenAI API error handling with user-friendly messages
- Database error handling (connection issues, validation errors)

### Rate Limiting
- **express-rate-limit** on /api/simplify
- Per-user limits (e.g., 20 requests/hour)
- Optional: Per-team limits for cost control
- Return 429 status with retry-after header

### Pagination Strategy
- Default page size: 20 items
- Query params: `?page=1&limit=20`
- Response format: `{ data: [], pagination: { page, limit, total, totalPages } }`
- Apply to: GET /api/teams, /api/projects, /api/references, /api/request-logs

---

## Development Order

1. **Backend First**
   - Data models → Auth → API endpoints → Prompt engineering

2. **Frontend Second**
   - Auth → Simplify page → Admin views

3. **Integration**
   - Connect frontend to new APIs
   - Test full flow
   - Polish UX

---

## MVP Success Criteria

✅ Users can log in with roles
✅ Users can navigate Teams → Projects → LVLs
✅ Users can run simplifications with full context
✅ AI uses LVL context, user-selected style (targetAudience/outputFormat/language), references, keywords
✅ All requests are logged with full context
✅ Admins can manage teams, projects, references
✅ System demonstrates governance structure

---

## Additional Implementation Tasks

### Seed Script & Initial Setup
- [ ] Create `backend/scripts/seed.js`:
  - [ ] Seed 5 LVLs (LOCAL, PROVINCIAL, REGIONAL, COMMUNITY, FEDERAL)
  - [ ] Seed default TargetAudiences (Algemeen, Jongeren, Ouderen)
  - [ ] Seed default OutputFormats (Samenvatting, Korte versie (Instagram-achtig), Medium versie (LinkedIn-achtig), Opsommingstekens)
  - [ ] Seed default Languages (Dutch, English, French)
  - [ ] Create initial SUPER_ADMIN user (password from env or prompt)
  - [ ] Add instructions for running seed script
- [ ] Document environment variables needed:
  - [ ] JWT_SECRET (already in EvenNode)
  - [ ] OPENAI_API_KEY (already in EvenNode)
  - [ ] MONGODB_URI (or APP_CONFIG + MONGO_PASSWORD) (already in EvenNode)
  - [ ] SEED_ADMIN_EMAIL (for seed script)
  - [ ] SEED_ADMIN_PASSWORD (for seed script)

### RequestLog Endpoints
- [ ] GET /api/request-logs (with pagination, filters by user/team/project)
  - [ ] SUPER_ADMIN: See all logs
  - [ ] ADMIN: See logs for their teams
  - [ ] TEAM_LEADER: See logs for their team's projects
  - [ ] TEAM_MEMBER: See their own logs + project logs they belong to
- [ ] GET /api/request-logs/:id (view single log with full context)

### Dictionary Integration (v1.0.2)
- [ ] Update DictionaryEntry model to include project field (project-specific)
- [ ] Update dictionary endpoints to filter by project
- [ ] GET /api/projects/:projectId/dictionary
- [ ] POST /api/projects/:projectId/dictionary
- [ ] PUT /api/dictionary/:id
- [ ] DELETE /api/dictionary/:id
- [ ] Integrate project-specific dictionary into prompt

---

## Next Steps

1. **Phase 1**: Create all MongoDB models with indexes and relationships
2. **Seed Script**: Create seed script for LVLs and initial SUPER_ADMIN
3. **Phase 2**: Set up authentication with JWT
4. **Phase 3**: Build API endpoints with validation, pagination, rate limiting
5. **Phase 4**: Create frontend authentication
6. **Phase 5**: Build main simplify page with loading/error states
7. **Phase 6**: Create minimal admin views
8. **Phase 7**: Implement prompt engineering with token management
9. **Testing**: Test full flow, error scenarios, edge cases
10. **Documentation**: Document API, setup instructions, known limitations

---

## MVP Limitations & Future Enhancements

### Known MVP Limitations:
- ✅ No password reset (manual admin reset)
- ✅ localStorage for JWT (document httpOnly cookies for production)
- ✅ No FILE reference type (URL and KEYWORDS only)
- ✅ No user signup (admin-created users only)
- ✅ Basic pagination (no cursor-based)
- ✅ Simple rate limiting (per-user, not per-team)

### Future Enhancements (Post-MVP):
- Password reset flow
- httpOnly cookie-based auth
- FILE reference upload and parsing
- Advanced analytics dashboard
- RequestLog archival strategy
- Team-based rate limiting
- Dictionary per-project
- Bulk operations
- Email notifications

Ready to begin implementation!

