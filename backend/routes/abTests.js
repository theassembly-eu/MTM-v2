import express from 'express';
import ABTest from '../models/ABTest.js';
import SystemPromptTemplate from '../models/SystemPromptTemplate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// GET /api/ab-tests - Get all A/B tests (SUPER_ADMIN only)
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { status, templateId } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (templateId) filter.templateId = templateId;
    
    const tests = await ABTest.find(filter)
      .populate('templateId', 'name type')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(tests);
  } catch (error) {
    console.error('Error fetching A/B tests:', error);
    res.status(500).json({ error: 'Failed to fetch A/B tests', code: 'FETCH_ERROR' });
  }
});

// GET /api/ab-tests/:id - Get a specific A/B test
router.get('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id)
      .populate('templateId', 'name type version versionHistory')
      .populate('createdBy', 'name email');
    
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }
    
    res.json(test);
  } catch (error) {
    console.error('Error fetching A/B test:', error);
    res.status(500).json({ error: 'Failed to fetch A/B test', code: 'FETCH_ERROR' });
  }
});

// POST /api/ab-tests - Create a new A/B test (SUPER_ADMIN only)
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const {
      name,
      description,
      templateId,
      variants,
      trafficAllocation,
      minSampleSize,
      metrics,
      notes,
    } = req.body;

    if (!name || !templateId || !variants || variants.length !== 2) {
      return res.status(400).json({ 
        error: 'Name, templateId, and exactly 2 variants are required' 
      });
    }

    // Validate template exists
    const template = await SystemPromptTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Validate variants
    const variantNames = variants.map(v => v.name);
    if (!variantNames.includes('A') || !variantNames.includes('B')) {
      return res.status(400).json({ error: 'Variants must be named A and B' });
    }

    // Validate versions exist
    for (const variant of variants) {
      if (variant.version !== (template.currentVersion || template.version)) {
        // Check if version exists in history
        const versionExists = template.versionHistory?.some(v => v.version === variant.version);
        if (!versionExists) {
          return res.status(400).json({ 
            error: `Version ${variant.version} not found for template` 
          });
        }
      }
    }

    const test = await ABTest.create({
      name,
      description: description || '',
      templateId,
      templateName: template.name,
      variants,
      trafficAllocation: trafficAllocation || 100,
      minSampleSize: minSampleSize || 100,
      metrics: metrics || { primaryMetric: 'tokenUsage' },
      status: 'DRAFT',
      createdBy: req.user.id,
      notes: notes || '',
    });

    res.status(201).json(test);
  } catch (error) {
    console.error('Error creating A/B test:', error);
    res.status(500).json({ error: 'Failed to create A/B test', code: 'CREATE_ERROR' });
  }
});

// PUT /api/ab-tests/:id - Update an A/B test (SUPER_ADMIN only)
router.put('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    // Don't allow editing active tests
    if (test.status === 'ACTIVE' && req.body.status !== 'PAUSED' && req.body.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot edit active test. Pause or complete it first.' });
    }

    const {
      name,
      description,
      variants,
      trafficAllocation,
      minSampleSize,
      metrics,
      status,
      notes,
    } = req.body;

    if (name) test.name = name;
    if (description !== undefined) test.description = description;
    if (variants) test.variants = variants;
    if (trafficAllocation !== undefined) test.trafficAllocation = trafficAllocation;
    if (minSampleSize !== undefined) test.minSampleSize = minSampleSize;
    if (metrics) test.metrics = metrics;
    if (status) {
      test.status = status;
      if (status === 'ACTIVE' && !test.startDate) {
        test.startDate = new Date();
      }
      if (status === 'COMPLETED' && !test.endDate) {
        test.endDate = new Date();
        test.calculateWinner();
      }
    }
    if (notes !== undefined) test.notes = notes;

    await test.save();
    res.json(test);
  } catch (error) {
    console.error('Error updating A/B test:', error);
    res.status(500).json({ error: 'Failed to update A/B test', code: 'UPDATE_ERROR' });
  }
});

// POST /api/ab-tests/:id/start - Start an A/B test (SUPER_ADMIN only)
router.post('/:id/start', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'DRAFT' && test.status !== 'PAUSED') {
      return res.status(400).json({ error: 'Can only start DRAFT or PAUSED tests' });
    }

    test.status = 'ACTIVE';
    test.startDate = new Date();
    await test.save();

    res.json(test);
  } catch (error) {
    console.error('Error starting A/B test:', error);
    res.status(500).json({ error: 'Failed to start A/B test', code: 'START_ERROR' });
  }
});

// POST /api/ab-tests/:id/pause - Pause an A/B test (SUPER_ADMIN only)
router.post('/:id/pause', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Can only pause ACTIVE tests' });
    }

    test.status = 'PAUSED';
    await test.save();

    res.json(test);
  } catch (error) {
    console.error('Error pausing A/B test:', error);
    res.status(500).json({ error: 'Failed to pause A/B test', code: 'PAUSE_ERROR' });
  }
});

// POST /api/ab-tests/:id/complete - Complete an A/B test (SUPER_ADMIN only)
router.post('/:id/complete', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    test.status = 'COMPLETED';
    test.endDate = new Date();
    test.calculateWinner();
    await test.save();

    res.json(test);
  } catch (error) {
    console.error('Error completing A/B test:', error);
    res.status(500).json({ error: 'Failed to complete A/B test', code: 'COMPLETE_ERROR' });
  }
});

// DELETE /api/ab-tests/:id - Delete an A/B test (SUPER_ADMIN only)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete active test. Pause or complete it first.' });
    }

    await ABTest.findByIdAndDelete(req.params.id);
    res.json({ message: 'A/B test deleted successfully' });
  } catch (error) {
    console.error('Error deleting A/B test:', error);
    res.status(500).json({ error: 'Failed to delete A/B test', code: 'DELETE_ERROR' });
  }
});

// GET /api/ab-tests/:id/results - Get detailed results (SUPER_ADMIN only)
router.get('/:id/results', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const test = await ABTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    // Calculate winner if not already calculated
    if (!test.results.winner && test.status === 'COMPLETED') {
      test.calculateWinner();
      await test.save();
    }

    res.json({
      test: {
        id: test._id,
        name: test.name,
        status: test.status,
        metrics: test.metrics,
      },
      results: test.results,
      summary: {
        totalRequests: test.results.variantA.requests + test.results.variantB.requests,
        variantA: {
          requests: test.results.variantA.requests,
          avgTokens: test.results.variantA.avgTokens,
          avgResponseTime: test.results.variantA.avgResponseTime,
          avgRating: test.results.variantA.avgRating,
        },
        variantB: {
          requests: test.results.variantB.requests,
          avgTokens: test.results.variantB.avgTokens,
          avgResponseTime: test.results.variantB.avgResponseTime,
          avgRating: test.results.variantB.avgRating,
        },
        winner: test.results.winner,
        confidence: test.results.confidence,
      },
    });
  } catch (error) {
    console.error('Error fetching A/B test results:', error);
    res.status(500).json({ error: 'Failed to fetch A/B test results', code: 'FETCH_ERROR' });
  }
});

export default router;

