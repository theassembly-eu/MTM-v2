# Deployment Workflow for MTM v2.0

## Overview
This project uses a dual-remote setup:
- **GitHub** (`v2-origin`): Code storage and version control
- **EvenNode** (`evennode`): Live deployment and testing

## Remotes Configuration

```
v2-origin  → git@github.com:theassembly-eu/MTM-v2.git (GitHub)
evennode   → git@git.evennode.com:fcc88fe703403b6bc797e032f52200a2.git (EvenNode)
origin     → https://github.com/theassembly-eu/mensentaalmachine.git (v1.0 - original)
```

## Development Workflow

### 1. Make Changes Locally
```bash
# Ensure you're on v2.0 branch
git checkout v2.0

# Make your changes, then commit
git add .
git commit -m "feat: your feature description"
```

### 2. Push to GitHub (Code Storage)
```bash
# Push to GitHub for version control
git push v2-origin v2.0:main
```

### 3. Deploy to EvenNode (Live Testing)
```bash
# Push to EvenNode to trigger deployment
git push evennode v2.0:main
```

### 4. Quick Deploy Script (Both at Once)
You can push to both remotes in one command:
```bash
git push v2-origin v2.0:main && git push evennode v2.0:main
```

## Branch Structure

- **v2.0 branch**: Your development branch
  - Pushed to GitHub `main` branch
  - Pushed to EvenNode `main` branch

## EvenNode Deployment

When you push to EvenNode:
1. EvenNode automatically detects the push
2. Runs `npm install` (if package.json changed)
3. Runs `npm run build` (builds frontend)
4. Runs `npm start` (starts the server)
5. App is live for testing

## Environment Variables on EvenNode

Make sure these are set in EvenNode dashboard:
- `OPENAI_API_KEY`
- `APP_CONFIG` (EvenNode provides this)
- `MONGO_PASSWORD`
- `OPENAI_MODEL` (optional, defaults to gpt-4)
- `PORT` (optional, defaults to 3000)
- `ALLOW_ORIGINS` (if needed for CORS)

## Troubleshooting

### If EvenNode doesn't deploy:
1. Check EvenNode logs in dashboard
2. Verify branch name (should be `main`)
3. Check if build process completes successfully

### If you need to force push (use with caution):
```bash
git push evennode v2.0:main --force
```

## Quick Reference

```bash
# Check current branch
git branch

# Check remotes
git remote -v

# Push to both remotes
git push v2-origin v2.0:main && git push evennode v2.0:main

# View commit history
git log --oneline -10
```

