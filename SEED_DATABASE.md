# How to Seed the Database on EvenNode

## Option 1: Use Temporary Seed Endpoint (Easiest)

After deployment, make a POST request to seed the database:

**Using curl:**
```bash
curl -X POST https://your-evennode-app-url/api/admin/seed
```

**Or using a tool like Postman/Insomnia:**
- Method: POST
- URL: `https://your-evennode-app-url/api/admin/seed`
- No authentication needed (temporary endpoint)

This will:
- Create 5 LVLs (LOCAL, PROVINCIAL, REGIONAL, COMMUNITY, FEDERAL)
- Create 3 Target Audiences (Algemeen, Jongeren, Ouderen)
- Create 4 Output Formats (Samenvatting, Instagram, LinkedIn, Opsommingstekens)
- Create 3 Languages (Dutch, English, French)
- Create initial SUPER_ADMIN user

**Default SUPER_ADMIN credentials:**
- Email: `admin@mensentaalmachine.be` (or from SEED_ADMIN_EMAIL env var)
- Password: `admin123` (or from SEED_ADMIN_PASSWORD env var)

**⚠️ IMPORTANT:** After seeding, you should:
1. Remove the `/api/admin/seed` endpoint from `backend/index.js`
2. Change the default SUPER_ADMIN password
3. Commit and redeploy

## Option 2: Set Environment Variables and Use Seed Script

If EvenNode supports running scripts:

1. Set environment variables in EvenNode:
   - `SEED_ADMIN_EMAIL` = your email
   - `SEED_ADMIN_PASSWORD` = your password

2. SSH into EvenNode or use their console to run:
   ```bash
   npm run seed
   ```

## Option 3: Manual MongoDB Insert

If you have MongoDB access, you can manually insert the initial data.

## After Seeding

1. **Login** with the SUPER_ADMIN credentials
2. **Create your first team** at `/admin/teams`
3. **Create your first project** at `/admin/projects`
4. **Test simplification** at `/simplify`

## Verify Seeding Worked

Check EvenNode logs for:
- "✓ Created LVL: Local (LOCAL)"
- "✓ Created Target Audience: Algemeen"
- "✓ Created SUPER_ADMIN user: ..."

Or test the API:
- `GET /api/lvls` should return 5 LVLs
- `GET /api/target-audiences` should return 3 audiences
- Try logging in with the SUPER_ADMIN credentials

