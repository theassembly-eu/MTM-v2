# Approval System Proposal

## Overview
A comprehensive workflow system for reviewing, verifying, and approving simplified texts before they are used in projects.

---

## Workflow States

### Status Progression
```
DRAFT → CANDIDATE → VERIFIED → APPROVED
                ↓
            REJECTED
```

1. **DRAFT** (default)
   - Initial state after simplification
   - No action required
   - Can be edited, annotated, or tagged

2. **CANDIDATE** (tagged as "to be used")
   - Tagged by team members or higher roles
   - Indicates the text is ready for review
   - Can still be annotated and edited

3. **VERIFIED** (checked for accuracy/hallucinations)
   - **REQUIRED** before approval
   - Done by TEAM_LEADER or ADMIN
   - Confirms factual accuracy and no AI hallucinations
   - Can add verification notes

4. **APPROVED** (final approval)
   - Done by TEAM_LEADER or ADMIN (with LVL access)
   - Text is ready for use
   - Automatically saved to project's approved content library
   - Can be exported/shared

5. **REJECTED** (optional)
   - Can be rejected at any stage
   - Requires rejection reason
   - Can be re-submitted after edits

---

## Features & Permissions

### 1. Tagging as "Candidate"
- **Who**: TEAM_MEMBER, TEAM_LEADER, ADMIN
- **Action**: Mark text as "to be used" candidate
- **UI**: Toggle button/badge in history view
- **Result**: Status changes to `CANDIDATE`

### 2. Annotations/Comments
- **Who**: TEAM_MEMBER, TEAM_LEADER, ADMIN
- **Action**: Add threaded comments/annotations
- **Features**:
  - Multiple comments per text
  - Threaded replies
  - @mentions for notifications
  - Edit/delete own comments
  - Timestamps and user attribution
- **UI**: Comment section in detail view

### 3. Verification (Required)
- **Who**: TEAM_LEADER, ADMIN (with LVL access)
- **Action**: Verify factual accuracy, check for hallucinations
- **Features**:
  - Required checkbox: "I have verified this text for accuracy"
  - Optional verification notes
  - Can mark specific sections as verified
  - Timestamp and verifier info
- **Result**: Status changes to `VERIFIED`
- **Note**: Cannot approve without verification

### 4. Approval (Final)
- **Who**: TEAM_LEADER or ADMIN (with LVL access for the project)
- **Action**: Final approval for use
- **Features**:
  - Can only approve if status is `VERIFIED`
  - Optional approval notes
  - Timestamp and approver info
  - Automatic save to project library
- **Result**: Status changes to `APPROVED`, saved to project

### 5. Rejection
- **Who**: TEAM_LEADER, ADMIN
- **Action**: Reject text at any stage
- **Features**:
  - Required rejection reason
  - Status changes to `REJECTED`
  - Can be re-submitted after edits

---

## Data Model Changes

### RequestLog Schema Additions
```javascript
approvalStatus: {
  type: String,
  enum: ['DRAFT', 'CANDIDATE', 'VERIFIED', 'APPROVED', 'REJECTED'],
  default: 'DRAFT',
  index: true, // For filtering
},
approvalMeta: {
  taggedAsCandidate: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
  },
  verified: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
    notes: String,
  },
  approved: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
    notes: String,
  },
  rejected: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
    reason: { type: String, required: true },
  },
},
comments: [{
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }, // For threading
  edited: { type: Boolean, default: false },
  editedAt: Date,
  createdAt: { type: Date, default: Date.now },
}],
```

### New Model: ApprovedContent
```javascript
// Stores approved texts in project library
const approvedContentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  requestLog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RequestLog',
    required: true,
    unique: true, // One approved content per request log
  },
  originalText: { type: String, required: true },
  simplifiedText: { type: String, required: true },
  targetAudience: { type: mongoose.Schema.Types.ObjectId, ref: 'TargetAudience' },
  outputFormat: { type: mongoose.Schema.Types.ObjectId, ref: 'OutputFormat' },
  lvl: { type: mongoose.Schema.Types.ObjectId, ref: 'LVL' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedAt: { type: Date, default: Date.now },
  tags: [String], // For organization/search
  metadata: {
    originalRequestDate: Date,
    originalUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationNotes: String,
    approvalNotes: String,
  },
}, {
  timestamps: true,
});
```

---

## UI/UX Enhancements

### History Page Improvements
1. **Status Badges**: Color-coded status indicators
   - DRAFT: Gray
   - CANDIDATE: Blue
   - VERIFIED: Yellow/Orange
   - APPROVED: Green
   - REJECTED: Red

2. **Filter by Status**: Dropdown to filter by approval status

3. **Quick Actions**:
   - Tag as candidate (if DRAFT)
   - Verify (if CANDIDATE, for leaders/admins)
   - Approve (if VERIFIED, for leaders/admins)
   - Reject (for leaders/admins)

4. **Detail View**:
   - Full approval workflow timeline
   - Comments section with threading
   - Verification checklist
   - Approval/rejection actions

### Project Page Additions
1. **Approved Content Library**:
   - New tab/section showing approved texts
   - Searchable and filterable
   - Export options (PDF, Word, etc.)
   - Copy to clipboard
   - Share links

2. **Approval Queue**:
   - For TEAM_LEADER and ADMIN
   - Shows texts pending verification/approval
   - Bulk actions (approve multiple)

---

## API Endpoints

### RequestLog Updates
- `PUT /api/request-logs/:id/tag-candidate` - Tag as candidate
- `PUT /api/request-logs/:id/verify` - Verify text
- `PUT /api/request-logs/:id/approve` - Approve text
- `PUT /api/request-logs/:id/reject` - Reject text
- `POST /api/request-logs/:id/comments` - Add comment
- `PUT /api/request-logs/:id/comments/:commentId` - Edit comment
- `DELETE /api/request-logs/:id/comments/:commentId` - Delete comment

### Approved Content
- `GET /api/projects/:id/approved-content` - Get approved texts for project
- `GET /api/projects/:id/approved-content/:contentId` - Get single approved text
- `DELETE /api/projects/:id/approved-content/:contentId` - Remove from library (soft delete)

### Approval Queue
- `GET /api/approval-queue` - Get texts pending approval (for leaders/admins)
- `POST /api/approval-queue/bulk-approve` - Bulk approve multiple texts

---

## Improvements & Enhancements

### 1. **Clear Status Workflow**
- Explicit states instead of just tags
- Visual progress indicator
- Prevents skipping steps (can't approve without verification)

### 2. **Threaded Comments**
- Better collaboration than single annotation
- @mentions for notifications
- Edit/delete capabilities

### 3. **Verification as Separate Step**
- Makes accuracy checking explicit and required
- Separate from approval (which is about permission to use)
- Verification notes for audit trail

### 4. **Approved Content Library**
- Dedicated storage for approved texts
- Easy access from project view
- Export/sharing capabilities

### 5. **Bulk Operations**
- Approve multiple texts at once
- Filter by status for efficiency

### 6. **Notifications** (Future Enhancement)
- Notify when text is tagged as candidate
- Notify when verification/approval is needed
- Notify when text is approved/rejected
- Email/in-app notifications

### 7. **Version History** (Future Enhancement)
- Track edits after simplification
- Compare versions
- See what changed between versions

### 8. **Export Options** (Future Enhancement)
- PDF export
- Word document
- Markdown
- HTML

### 9. **Search & Tags** (Future Enhancement)
- Add custom tags to approved content
- Advanced search in approved library
- Filter by date, LVL, format, etc.

---

## Permission Matrix

| Action | TEAM_MEMBER | TEAM_LEADER | ADMIN | SUPER_ADMIN |
|--------|-------------|-------------|-------|-------------|
| Tag as candidate | ✅ | ✅ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ | ✅ |
| Edit own comments | ✅ | ✅ | ✅ | ✅ |
| Delete own comments | ✅ | ✅ | ✅ | ✅ |
| Verify | ❌ | ✅ (own teams) | ✅ (LVL access) | ✅ |
| Approve | ❌ | ✅ (own teams) | ✅ (LVL access) | ✅ |
| Reject | ❌ | ✅ (own teams) | ✅ (LVL access) | ✅ |
| View approval queue | ❌ | ✅ (own teams) | ✅ (LVL access) | ✅ |
| Bulk approve | ❌ | ✅ (own teams) | ✅ (LVL access) | ✅ |
| View approved library | ✅ (own projects) | ✅ (own teams) | ✅ (LVL access) | ✅ |
| Export approved content | ✅ (own projects) | ✅ (own teams) | ✅ (LVL access) | ✅ |

---

## Implementation Priority

### Phase 1: Core Workflow
1. Add approval status fields to RequestLog
2. Implement status change endpoints
3. Add status badges and filters to History page
4. Add quick action buttons

### Phase 2: Comments & Verification
1. Add comments system
2. Add verification step
3. Add verification UI
4. Add approval UI

### Phase 3: Approved Content Library
1. Create ApprovedContent model
2. Auto-save on approval
3. Add project library view
4. Add export functionality

### Phase 4: Enhancements
1. Bulk operations
2. Notifications
3. Advanced search
4. Version history

---

## Questions for Review

1. **Verification vs Approval**: Should both be required, or can approval include verification? (Proposed: Both required, verification first)

2. **Team Leader vs Admin**: Can either approve, or must both approve? (Proposed: Either can approve)

3. **Rejection Workflow**: Can rejected texts be re-submitted? (Proposed: Yes, after edits)

4. **Comments**: Single annotation field or threaded comments? (Proposed: Threaded comments)

5. **Approved Content Storage**: Separate model or keep in RequestLog? (Proposed: Separate model for better organization)

6. **Bulk Operations**: Needed in Phase 1 or can wait? (Proposed: Phase 3)

7. **Notifications**: Email or in-app only? (Proposed: In-app first, email later)

