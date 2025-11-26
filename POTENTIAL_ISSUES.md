# Potential Issues & Considerations for MTM 2.0

## 🔴 Critical Issues

### 1. Data Model Relationships & Consistency
**Problem**: Bidirectional relationships need synchronization
- User has `teams[]` array
- Team has `members[]` array
- **Risk**: Data can become inconsistent if one side is updated without the other
- **Solution**: 
  - Use Mongoose middleware (pre/post hooks) to keep in sync
  - OR use only one side (Team.members) and query Users by team
  - OR use virtual populate instead of storing arrays

### 2. Cascade Deletion & Data Integrity
**Problem**: What happens when deleting teams/projects/users?
- If Team deleted → Projects become orphaned?
- If Project deleted → References become orphaned?
- If User removed from team → Can they still access their RequestLogs?
- **Solution**: 
  - Define cascade rules (delete projects when team deleted? prevent deletion if projects exist?)
  - Add `deletedAt` soft delete instead of hard delete
  - Or prevent deletion if dependencies exist

### 3. Token Limits & Prompt Size
**Problem**: Enriched prompts could exceed OpenAI token limits
- Multiple references with summaries
- Long keyword lists
- Full context could be 10k+ tokens
- **Solution**:
  - Truncate reference summaries if too long
  - Limit number of references included
  - Use token counting before sending
  - Fallback to base prompt if too large

### 4. RequestLog Growth
**Problem**: RequestLog will grow indefinitely
- Every simplification = 1 log entry
- Could be thousands per day
- **Solution**:
  - Add pagination to log queries
  - Consider archival strategy (move old logs to separate collection)
  - Add indexes on frequently queried fields (user, project, createdAt)

---

## 🟡 Important Considerations

### 5. User Creation & Onboarding
**Problem**: How are users initially created?
- No signup endpoint mentioned
- MVP needs at least one SUPER_ADMIN to bootstrap
- **Solution**: 
  - Create seed script for initial SUPER_ADMIN
  - Or manual MongoDB insert for MVP
  - Add user creation endpoint (SUPER_ADMIN only)

### 6. JWT Security (localStorage)
**Problem**: localStorage is vulnerable to XSS attacks
- JWT in localStorage can be stolen by malicious scripts
- **Solution for MVP**: Acceptable for MVP, but document that production should use httpOnly cookies
- **Future**: Implement httpOnly cookie-based auth

### 7. Password Management
**Problem**: No password reset functionality
- Users locked out if they forget password
- **Solution for MVP**: Manual admin reset (acceptable for MVP)
- **Future**: Add password reset flow

### 8. API Performance & Pagination
**Problem**: No pagination mentioned for list endpoints
- GET /api/teams, /api/projects, /api/references could return huge lists
- **Solution**: 
  - Add pagination (limit/offset or cursor-based)
  - Default page size (e.g., 20 items)
  - Add search/filter capabilities

### 9. Rate Limiting & Cost Control
**Problem**: No rate limiting on /api/simplify
- OpenAI API costs money per request
- Could be abused or cause unexpected costs
- **Solution**: 
  - Add rate limiting middleware (e.g., express-rate-limit)
  - Per-user or per-team limits
  - Monitor OpenAI usage

### 10. Error Handling & User Feedback
**Problem**: No comprehensive error handling strategy
- What if OpenAI API fails?
- What if MongoDB connection drops mid-request?
- **Solution**:
  - Try-catch around OpenAI calls with fallback
  - Retry logic for transient failures
  - User-friendly error messages
  - Log errors for debugging

---

## 🟢 Nice-to-Have Improvements

### 11. Database Indexing
**Problem**: No indexing strategy mentioned
- Queries could be slow with large datasets
- **Solution**: Add indexes on:
  - User.email (unique)
  - Team.name (unique)
  - Project.team
  - RequestLog.user, RequestLog.project, RequestLog.createdAt
  - Reference.project

### 12. Validation & Data Quality
**Problem**: Need robust input validation
- Email format validation
- LVL subset validation (project LVLs ⊆ team LVLs)
- **Solution**: 
  - Use Zod for request validation
  - Mongoose schema validation
  - Custom validators for business rules

### 13. Frontend State Management
**Problem**: No clear state management strategy
- User data, teams, projects need to be shared across components
- **Solution**: 
  - Vue 3 Composition API with composables
  - OR Pinia/Vuex for complex state
  - OR simple reactive refs for MVP

### 14. Loading States & UX
**Problem**: No mention of loading indicators
- Simplification can take 5-10 seconds
- Users need feedback
- **Solution**: 
  - Loading spinners
  - Progress indicators
  - Disable buttons during requests

### 15. Reference Type: FILE
**Problem**: FILE type mentioned but not fully implemented
- Could confuse users if they see FILE option but can't upload
- **Solution for MVP**: 
  - Hide FILE type option
  - OR show but disable with "Coming soon" message
  - Document that FILE support is future feature

### 16. Dictionary Integration
**Problem**: Dictionary exists but unclear how it fits in v2.0
- Is it global? Per-project? Per-team?
- **Solution**: 
  - Decide: Global dictionary or project-specific?
  - For MVP: Keep global, add to prompt like v1.0.2
  - Future: Could be project-specific

### 17. LVL Style Definitions
**Problem**: Need to define what each LVL style means
- What's the difference between LOCAL and FEDERAL tone?
- **Solution**: 
  - Create style guide mapping (LOCAL → informal, FEDERAL → formal, etc.)
  - Store in LVL model or separate config
  - Use in prompt builder

### 18. Geographic Context Usage
**Problem**: How is geoContext used in prompt?
- Just mentioned as string, but how does it affect output?
- **Solution**: 
  - Define how to incorporate (e.g., "This text is for [geoContext], use local terminology")
  - Add to prompt builder

### 19. Team LVL Updates
**Problem**: What if team's LVLs change?
- Existing projects might have LVLs that are no longer in team
- **Solution**: 
  - Validate on project update
  - OR prevent team LVL changes if projects depend on them
  - OR allow but warn admin

### 20. Concurrent Simplification Requests
**Problem**: User could spam simplification button
- Multiple simultaneous requests
- Wasted API calls
- **Solution**: 
  - Disable button during request
  - Debounce/throttle requests
  - Show "processing" state

---

## 📋 Recommendations for MVP

### Must Address:
1. ✅ Data relationship synchronization (User ↔ Team)
2. ✅ Cascade deletion rules
3. ✅ Token limit handling in prompts
4. ✅ Initial SUPER_ADMIN creation
5. ✅ Basic error handling
6. ✅ Rate limiting on /api/simplify

### Should Address:
7. ⚠️ Pagination for list endpoints
8. ⚠️ Database indexes
9. ⚠️ Input validation (Zod)
10. ⚠️ Loading states in UI

### Can Defer:
11. 🔵 Password reset flow
12. 🔵 httpOnly cookies
13. 🔵 FILE reference type
14. 🔵 Advanced analytics
15. 🔵 RequestLog archival

---

## 🎯 Suggested Additions to Strategy

1. **Seed Script**: Create initial SUPER_ADMIN user and LVLs
2. **Validation Layer**: Add Zod schemas for all API endpoints
3. **Error Middleware**: Centralized error handling
4. **Index Strategy**: Document which fields need indexes
5. **Prompt Token Management**: Function to truncate/limit context
6. **Rate Limiting**: Add to /api/simplify endpoint
7. **Soft Delete**: Consider for Teams/Projects instead of hard delete

