# Role Permissions Proposal

## Role Hierarchy
```
SUPER_ADMIN > ADMIN > TEAM_LEADER > TEAM_MEMBER
```

---

## Conceptual Overview

### ADMIN: LVL-Based vs Team-Based

**Old Model (Team-Based):**
- ADMIN belongs to specific teams
- ADMIN manages everything within those teams
- Limited to teams they're explicitly added to

**New Model (LVL-Based):**
- ADMIN is assigned to specific LVLs (communication levels)
- ADMIN manages all teams and projects that use their assigned LVL(s)
- Cross-team visibility: ADMIN can see teams across the organization if they share the same LVL
- Specialization: ADMIN becomes an expert in managing content at specific complexity levels

### Example Scenario:

**System Structure:**
- LVLs are defined at the **project level** (not team level)
- LVLs represent administrative/government levels: Federal, Regional, Provincial, Local
- Teams can have multiple projects, each with different LVLs
- When simplifying text, users select a project and then an LVL from that project's available LVLs
- The app helps simplify government/public sector texts for different administrative levels

**LVLs in system:**
- **LOCAL** - Gemeentelijk niveau (Municipal level) - Informal, direct, community-focused language
- **PROVINCIAL** - Provinciaal niveau (Provincial level) - Balanced formality with regional context
- **REGIONAL** - Gewestelijk niveau (Regional level: Vlaams Gewest, Brussels Gewest, Waals Gewest) - Formal but accessible, policy-focused
- **COMMUNITY** - Gemeenschapsniveau (Community level: Vlaamse Gemeenschap, Franse Gemeenschap, Duitstalige Gemeenschap) - Community-specific language and context
- **FEDERAL** - Federaal niveau (Federal/national level) - Highly formal, policy-precise, institutional tone

**ADMIN Assignment:**
- Admin "Sarah" is assigned to LVLs: [LOCAL, PROVINCIAL]
- Admin "John" is assigned to LVLs: [REGIONAL, FEDERAL]
- Admin "Marie" is assigned to LVLs: [COMMUNITY]

**Teams and Projects:**
- **Team "Social Services"** has projects:
  - Project "Municipal Welfare Information" → LVLs: [LOCAL, PROVINCIAL]
  - Project "Community Language Services" → LVLs: [COMMUNITY]
  - Project "Regional Policy Documents" → LVLs: [REGIONAL, FEDERAL]
  
- **Team "Healthcare"** has projects:
  - Project "Local Health Campaigns" → LVLs: [LOCAL]
  - Project "Provincial Health Regulations" → LVLs: [PROVINCIAL, REGIONAL]
  - Project "Community Health Programs" → LVLs: [COMMUNITY]
  - Project "Federal Health Policy" → LVLs: [FEDERAL]
  
- **Team "Education"** has projects:
  - Project "School District Communications" → LVLs: [LOCAL, PROVINCIAL]
  - Project "Community Education Initiatives" → LVLs: [COMMUNITY]
  - Project "Regional Education Framework" → LVLs: [REGIONAL]
  - Project "National Education Standards" → LVLs: [FEDERAL]
  
- **Team "Culture & Media"** has projects:
  - Project "Local Cultural Events" → LVLs: [LOCAL]
  - Project "Community Media Guidelines" → LVLs: [COMMUNITY, REGIONAL]
  - Project "Federal Cultural Policy" → LVLs: [FEDERAL]

**ADMIN Access:**
- **Sarah** (LVLs: LOCAL, PROVINCIAL) can see/manage:
  - Team "Social Services" → Project "Municipal Welfare Information" (LOCAL, PROVINCIAL)
  - Team "Healthcare" → Project "Local Health Campaigns" (LOCAL), Project "Provincial Health Regulations" (PROVINCIAL only)
  - Team "Education" → Project "School District Communications" (LOCAL, PROVINCIAL)
  - Team "Culture & Media" → Project "Local Cultural Events" (LOCAL)
  - Cannot see: Community Language Services, Community Health Programs, Community Education Initiatives, Community Media Guidelines, Regional Policy Documents, Federal Health Policy, Regional Education Framework, National Education Standards, Federal Cultural Policy

- **John** (LVLs: REGIONAL, FEDERAL) can see/manage:
  - Team "Social Services" → Project "Regional Policy Documents" (REGIONAL, FEDERAL)
  - Team "Healthcare" → Project "Provincial Health Regulations" (REGIONAL only), Project "Federal Health Policy" (FEDERAL)
  - Team "Education" → Project "Regional Education Framework" (REGIONAL), Project "National Education Standards" (FEDERAL)
  - Team "Culture & Media" → Project "Community Media Guidelines" (REGIONAL only), Project "Federal Cultural Policy" (FEDERAL)
  - Cannot see: Municipal Welfare Information, Local Health Campaigns, School District Communications, Local Cultural Events, Community Language Services, Community Health Programs, Community Education Initiatives

- **Marie** (LVLs: COMMUNITY) can see/manage:
  - Team "Social Services" → Project "Community Language Services" (COMMUNITY)
  - Team "Healthcare" → Project "Community Health Programs" (COMMUNITY)
  - Team "Education" → Project "Community Education Initiatives" (COMMUNITY)
  - Team "Culture & Media" → Project "Community Media Guidelines" (COMMUNITY only)
  - Cannot see: All LOCAL, PROVINCIAL, REGIONAL, and FEDERAL projects

**Key Points:**
- ADMIN sees **projects** (not teams directly) that use their assigned LVLs
- ADMIN can see teams that have projects using their LVLs (for context)
- Projects can have multiple LVLs, but ADMIN only manages the LVLs they're assigned to
- Cross-team visibility: ADMIN can see projects across different teams if they share the same LVL
- Specialization: Sarah focuses on local/provincial content across all teams, John focuses on regional/federal content

**Benefits:**
- Sarah specializes in local and provincial-level content simplification across all teams and projects
- John specializes in regional and federal-level content simplification across all teams and projects
- Marie specializes in community-level content (Vlaamse Gemeenschap, Franse Gemeenschap, Duitstalige Gemeenschap) across all teams and projects
- Clear separation of expertise by administrative level
- Easy to scale: add more admins for specific LVLs as needed (e.g., someone just for FEDERAL, or someone for both COMMUNITY and REGIONAL)
- ADMIN doesn't need to be added to teams - access is automatic based on project LVLs
- Ensures content is simplified appropriately for the administrative level (local = informal, federal = formal, community = community-specific context)

---

## SUPER_ADMIN
**Purpose:** Full system administration and configuration

### Permissions:
- ✅ **Everything** - Full access to all features and data
- ✅ Create/Read/Update/Delete all users (including other SUPER_ADMINs)
- ✅ Create/Read/Update/Delete all teams
- ✅ Create/Read/Update/Delete all projects
- ✅ Manage system-level configuration (Target Audiences, Output Formats, Languages, LVLs)
- ✅ Manage System Prompt Templates (component-level)
- ✅ Create/Manage A/B Tests
- ✅ View all analytics
- ✅ Access to all prompt templates (GLOBAL, TEAM, PROJECT)
- ✅ Create/Edit/Delete GLOBAL prompt templates
- ✅ Run migrations
- ✅ Use simplify feature (all teams/projects)

---

## ADMIN
**Purpose:** LVL-based administration - oversee teams and projects operating at specific administrative levels

### Key Concept:
- **ADMIN is bound to LVLs, not teams**
- An ADMIN is assigned to one or more LVLs (e.g., LOCAL, PROVINCIAL, REGIONAL, FEDERAL)
- ADMIN has permissions for all teams and projects that operate at their assigned LVL(s)
- This allows specialization: an ADMIN can be an expert in managing content simplification for specific administrative levels
- Example: An ADMIN assigned to LOCAL and PROVINCIAL can oversee all municipal and provincial-level projects across all teams

### LVL Assignment:
- ADMIN users have an `lvls` field (array of LVL IDs) in their user profile
- SUPER_ADMIN assigns LVLs to ADMIN users
- An ADMIN can be assigned to multiple LVLs

### Permissions (scoped to their assigned LVLs):

- ✅ **User Management:**
  - View users who work on teams/projects using their LVL(s)
  - Create users (ADMIN, TEAM_LEADER, TEAM_MEMBER only - not SUPER_ADMIN)
  - Update users who work on teams/projects using their LVL(s) (cannot change to SUPER_ADMIN)
  - Cannot delete users

- ✅ **Team Management:**
  - View teams that have at least one of their assigned LVLs
  - Create teams (but can only assign LVLs they have permission for)
  - Update teams that use their LVL(s) (name, members, but LVL changes limited to their assigned LVLs)
  - Cannot delete teams

- ✅ **Project Management:**
  - View projects that use their assigned LVL(s) (across all teams)
  - Create projects for teams that have their LVL(s) (can only use their assigned LVLs)
  - Update projects that use their LVL(s) (but can only change to other LVLs they have permission for)
  - Delete projects that use their LVL(s)

- ✅ **Content Management:**
  - View/Edit references for projects using their LVL(s)
  - View/Edit dictionary entries for projects using their LVL(s)
  - Create/Edit/Delete TEAM-scoped prompt templates for teams that have their LVL(s)
  - View GLOBAL prompt templates (read-only)
  - View PROJECT-scoped templates for projects using their LVL(s)

- ✅ **Usage:**
  - Use simplify feature (for projects using their assigned LVL(s))

- ❌ **Restricted:**
  - Cannot manage system-level configuration (Target Audiences, Output Formats, Languages, LVLs)
  - Cannot manage System Prompt Templates
  - Cannot create/use GLOBAL prompt templates
  - Cannot manage A/B Tests
  - Cannot delete teams (but can "freeze" teams to make them read-only - future feature)
  - Cannot delete users
  - Cannot access teams/projects that don't use their assigned LVL(s)
  
- ✅ **Analytics:**
  - View analytics filtered by their assigned LVLs (usage, performance metrics for projects they manage)

---

## TEAM_LEADER
**Purpose:** Team-level management and content creation

### Permissions:
- ✅ **User Management:**
  - View users from their teams (read-only)
  - Cannot create/update/delete users

- ✅ **Team Management:**
  - View teams they belong to (read-only)
  - Cannot create/update/delete teams

- ✅ **Project Management:**
  - View projects from their teams
  - Create projects for their teams
  - Update projects for their teams
  - Delete projects for their teams

- ✅ **Content Management:**
  - View/Edit references for projects in their teams
  - View/Edit dictionary entries for projects in their teams
  - Create/Edit/Delete PROJECT-scoped prompt templates for projects in their teams
  - Create/Edit/Delete TEAM-scoped prompt templates for their teams
  - View GLOBAL prompt templates (read-only)

- ✅ **Usage:**
  - Use simplify feature (all teams/projects they belong to)

- ❌ **Restricted:**
  - Cannot manage users
  - Cannot manage teams
  - Cannot manage system-level configuration
  - Cannot manage System Prompt Templates
  - Cannot create/use GLOBAL prompt templates
  - Cannot manage A/B Tests
  - Cannot view analytics

---

## TEAM_MEMBER
**Purpose:** Basic usage and content contribution

### Permissions:
- ✅ **Viewing:**
  - View teams they belong to (read-only)
  - View projects from their teams (read-only)
  - View references for projects in their teams (read-only)
  - View dictionary entries for projects in their teams (read-only)
  - View prompt templates available to their teams/projects (read-only)

- ✅ **Usage:**
  - Use simplify feature (all teams/projects they belong to)

- ❌ **Restricted:**
  - Cannot create/update/delete anything
  - Cannot manage users
  - Cannot manage teams
  - Cannot manage projects
  - Cannot manage content (references, dictionary)
  - Cannot manage prompt templates
  - Cannot view analytics

---

## Summary Table

| Feature | SUPER_ADMIN | ADMIN | TEAM_LEADER | TEAM_MEMBER |
|---------|-------------|-------|-------------|-------------|
| **User Management** |
| View all users | ✅ | ✅ (users on teams/projects with their LVLs) | ✅ (their teams) | ❌ |
| Create users | ✅ | ✅ (not SUPER_ADMIN) | ❌ | ❌ |
| Update users | ✅ | ✅ (users on teams/projects with their LVLs, not SUPER_ADMIN) | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ |
| **Team Management** |
| View teams | ✅ (all) | ✅ (teams with their LVLs) | ✅ (their teams) | ✅ (their teams) |
| Create teams | ✅ | ✅ (can only assign their LVLs) | ❌ | ❌ |
| Update teams | ✅ | ✅ (teams with their LVLs, LVL changes limited to their LVLs) | ❌ | ❌ |
| Delete teams | ✅ | ❌ | ❌ | ❌ |
| **Project Management** |
| View projects | ✅ (all) | ✅ (projects using their LVLs) | ✅ (their teams) | ✅ (their teams) |
| Create projects | ✅ | ✅ (for teams with their LVLs, can only use their LVLs) | ✅ (their teams) | ❌ |
| Update projects | ✅ | ✅ (projects using their LVLs, LVL changes limited to their LVLs) | ✅ (their teams) | ❌ |
| Delete projects | ✅ | ✅ (projects using their LVLs) | ✅ (their teams) | ❌ |
| **Content Management** |
| References | ✅ | ✅ (projects using their LVLs) | ✅ (their teams) | ✅ (view only) |
| Dictionary | ✅ | ✅ (projects using their LVLs) | ✅ (their teams) | ✅ (view only) |
| **Prompt Templates** |
| GLOBAL templates | ✅ (CRUD) | ✅ (view only) | ✅ (view only) | ✅ (view only) |
| TEAM templates | ✅ (CRUD) | ✅ (CRUD for teams with their LVLs) | ✅ (CRUD for their teams) | ✅ (view only) |
| PROJECT templates | ✅ (CRUD) | ✅ (view only) | ✅ (CRUD for their projects) | ✅ (view only) |
| System Templates | ✅ (CRUD) | ❌ | ❌ | ❌ |
| **Advanced Features** |
| A/B Tests | ✅ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ (filtered by their LVLs) | ❌ | ❌ |
| System Config | ✅ | ❌ | ❌ | ❌ |
| **Usage** |
| Simplify feature | ✅ (all) | ✅ (projects using their LVLs) | ✅ (their teams) | ✅ (their teams) |

---

## Key Design Principles

1. **Principle of Least Privilege:** Each role has only the permissions needed for their responsibilities
2. **LVL-Based Scoping (ADMIN):** ADMIN permissions are scoped to LVLs they are assigned to, not teams
3. **Team Scoping (TEAM_LEADER):** TEAM_LEADER permissions are scoped to teams they belong to
4. **Hierarchical Access:** Higher roles can do everything lower roles can do
5. **Content Ownership:** Content (projects, references, dictionary) is managed at the team/project level
6. **System vs. Content:** System-level configuration (LVLs, Target Audiences, etc.) is SUPER_ADMIN only
7. **Template Hierarchy:** GLOBAL > TEAM > PROJECT, with appropriate access controls
8. **LVL Specialization:** ADMIN can specialize in managing content at specific communication levels

---

## Implementation Notes

### User Model Changes:
- Add `lvls` field to User model (array of LVL ObjectIds)
- This field is only relevant for ADMIN users
- SUPER_ADMIN assigns LVLs to ADMIN users

### Permission Logic:
- When checking ADMIN permissions, query:
  - Teams: `Team.find({ lvls: { $in: adminUser.lvls } })`
  - Projects: `Project.find({ lvls: { $in: adminUser.lvls } })`
  - Users: Find users who belong to teams that have the ADMIN's LVLs
  - Analytics: Filter by projects using ADMIN's LVLs

### Edge Cases:
1. **Team with multiple LVLs:** If a team has LVLs [LOCAL, PROVINCIAL, REGIONAL] and ADMIN has LVLs [LOCAL, PROVINCIAL], ADMIN can see the team but only manage projects using LOCAL or PROVINCIAL
2. **Project with multiple LVLs:** If a project uses [LOCAL, PROVINCIAL] and ADMIN has [LOCAL], ADMIN can see/manage the project
3. **Creating teams:** ADMIN can create teams but can only assign LVLs they have permission for. ADMIN is NOT automatically added as a team member.
4. **Creating projects:** ADMIN can create projects but can only use LVLs they have permission for
5. **LVL assignment:** ADMINs must be explicitly assigned to specific LVLs. No wildcard "all LVLs" option.

### Future Features:
- **Team Freeze:** Consider implementing a "freeze" feature that makes teams and their projects read-only, preventing edits while keeping data accessible. This would be an alternative to deletion.

## Decisions Made

1. **ADMIN deleting teams:** NO - ADMIN cannot delete teams. However, consider implementing a "freeze" feature that makes teams and their projects read-only, preventing users from editing while keeping data accessible.

2. **ADMIN deleting users:** NO - Not needed at the moment. May be considered in the future.

3. **TEAM_LEADER creating TEAM-scoped templates:** YES - TEAM_LEADER should be able to create TEAM-scoped prompt templates for their teams (in addition to PROJECT-scoped templates).

4. **TEAM_MEMBER viewing analytics:** NO - TEAM_MEMBER cannot view analytics, even for their own usage.

5. **ADMIN LVL assignment:** Explicit assignment required - ADMINs must be explicitly assigned to specific LVLs. No wildcard "all LVLs" option for security and clarity.

6. **ADMIN as team member:** NO - When ADMIN creates a team, they should NOT be automatically added as a team member. ADMIN access is LVL-based, not team-based.

7. **ADMIN viewing analytics:** YES - ADMIN should be able to view analytics filtered by their assigned LVLs. This allows them to see usage and performance metrics for projects they manage.

