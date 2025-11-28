# A/B Testing Guide for MTM 2.0

## Overview

The A/B testing system allows you to compare different versions of prompt templates to see which performs better. This guide explains how to set up and test A/B experiments.

## Prerequisites

1. **Template Versions**: You need a template with at least 2 versions to test
2. **SUPER_ADMIN Access**: A/B tests can only be created by SUPER_ADMIN users
3. **Templates Enabled**: Set `USE_PROMPT_TEMPLATES=true` in environment variables (optional, but recommended)

## Step-by-Step Testing Guide

### Step 1: Create Template Versions

First, you need a template with multiple versions:

1. Go to **Configuratie** → **Systeem Templates**
2. Find a template you want to test (e.g., `role_definition`)
3. Click **Bewerken** (Edit)
4. Make a change to the template content
5. Check **"Nieuwe Versie Aanmaken"** (Create New Version)
6. Enter a new version number (e.g., `1.1.0`)
7. Add change notes
8. Click **Opslaan**

Now you have two versions: the original (e.g., `1.0.0`) and the new one (`1.1.0`).

### Step 2: Create an A/B Test

You can create an A/B test via the API or browser console:

#### Option A: Browser Console (Easiest)

1. Log in as SUPER_ADMIN
2. Open browser console (F12)
3. Run this script:

```javascript
(async function() {
  const token = localStorage.getItem('mtm_token');
  if (!token) {
    alert('No token found. Please log in first.');
    return;
  }
  
  // First, get a template ID
  const templatesRes = await fetch('/api/system-prompt-templates', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const templates = await templatesRes.json();
  
  if (templates.length === 0) {
    alert('No templates found. Run migration first.');
    return;
  }
  
  // Use the first template (or choose a specific one)
  const template = templates[0];
  const currentVersion = template.currentVersion || template.version;
  
  // Get available versions
  const versionsRes = await fetch(`/api/system-prompt-templates/${template._id}/versions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const versions = await versionsRes.json();
  
  // Create A/B test
  const testData = {
    name: `Test: ${template.name}`,
    description: 'Testing template performance',
    templateId: template._id,
    variants: [
      {
        name: 'A',
        version: currentVersion,
        description: 'Current version',
        weight: 50
      },
      {
        name: 'B',
        version: versions.versionHistory && versions.versionHistory.length > 0 
          ? versions.versionHistory[0].version 
          : currentVersion,
        description: 'Alternative version',
        weight: 50
      }
    ],
    trafficAllocation: 100, // Test on 100% of requests
    minSampleSize: 10, // Minimum 10 requests per variant
    metrics: {
      primaryMetric: 'tokenUsage' // Compare token usage
    }
  };
  
  const response = await fetch('/api/ab-tests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(testData)
  });
  
  const result = await response.json();
  if (response.ok) {
    console.log('A/B Test created:', result);
    alert(`A/B Test created!\nID: ${result._id}\nName: ${result.name}`);
  } else {
    console.error('Error:', result);
    alert('Error creating A/B test: ' + result.error);
  }
})();
```

#### Option B: Using curl

```bash
# Get your JWT token first (from browser localStorage or login)
TOKEN="your_jwt_token_here"

# Get templates
curl -H "Authorization: Bearer $TOKEN" \
  https://your-app-url.com/api/system-prompt-templates

# Create A/B test (replace templateId and versions)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test: role_definition",
    "description": "Testing role definition template",
    "templateId": "TEMPLATE_ID_HERE",
    "variants": [
      {
        "name": "A",
        "version": "1.0.0",
        "description": "Original version",
        "weight": 50
      },
      {
        "name": "B",
        "version": "1.1.0",
        "description": "New version",
        "weight": 50
      }
    ],
    "trafficAllocation": 100,
    "minSampleSize": 10,
    "metrics": {
      "primaryMetric": "tokenUsage"
    }
  }' \
  https://your-app-url.com/api/ab-tests
```

### Step 3: Start the A/B Test

```javascript
// In browser console
(async function() {
  const token = localStorage.getItem('mtm_token');
  const testId = 'YOUR_TEST_ID_HERE'; // From step 2
  
  const response = await fetch(`/api/ab-tests/${testId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  console.log('Test started:', result);
})();
```

### Step 4: Generate Test Traffic

Now make some simplification requests:

1. Go to **Vereenvoudigen** page
2. Select a team, project, and LVL
3. Enter some text to simplify
4. Click **Vereenvoudigen**
5. Repeat this 20+ times to get enough data

The A/B test will automatically:
- Assign variants randomly (50/50 split)
- Track token usage for each variant
- Track response time for each variant
- Update results in real-time

### Step 5: View Results

```javascript
// In browser console
(async function() {
  const token = localStorage.getItem('mtm_token');
  const testId = 'YOUR_TEST_ID_HERE';
  
  const response = await fetch(`/api/ab-tests/${testId}/results`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  console.log('A/B Test Results:', result);
  
  // Display summary
  alert(`A/B Test Results:
  
Variant A:
  Requests: ${result.summary.variantA.requests}
  Avg Tokens: ${result.summary.variantA.avgTokens.toFixed(2)}
  Avg Response Time: ${result.summary.variantA.avgResponseTime.toFixed(2)}ms

Variant B:
  Requests: ${result.summary.variantB.requests}
  Avg Tokens: ${result.summary.variantB.avgTokens.toFixed(2)}
  Avg Response Time: ${result.summary.variantB.avgResponseTime.toFixed(2)}ms

Winner: ${result.summary.winner || 'Not enough data yet'}
Total Requests: ${result.summary.totalRequests}`);
})();
```

### Step 6: Complete the Test

Once you have enough data:

```javascript
// In browser console
(async function() {
  const token = localStorage.getItem('mtm_token');
  const testId = 'YOUR_TEST_ID_HERE';
  
  const response = await fetch(`/api/ab-tests/${testId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  console.log('Test completed:', result);
  alert(`Test completed!\nWinner: ${result.results.winner || 'Tie'}`);
})();
```

## Quick Test Script

Here's a complete script to create and test an A/B test:

```javascript
// Complete A/B Test Setup and Monitoring Script
(async function() {
  const token = localStorage.getItem('mtm_token');
  if (!token) {
    alert('Please log in first');
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // 1. Get templates
    const templatesRes = await fetch('/api/system-prompt-templates', { headers });
    const templates = await templatesRes.json();
    
    if (templates.length === 0) {
      alert('No templates found. Please run migration first.');
      return;
    }
    
    // Use first template
    const template = templates[0];
    console.log('Testing template:', template.name);
    
    // 2. Get versions
    const versionsRes = await fetch(`/api/system-prompt-templates/${template._id}/versions`, { headers });
    const versions = await versionsRes.json();
    
    const currentVersion = template.currentVersion || template.version;
    const altVersion = versions.versionHistory && versions.versionHistory.length > 0 
      ? versions.versionHistory[0].version 
      : currentVersion;
    
    if (currentVersion === altVersion) {
      alert('Template needs at least 2 versions. Create a new version first.');
      return;
    }
    
    // 3. Create test
    const testRes = await fetch('/api/ab-tests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Quick Test: ${template.name}`,
        description: 'Quick A/B test',
        templateId: template._id,
        variants: [
          { name: 'A', version: currentVersion, weight: 50 },
          { name: 'B', version: altVersion, weight: 50 }
        ],
        trafficAllocation: 100,
        minSampleSize: 5, // Low for quick testing
        metrics: { primaryMetric: 'tokenUsage' }
      })
    });
    
    const test = await testRes.json();
    if (!testRes.ok) {
      throw new Error(test.error);
    }
    
    console.log('Test created:', test._id);
    
    // 4. Start test
    await fetch(`/api/ab-tests/${test._id}/start`, {
      method: 'POST',
      headers
    });
    
    console.log('Test started!');
    alert(`A/B Test Created and Started!
    
Test ID: ${test._id}
Template: ${template.name}
Variant A: ${currentVersion}
Variant B: ${altVersion}

Now make some simplification requests to generate test data.
Then check results with:
fetch('/api/ab-tests/${test._id}/results', { headers }).then(r => r.json()).then(console.log)`);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
})();
```

## Understanding Results

- **tokenUsage**: Lower is better (fewer tokens = more efficient)
- **responseTime**: Lower is better (faster responses)
- **userRating**: Higher is better (better quality)

The winner is determined by the `primaryMetric` you set when creating the test.

## Tips

1. **Start Small**: Use `minSampleSize: 5-10` for quick testing
2. **Traffic Allocation**: Use `50` to test on only half of requests initially
3. **Monitor Results**: Check results frequently to see progress
4. **Multiple Tests**: You can run multiple A/B tests simultaneously on different templates

## Next Steps

Once the UI is built, you'll be able to:
- Create tests visually
- View results in charts
- Compare variants side-by-side
- Export results

For now, use the API endpoints or browser console scripts above.

