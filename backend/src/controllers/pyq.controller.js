const PYQ = require("../models/pyq.model");
const PYQTrend = require("../models/pyqTrend.model");
const { generatePYQTrend } = require("../utils/gemini");

// Create a single PYQ entry
exports.createPYQ = async (req, res, next) => {
  try {
    const { subject, exam, year, question, chapter, difficulty, tags } = req.body;
    const filter = {};

    if (!subject || !exam || !year || !question || !chapter || !difficulty) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newPyq = await PYQ.create({
      subject,
      exam,
      year: Number(year),
      question,
      chapter,
      difficulty,
      tags: tags || [],
      tenantId: filter.tenantId,
      createdBy: req.userId,
    });

    res.status(201).json(newPyq);
  } catch (error) {
    next(error);
  }
};

// Bulk upload PYQ entries
exports.bulkUploadPYQs = async (req, res, next) => {
  try {
    const { pyqs } = req.body;
    const filter = {};

    if (!Array.isArray(pyqs) || pyqs.length === 0) {
      return res.status(400).json({ message: "Invalid payload: 'pyqs' array is required and cannot be empty" });
    }

    // Map and inject tenantId and createdBy metadata
    const preparedPyqs = pyqs.map((q) => {
      if (!q.subject || !q.exam || !q.year || !q.question || !q.chapter || !q.difficulty) {
        throw new Error("Missing required fields in one or more questions");
      }
      return {
        ...q,
        year: Number(q.year),
        tags: q.tags || [],
        tenantId: filter.tenantId,
        createdBy: req.userId,
      };
    });

    const results = await PYQ.insertMany(preparedPyqs);
    res.status(201).json({ success: true, count: results.length, pyqs: results });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to bulk upload PYQ records" });
  }
};

// Retrieve PYQs list with filters
exports.getPYQs = async (req, res, next) => {
  try {
    const { subject, exam, year, chapter } = req.query;
    const clause = {};
    if (subject) clause.subject = new RegExp(subject.trim(), "i");
    if (exam) clause.exam = new RegExp(exam.trim(), "i");
    if (year) clause.year = Number(year);
    if (chapter) clause.chapter = new RegExp(chapter.trim(), "i");

    const filter = clause;
    const results = await PYQ.find(filter).sort({ year: -1, chapter: 1 });
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

// Generate AI Topic Trend Forecast
exports.generateTrendForecast = async (req, res, next) => {
  try {
    const { subject, exam, forecastYear } = req.body;
    const filter = {};

    if (!subject || !exam || !forecastYear) {
      return res.status(400).json({ message: "Missing required fields: subject, exam, and forecastYear are required" });
    }

    // Fetch past 10 years of PYQ data (tenant scoped)
    const pyqs = await PYQ.find({
      tenantId: filter.tenantId,
      subject: new RegExp(subject.trim(), "i"),
      exam: new RegExp(exam.trim(), "i"),
    }).lean();

    // Call Gemini AI trend analysis pipeline (pass list of pyqs)
    const trendAnalysis = await generatePYQTrend(pyqs, subject, exam, Number(forecastYear));

    // Update or Insert the trend analysis cache
    const forecast = await PYQTrend.findOneAndUpdate(
      {
        tenantId: filter.tenantId,
        subject: subject.trim(),
        exam: exam.trim(),
        forecastYear: Number(forecastYear),
      },
      {
        predictedDifficulty: trendAnalysis.predictedDifficulty,
        difficultyConfidence: trendAnalysis.difficultyConfidence,
        topics: trendAnalysis.topics,
        createdBy: req.userId,
      },
      { new: true, upsert: true }
    );

    res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
};

// Retrieve the latest trend forecast
exports.getLatestTrendForecast = async (req, res, next) => {
  try {
    const { subject, exam } = req.query;

    if (!subject || !exam) {
      return res.status(400).json({ message: "Missing query parameters: subject and exam are required" });
    }

    const filter = {
      subject: new RegExp(subject.trim(), "i"),
      exam: new RegExp(exam.trim(), "i"),
    };

    const forecast = await PYQTrend.findOne(filter).sort({ forecastYear: -1 });
    if (!forecast) {
      return res.status(404).json({ message: "No AI forecast found for this subject and exam" });
    }

    res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
};
