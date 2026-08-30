const express = require('express');
const router = express.Router();
const LetterTemplate = require('../models/letterTemplate.model');
const GeneratedLetter = require('../models/generatedLetter.model');
const letterTemplateService = require('../services/letterTemplate.service');
const { requireAuth } = require('../middlewares/auth.middleware');
const Handlebars = require('handlebars');

// Middleware to parse JSON
router.use(express.json());

// Apply auth middleware to all routes
router.use(requireAuth);

// Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await LetterTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await LetterTemplate.findById(req.params.id);
    if (!template)
      return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a template
router.post('/', async (req, res) => {
  try {
    const { bodyHtml } = req.body;
    // Validate Handlebars syntax before saving
    try {
      Handlebars.compile(bodyHtml, { strict: false });
    } catch (e) {
      return res
        .status(422)
        .json({ message: 'Invalid Handlebars syntax', error: e.message });
    }

    const template = new LetterTemplate(req.body);
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a template
router.put('/:id', async (req, res) => {
  try {
    const { bodyHtml } = req.body;
    if (bodyHtml) {
      try {
        Handlebars.compile(bodyHtml, { strict: false });
      } catch (e) {
        return res
          .status(422)
          .json({ message: 'Invalid Handlebars syntax', error: e.message });
      }
    }

    const template = await LetterTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!template)
      return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Generate a single letter
router.post('/generate', async (req, res) => {
  try {
    const { employeeId, templateId, metaVariables } = req.body;
    if (!employeeId || !templateId) {
      return res
        .status(400)
        .json({ message: 'employeeId and templateId are required' });
    }

    const generatedLetter = await letterTemplateService.generateLetter(
      employeeId,
      templateId,
      metaVariables,
      req.user,
    );
    res.status(201).json(generatedLetter);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Bulk generate letters
router.post('/bulk-generate', async (req, res) => {
  try {
    const { employeeIds, templateId, metaVariables } = req.body;
    if (!employeeIds || !Array.isArray(employeeIds) || !templateId) {
      return res
        .status(400)
        .json({ message: 'employeeIds (array) and templateId are required' });
    }

    const summary = await letterTemplateService.bulkGenerate(
      employeeIds,
      templateId,
      metaVariables,
      req.user,
    );
    res.status(200).json(summary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get generated letters history
router.get('/history', async (req, res) => {
  try {
    const history = await GeneratedLetter.find()
      .populate('employeeId', 'firstName lastName fullName employeeId')
      .populate('templateId', 'name type')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
