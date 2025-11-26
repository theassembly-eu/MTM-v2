# Environment Variables Checklist for EvenNode

## Required Variables

### 1. OpenAI Configuration
- **`OPENAI_API_KEY`** (Required)
  - Your OpenAI API key
  - Used for text simplification

- **`OPENAI_MODEL`** (Optional, defaults to "gpt-4")
  - Model to use: "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", etc.

### 2. MongoDB Configuration
EvenNode provides `APP_CONFIG` automatically, but you need:

- **`APP_CONFIG`** (Auto-provided by EvenNode)
  - Contains MongoDB connection details in JSON format

- **`MONGO_PASSWORD`** (Required)
  - Your MongoDB password
  - Used to construct the MongoDB connection string

**OR** if not using EvenNode's MongoDB:

- **`MONGODB_URI`** (Alternative)
  - Full MongoDB connection string
  - Format: `mongodb://user:password@host:port/database`

### 3. Server Configuration
- **`PORT`** (Optional, defaults to 3000)
  - Port for the backend server
  - EvenNode usually sets this automatically

- **`ALLOW_ORIGINS`** (Optional, defaults to 'http://localhost:5173')
  - CORS allowed origins
  - For production, set to your domain(s)
  - Multiple origins: comma-separated

## Verification

After setting environment variables in EvenNode:
1. **Redeploy** the app (push a commit or use EvenNode's redeploy button)
2. Check EvenNode logs to verify:
   - MongoDB connection successful
   - Server starts without errors
   - OpenAI API calls work

## Testing

Once deployed, test:
1. Visit your EvenNode app URL
2. Try simplifying a text
3. Check EvenNode logs for any errors

## Common Issues

- **MongoDB connection fails**: Check `MONGO_PASSWORD` and `APP_CONFIG`
- **OpenAI errors**: Verify `OPENAI_API_KEY` is correct
- **CORS errors**: Update `ALLOW_ORIGINS` with your domain

