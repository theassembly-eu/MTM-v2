# Deployment Strategy - High Priority Features
## MTM 2.0 Showcase MVP

**Goal**: Deploy 5 high-priority showcase features in a structured, low-risk manner that demonstrates innovation and platform capabilities.

**Note**: Image generation feature has been deferred due to intensive refactoring requirements.

---

## Feature Overview & Dependencies

### 1. **Rework LVLs System** (Foundation)
- **Complexity**: Low-Medium
- **Dependencies**: None (foundation feature)
- **Risk**: Low
- **Impact**: Enables better context for all other features

### 2. **AI Auto-Generate Prompts** (Standalone)
- **Complexity**: Medium
- **Dependencies**: None
- **Risk**: Medium (AI quality variable)
- **Impact**: High showcase value, meta-AI feature

### 3. **Custom Prompts with AI Enhancement** (Enhancement)
- **Complexity**: Medium
- **Dependencies**: AI Auto-Generate Prompts (can integrate)
- **Risk**: Low-Medium
- **Impact**: Flexibility and customization

### 4. **User Activity Dashboard** (Analytics)
- **Complexity**: Medium-High
- **Dependencies**: None (uses existing RequestLog data)
- **Risk**: Low
- **Impact**: Professional, data-driven appearance

### 5. **AI Research Mode** (Complex)
- **Complexity**: High
- **Dependencies**: LVLs system (places), References system
- **Risk**: High (cost, reliability, fact-checking)
- **Impact**: Highest showcase value, most innovative

---

## Phased Deployment Strategy

### **Phase 1: Foundation & Quick Wins** (Week 1-2)
**Goal**: Establish foundation and deploy low-risk, high-impact features

#### 1.1 LVLs System Rework
- **Tasks**:
  - Add `places` array field to LVL model
  - Update LVL CRUD endpoints
  - Create migration script for existing LVLs
  - Update SimplifyText.vue to use places in context
  - Update prompt builder to include places
  - populate the places by pulling available datas from online sources
- **Testing**: 
  - Unit tests for LVL model
  - Integration tests for simplify endpoint with places
  - Manual testing with Belgian municipalities/provinces
- **Deployment**: Direct to main (low risk)
- **Rollback Plan**: Database migration can be reversed

#### 1.2 User Activity Dashboard
- **Tasks**:
  - Install Chart.js or similar (e.g., `chart.js`, `vue-chartjs`)
  - Create analytics aggregation endpoint `/api/analytics`
  - Build analytics queries (requests per user/team/project, LVL usage, keywords)
  - Create `/admin/analytics` Vue component
  - Add navigation link for SUPER_ADMIN
- **Testing**:
  - Test with various data volumes
  - Verify permission restrictions
  - Test chart rendering and responsiveness
- **Deployment**: Feature flag or direct deploy
- **Rollback Plan**: Simple route removal

**Phase 1 Deliverables**: 
- Enhanced LVL system with places
- Analytics dashboard visible to SUPER_ADMIN

---

### **Phase 2: AI Enhancement Features** (Week 3-4)
**Goal**: Deploy AI-powered features that demonstrate innovation

#### 2.1 AI Auto-Generate Prompts
- **Tasks**:
  - Create `/api/prompts/generate` endpoint
  - Implement prompt generation logic using OpenAI
  - Add "AI Prompt Generator" section to SimplifyText.vue
  - Show generated prompt with edit option
  - Optional: Add confidence score or explanation
- **Testing**:
  - Test with various keyword combinations
  - Verify prompt quality and relevance
  - Test error handling for API failures
  - Rate limiting considerations
- **Deployment**: Feature flag recommended
- **Rollback Plan**: Endpoint can be disabled via feature flag

#### 2.2 Custom Prompts with AI Enhancement
- **Tasks**:
  - Create `PromptTemplate` model
  - CRUD endpoints for prompt templates
  - Template library UI component
  - Integrate with AI prompt generator (optional enhancement)
  - Add template selector to SimplifyText.vue
- **Testing**:
  - CRUD operations for templates
  - Template application in simplify flow
  - Permission checks (who can create/edit templates)
- **Deployment**: Feature flag recommended
- **Rollback Plan**: Model and routes can be disabled

**Phase 2 Deliverables**:
- AI-powered prompt generation
- Custom prompt template system

---

### **Phase 3: AI Research Mode** (Week 5-6)
**Goal**: Deploy the most advanced and innovative feature

#### 3.1 AI Research Mode
- **Tasks**:
  - Research OpenAI web browsing capabilities or alternative (e.g., Serper API, Tavily)
  - Create `/api/simplify/research` endpoint or extend existing
  - Implement web search and content extraction
  - Build context aggregation logic
  - Add source attribution system
  - Update SimplifyText.vue with "Research Mode" toggle
  - Add visual indicators for research progress
  - Implement fact-checking or source verification
- **Testing**:
  - Test with various LVL/location/keyword combinations
  - Verify source attribution accuracy
  - Test error handling for search failures
  - Rate limiting (more expensive operations)
  - Verify research quality and relevance
- **Deployment**: Feature flag mandatory
- **Rollback Plan**: Endpoint can be disabled, fallback to regular simplify
- **Cost Considerations**:
  - Higher API costs (multiple API calls)
  - Implement strict rate limiting
  - Consider caching research results
  - Monitor usage per user/team

**Phase 3 Deliverables**:
- AI research mode for autonomous context gathering

---

## Technical Requirements

### New Dependencies
```json
{
  "chart.js": "^4.x.x",
  "vue-chartjs": "^5.x.x",
  // OR
  "recharts": "^2.x.x",  // Alternative charting library
  
  // For research mode (web search)
  "axios": "^1.13.2",  // Already have
  "cheerio": "^1.1.2",  // Already have
  // OR
  "@tavily/tavily-js": "^x.x.x",  // Alternative search API
  // OR
  "serper": "^x.x.x"  // Google Search API wrapper
}
```

### Environment Variables
```env
# Existing
OPENAI_API_KEY=...
JWT_SECRET=...

# New (if needed)
TAVILY_API_KEY=...  # For research mode
SERPER_API_KEY=...  # Alternative for research mode
MAX_RESEARCH_REQUESTS_PER_HOUR=5  # Rate limiting
```

### Database Changes
- **LVL Model**: Add `places: [String]` field
- **New Model**: `PromptTemplate` (name, description, prompt, createdBy, team, project, scope)
- **RequestLog Model**: Add optional fields for research mode (sources, researchContext)

### Storage Considerations
- **Research Results**: 
  - Cache in MongoDB (ResearchCache model) to avoid duplicate searches
  - TTL index for cache expiration

---

## Risk Assessment & Mitigation

### High Risk Features
1. **AI Research Mode**
   - **Risks**: High API costs, unreliable search results, fact-checking challenges
   - **Mitigation**: 
     - Strict rate limiting
     - Cost monitoring alerts
     - Source attribution required
     - Cache research results
     - Feature flag for easy disable

### Medium Risk Features
1. **AI Auto-Generate Prompts**
   - **Risks**: Variable prompt quality, API costs
   - **Mitigation**:
     - Allow manual editing of generated prompts
     - Rate limiting
     - Quality validation

### Low Risk Features
1. **LVLs System Rework**: Low risk, foundation feature
2. **User Activity Dashboard**: Low risk, read-only analytics
3. **Custom Prompts**: Low risk, standard CRUD

---

## Testing Strategy

### Unit Tests
- LVL model with places field
- PromptTemplate model
- Prompt generation logic
- Analytics aggregation functions

### Integration Tests
- Simplify endpoint with places context
- Research mode endpoint
- Analytics endpoint with various data scenarios

### Manual Testing Checklist
- [ ] LVLs with places work correctly in simplify flow
- [ ] Analytics dashboard displays accurate data
- [ ] AI prompt generation produces relevant prompts
- [ ] Custom prompt templates save and apply correctly
- [ ] Research mode gathers relevant context
- [ ] All features respect role-based permissions
- [ ] Error handling works for API failures
- [ ] Rate limiting prevents abuse
- [ ] UI is responsive and intuitive

---

## Deployment Process

### Pre-Deployment
1. **Code Review**: All features reviewed and approved
2. **Testing**: All tests passing (unit, integration, manual)
3. **Documentation**: API docs and user guides updated
4. **Environment Setup**: All environment variables configured
5. **Database Migration**: Scripts ready for LVL places field

### Deployment Steps (Per Phase)
1. **Backup**: Database backup before any migrations
2. **Deploy Backend**: 
   - Push to EvenNode
   - Run database migrations
   - Verify endpoints are accessible
3. **Deploy Frontend**:
   - Build frontend
   - Verify new routes/components load
4. **Smoke Tests**: 
   - Quick manual verification of deployed features
   - Check error logs
5. **Monitor**: 
   - Watch for errors in EvenNode logs
   - Monitor API usage and costs
   - Check user feedback

### Rollback Procedure
1. **Feature Flags**: Disable feature via environment variable or code toggle
2. **Database Rollback**: Run reverse migration scripts if needed
3. **Code Rollback**: Revert to previous git commit if critical issues
4. **Communication**: Notify users if features are temporarily unavailable

---

## Success Metrics

### Technical Metrics
- API response times < 5s for research mode
- Zero critical bugs in production
- API cost within budget limits

### User Metrics
- Features used by demo users
- Positive feedback on showcase features
- Analytics dashboard accessed regularly
- Research mode demonstrates value

### Showcase Metrics
- Features demonstrate innovation
- Platform appears professional and mature
- AI capabilities are clearly visible
- Data-driven insights are accessible

---

## Timeline Estimate

- **Phase 1**: 2 weeks (Foundation)
- **Phase 2**: 2 weeks (AI Features)
- **Phase 3**: 2 weeks (AI Research Mode)
- **Total**: 6 weeks for all high-priority features (5 features total)

**Note**: Timeline assumes single developer. Can be parallelized with multiple developers.

---

## Post-Deployment

### Monitoring
- API usage and costs
- Error rates and types
- User engagement with new features
- Performance metrics

### Iteration
- Gather user feedback
- Refine AI prompts based on results
- Optimize research mode accuracy
- Improve image generation quality
- Enhance analytics visualizations

### Documentation
- Update user guides
- Create demo scripts for showcase
- Document API endpoints
- Record demo videos for each feature

