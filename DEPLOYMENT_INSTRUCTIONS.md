# MTM 2.0 Deployment Instructions for EvenNode

## Pre-Deployment Checklist

### Environment Variables (Verify in EvenNode Dashboard)
- ✅ `OPENAI_API_KEY` - Your OpenAI API key
- ✅ `JWT_SECRET` - Secret for JWT tokens (should already be set)
- ✅ `APP_CONFIG` - Auto-provided by EvenNode
- ✅ `MONGO_PASSWORD` - MongoDB password (set to: `fcc88fe703403b6bc797e032f52200a2`)
- ✅ `OPENAI_MODEL` - (Optional, defaults to gpt-4)
- ✅ `PORT` - (Optional, EvenNode sets this automatically)

### For Seed Script (Optional - can be set temporarily)
- `SEED_ADMIN_EMAIL` - Email for initial SUPER_ADMIN (e.g., admin@mensentaalmachine.be)
- `SEED_ADMIN_PASSWORD` - Password for initial SUPER_ADMIN (e.g., admin123)

## Deployment Steps

### 1. Push to EvenNode
```bash
git push evennode v2.0:main
```

EvenNode will automatically:
- Install dependencies
- Build the frontend
- Start the server

### 2. Run Seed Script (After First Deployment)

After the app is deployed, you need to seed the database with initial data.

**Option A: Via EvenNode Console/SSH**
1. SSH into your EvenNode app or use EvenNode's console
2. Run: `npm run seed`

**Option B: Create a One-Time Endpoint (Temporary)**
Add this to `backend/index.js` temporarily:
```javascript
app.post('/api/admin/seed', async (req, res) => {
  // Run seed script
  // Remove after first use!
});
```

**Option C: Manual MongoDB Insert**
You can manually insert the initial data via MongoDB client.

### 3. Verify Deployment

1. **Check Logs**: Look for "MongoDB connected successfully"
2. **Test Login**: Visit your EvenNode app URL and try to login
3. **Check API**: Test `/api/hello` endpoint

## Initial Setup After Deployment

### 1. Login as SUPER_ADMIN
- Use the email/password from seed script (or manually created user)

### 2. Create Your First Team
- Go to `/admin/teams`
- Create a team with LVLs (e.g., LOCAL, PROVINCIAL)
- Add team members

### 3. Create Your First Project
- Go to `/admin/projects` (or Teams page)
- Create a project under the team
- Select LVLs (must be subset of team's LVLs)

### 4. Test Simplification
- Go to `/simplify`
- Select team, project, LVL
- Enter text and simplify

## Troubleshooting

### MongoDB Connection Issues
- Check `MONGO_PASSWORD` is set correctly
- Verify `APP_CONFIG` is available
- Check EvenNode logs for connection errors

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check token is being sent in requests
- Verify user exists in database

### API Errors
- Check EvenNode logs for detailed error messages
- Verify all environment variables are set
- Check MongoDB connection status

### Frontend Not Loading
- Check if build completed successfully
- Verify static files are being served
- Check browser console for errors

## Post-Deployment

After successful deployment:
1. ✅ Remove seed script endpoint (if created)
2. ✅ Change default SUPER_ADMIN password
3. ✅ Create real teams and projects
4. ✅ Test full workflow
5. ✅ Monitor EvenNode logs for errors

## Database Seeding

The seed script creates:
- 5 LVLs (LOCAL, PROVINCIAL, REGIONAL, COMMUNITY, FEDERAL)
- 3 Target Audiences (Algemeen, Jongeren, Ouderen)
- 4 Output Formats (Samenvatting, Instagram, LinkedIn, Opsommingstekens)
- 3 Languages (Dutch, English, French)
- 1 SUPER_ADMIN user

**Important**: The seed script is idempotent - it won't create duplicates if run multiple times.

