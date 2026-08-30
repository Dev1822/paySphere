/**
 * @fileoverview PYQ (Previous Year Questions) Controller (TypeScript Migration)
 * @description Manages PYQ entries, bulk ingestion, tenant filtering, and Gemini AI trend forecasts.
 * Issue: #1397
 */

import { Request, Response, NextFunction } from 'express';

const PYQ = require('../models/pyq.model');
const PYQTrend = require('../models/pyqTrend.model');
const { tenantFilter } = require('../utils/tenantScope');
const { generatePYQTrend } = require('../utils/gemini');

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
}

export interface CreatePYQBody {
  subject: string;
  exam: string;
  year: number | string;
  question: string;
  chapter: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  tags?: string[];
}

export interface BulkUploadPYQBody {
  pyqs: CreatePYQBody[];
}

export interface GetPYQsQuery {
  subject?: string;
  exam?: string;
  year?: string | number;
  chapter?: string;
}

export interface TrendForecastBody {
  subject: string;
  exam: string;
  forecastYear: number | string;
}

export interface LatestTrendQuery {
  subject?: string;
  exam?: string;
}

/**
 * Create a single PYQ entry.
 */
export const createPYQ = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, exam, year, question, chapter, difficulty, tags } = req.body as CreatePYQBody;
    const filter = tenantFilter(req);

    if (!subject || !exam || !year || !question || !chapter || !difficulty) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
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

/**
 * Bulk upload PYQ entries.
 */
export const bulkUploadPYQs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { pyqs } = req.body as BulkUploadPYQBody;
    const filter = tenantFilter(req);

    if (!Array.isArray(pyqs) || pyqs.length === 0) {
      res.status(400).json({ message: "Invalid payload: 'pyqs' array is required and cannot be empty" });
      return;
    }

    // Map and inject tenantId and createdBy metadata
    const preparedPyqs = pyqs.map((q) => {
      if (!q.subject || !q.exam || !q.year || !q.question || !q.chapter || !q.difficulty) {
        throw new Error('Missing required fields in one or more questions');
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
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to bulk upload PYQ records' });
  }
};

/**
 * Retrieve PYQs list with filters.
 */
export const getPYQs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, exam, year, chapter } = req.query as GetPYQsQuery;
    const clause: Record<string, any> = {};
    if (subject) clause.subject = new RegExp(subject.trim(), 'i');
    if (exam) clause.exam = new RegExp(exam.trim(), 'i');
    if (year) clause.year = Number(year);
    if (chapter) clause.chapter = new RegExp(chapter.trim(), 'i');

    const filter = tenantFilter(req, clause);
    const results = await PYQ.find(filter).sort({ year: -1, chapter: 1 });
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate AI Topic Trend Forecast.
 */
export const generateTrendForecast = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, exam, forecastYear } = req.body as TrendForecastBody;
    const filter = tenantFilter(req);

    if (!subject || !exam || !forecastYear) {
      res.status(400).json({ message: 'Missing required fields: subject, exam, and forecastYear are required' });
      return;
    }

    // Fetch past 10 years of PYQ data (tenant scoped)
    const pyqs = await PYQ.find({
      tenantId: filter.tenantId,
      subject: new RegExp(subject.trim(), 'i'),
      exam: new RegExp(exam.trim(), 'i'),
    }).lean();

    // Call Gemini AI trend analysis pipeline
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
      { new: true, upsert: true },
    );

    res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve the latest trend forecast.
 */
export const getLatestTrendForecast = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, exam } = req.query as LatestTrendQuery;

    if (!subject || !exam) {
      res.status(400).json({ message: 'Missing query parameters: subject and exam are required' });
      return;
    }

    const filter = tenantFilter(req, {
      subject: new RegExp(subject.trim(), 'i'),
      exam: new RegExp(exam.trim(), 'i'),
    });

    const forecast = await PYQTrend.findOne(filter).sort({ forecastYear: -1 });
    if (!forecast) {
      res.status(404).json({ message: 'No AI forecast found for this subject and exam' });
      return;
    }

    res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
};
