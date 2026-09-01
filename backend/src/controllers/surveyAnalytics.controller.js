/**
 * @fileoverview Pulse Survey Analytics Controller
 *
 * Provides aggregated analytics endpoints for pulse survey data:
 *   - Overall engagement metrics (response rate trends, avg satisfaction)
 *   - Department-level breakdowns
 *   - Per-question analytics with trend tracking
 *   - Response heatmap (responses per day-of-week / time-of-day)
 *   - Sentiment timeline
 *   - Benchmark comparison across surveys
 */

const PulseSurvey = require('../models/pulseSurvey.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Compute a moving average over an array of numbers.
 * @param {number[]} values
 * @param {number} window
 * @returns {(number|null)[]}
 */
function movingAverage(values, window = 3) {
  return values.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(values.length, i + Math.ceil(window / 2));
    const slice = values.slice(start, end);
    if (slice.length === 0) return null;
    return Math.round((slice.reduce((s, v) => s + v, 0) / slice.length) * 100) / 100;
  });
}

/**
 * Bucket responses by day-of-week (0 = Sunday, 6 = Saturday).
 * @param {Array} responses
 * @returns {Object} { 0: count, 1: count, ... }
 */
function bucketByDayOfWeek(responses) {
  const buckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const r of responses) {
    if (r.submittedAt) {
      const day = new Date(r.submittedAt).getDay();
      buckets[day] = (buckets[day] || 0) + 1;
    }
  }
  return buckets;
}

/**
 * Bucket responses by hour of day (0–23).
 * @param {Array} responses
 * @returns {Object} { 0: count, 1: count, ... }
 */
function bucketByHourOfDay(responses) {
  const buckets = {};
  for (let h = 0; h < 24; h++) buckets[h] = 0;
  for (const r of responses) {
    if (r.submittedAt) {
      const hour = new Date(r.submittedAt).getHours();
      buckets[hour] = (buckets[hour] || 0) + 1;
    }
  }
  return buckets;
}

/**
 * Compute average rating across all rating-type questions in a survey's responses.
 */
function computeAvgSatisfaction(responses, questions) {
  const ratingQIds = questions
    .filter((q) => q.type === 'rating')
    .map((q) => q._id.toString());

  if (ratingQIds.length === 0) return null;

  let totalRatings = 0;
  let ratingSum = 0;

  for (const response of responses) {
    for (const ans of response.answers || []) {
      if (ratingQIds.includes(ans.questionId?.toString())) {
        const val = Number(ans.value);
        if (!isNaN(val)) {
          ratingSum += val;
          totalRatings += 1;
        }
      }
    }
  }

  return totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 100) / 100 : null;
}

/**
 * Bucket responses into date-keyed groups (YYYY-MM-DD).
 */
function bucketByDate(responses) {
  const buckets = {};
  for (const r of responses) {
    if (r.submittedAt) {
      const key = new Date(r.submittedAt).toISOString().slice(0, 10);
      buckets[key] = (buckets[key] || 0) + 1;
    }
  }
  return buckets;
}

// ─── Endpoint: Overview Analytics ─────────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/overview
 *
 * Returns aggregate metrics across all surveys for this tenant:
 *   - totalSurveys, activeSurveys, draftSurveys, closedSurveys
 *   - totalResponses across all surveys
 *   - avgResponseRate (across surveys with at least one response)
 *   - avgSatisfaction (weighted average of rating questions)
 *   - responseTimeline (responses per week for last 12 weeks)
 *   - topSurveys (top 5 by response count)
 */
exports.getOverview = async (req, res, next) => {
  try {
    const filter = {};
    const surveys = await PulseSurvey.find(filter).select(
      'title status responses publishedAt createdAt questions targetDepartments',
    );

    const totalSurveys = surveys.length;
    const activeSurveys = surveys.filter((s) => s.status === 'active').length;
    const draftSurveys = surveys.filter((s) => s.status === 'draft').length;
    const closedSurveys = surveys.filter((s) => s.status === 'closed').length;

    const totalResponses = surveys.reduce((sum, s) => sum + (s.responses?.length || 0), 0);

    const totalEmployees = await Employee.countDocuments(
      { isActive: true, deletedAt: null },
    );

    // Average response rate across surveys that have been published
    const published = surveys.filter((s) => s.status !== 'draft');
    const avgResponseRate =
      published.length > 0 && totalEmployees > 0
        ? Math.round(
            (published.reduce((sum, s) => {
              const rate = (s.responses?.length || 0) / totalEmployees;
              return sum + Math.min(rate * 100, 100);
            }, 0) /
              published.length) *
              100,
          ) / 100
        : 0;

    // Weighted average satisfaction across all surveys
    let totalRatingSum = 0;
    let totalRatingCount = 0;
    for (const survey of surveys) {
      const ratingQIds = survey.questions
        .filter((q) => q.type === 'rating')
        .map((q) => q._id.toString());
      if (ratingQIds.length === 0) continue;
      for (const response of survey.responses || []) {
        for (const ans of response.answers || []) {
          if (ratingQIds.includes(ans.questionId?.toString())) {
            const val = Number(ans.value);
            if (!isNaN(val)) {
              totalRatingSum += val;
              totalRatingCount += 1;
            }
          }
        }
      }
    }
    const avgSatisfaction =
      totalRatingCount > 0
        ? Math.round((totalRatingSum / totalRatingCount) * 100) / 100
        : null;

    // Response timeline: last 12 weeks
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

    const timelineBuckets = {};
    const weekLabels = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - w * 7);
      const label = weekStart.toISOString().slice(0, 10);
      timelineBuckets[label] = 0;
      weekLabels.push(label);
    }

    for (const survey of surveys) {
      for (const response of survey.responses || []) {
        if (response.submittedAt && response.submittedAt >= twelveWeeksAgo) {
          // Find the week label
          const diffDays = Math.floor(
            (response.submittedAt - twelveWeeksAgo) / (1000 * 60 * 60 * 24),
          );
          const weekIdx = Math.min(Math.floor(diffDays / 7), 11);
          const label = weekLabels[weekIdx];
          if (label) timelineBuckets[label] = (timelineBuckets[label] || 0) + 1;
        }
      }
    }

    const responseTimeline = weekLabels.map((date) => ({
      date,
      responses: timelineBuckets[date] || 0,
    }));

    // Top 5 surveys by response count
    const topSurveys = surveys
      .filter((s) => (s.responses?.length || 0) > 0)
      .sort((a, b) => (b.responses?.length || 0) - (a.responses?.length || 0))
      .slice(0, 5)
      .map((s) => ({
        _id: s._id,
        title: s.title,
        status: s.status,
        responseCount: s.responses?.length || 0,
        questionCount: s.questions?.length || 0,
      }));

    res.status(200).json({
      overview: {
        totalSurveys,
        activeSurveys,
        draftSurveys,
        closedSurveys,
        totalResponses,
        totalEmployees,
        avgResponseRate,
        avgSatisfaction,
      },
      responseTimeline,
      topSurveys,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Department Breakdown ───────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/departments
 *
 * For each department: number of surveys targeted, total responses, avg
 * satisfaction score, and response rate relative to department headcount.
 */
exports.getDepartmentBreakdown = async (req, res, next) => {
  try {
    const filter = {};
    const surveys = await PulseSurvey.find(filter).select(
      'title status responses questions targetDepartments',
    );

    // Gather all unique departments from employees
    const employees = await Employee.find(
      { isActive: true, deletedAt: null },
    ).select('department');

    const deptCounts = {};
    for (const emp of employees) {
      const dept = emp.department || 'Unassigned';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    }

    const allDepts = Object.keys(deptCounts);

    // Build department analytics
    const departments = allDepts.map((dept) => {
      let totalResponses = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      let surveysTargeting = 0;

      for (const survey of surveys) {
        const targeted =
          survey.targetDepartments.length === 0 ||
          survey.targetDepartments.includes(dept);
        if (targeted) surveysTargeting += 1;

        // Count responses from this department (approximate: we track by employee count)
        // Since responses are anonymous, we count total for targeted surveys
        if (targeted && survey.responses) {
          totalResponses += survey.responses.length;
        }

        // Rating analytics
        const ratingQIds = survey.questions
          .filter((q) => q.type === 'rating')
          .map((q) => q._id.toString());

        for (const response of survey.responses || []) {
          for (const ans of response.answers || []) {
            if (ratingQIds.includes(ans.questionId?.toString())) {
              const val = Number(ans.value);
              if (!isNaN(val)) {
                ratingSum += val;
                ratingCount += 1;
              }
            }
          }
        }
      }

      const deptSize = deptCounts[dept] || 1;
      const avgSatisfaction =
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : null;

      return {
        department: dept,
        employeeCount: deptSize,
        surveysTargeting,
        totalResponses,
        avgSatisfaction,
        responseRate:
          surveysTargeting > 0 && deptSize > 0
            ? Math.round((totalResponses / (surveysTargeting * deptSize)) * 100)
            : 0,
      };
    });

    res.status(200).json({ departments });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Question Analytics ─────────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/questions/:surveyId
 *
 * Per-question analytics for a specific survey:
 *   - For rating: avg, median, distribution, standard deviation
 *   - For MC/yes-no: option counts, percentages, top choice
 *   - Response timeline per question (if sufficient data)
 */
exports.getQuestionAnalytics = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOne(
      { _id: req.params.surveyId },
    );

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const totalEmployees = await Employee.countDocuments(
      { isActive: true, deletedAt: null },
    );

    const results = survey.questions.map((question) => {
      const qAnswers = survey.responses
        .map((r) =>
          r.answers.find((a) => a.questionId?.toString() === question._id.toString()),
        )
        .filter(Boolean);

      const base = {
        questionId: question._id,
        text: question.text,
        type: question.type,
        totalAnswers: qAnswers.length,
        responseRate:
          totalEmployees > 0
            ? Math.round((qAnswers.length / totalEmployees) * 100)
            : 0,
      };

      if (question.type === 'rating') {
        const values = qAnswers.map((a) => Number(a.value)).filter((v) => !isNaN(v));
        const sorted = [...values].sort((a, b) => a - b);

        const avg =
          values.length > 0
            ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) /
              100
            : 0;

        const median =
          values.length > 0
            ? sorted.length % 2 === 0
              ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
              : sorted[Math.floor(sorted.length / 2)]
            : 0;

        // Standard deviation
        const variance =
          values.length > 1
            ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
              (values.length - 1)
            : 0;
        const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

        // Distribution
        const distribution = {};
        for (let i = 1; i <= (question.maxRating || 5); i++) {
          const count = values.filter((v) => v === i).length;
          distribution[i] = {
            count,
            percentage:
              values.length > 0 ? Math.round((count / values.length) * 100) : 0,
          };
        }

        // Sentiment buckets: 1-2 = negative, 3 = neutral, 4-5 = positive
        const negative = values.filter((v) => v <= 2).length;
        const neutral = values.filter((v) => v === 3).length;
        const positive = values.filter((v) => v >= 4).length;
        const sentimentBreakdown = {
          negative: { count: negative, percentage: values.length > 0 ? Math.round((negative / values.length) * 100) : 0 },
          neutral: { count: neutral, percentage: values.length > 0 ? Math.round((neutral / values.length) * 100) : 0 },
          positive: { count: positive, percentage: values.length > 0 ? Math.round((positive / values.length) * 100) : 0 },
        };

        return { ...base, avg, median, stdDev, distribution, sentimentBreakdown, minRating: sorted[0] || 0, maxRating: sorted[sorted.length - 1] || 0 };
      }

      // Multiple choice / yes_no
      const options = question.type === 'yes_no' ? ['Yes', 'No'] : question.options || [];
      const counts = {};
      for (const opt of options) counts[opt] = 0;

      for (const a of qAnswers) {
        const val = String(a.value);
        if (counts[val] !== undefined) counts[val] += 1;
      }

      const optionAnalytics = options.map((opt) => ({
        option: opt,
        count: counts[opt],
        percentage: qAnswers.length > 0 ? Math.round((counts[opt] / qAnswers.length) * 100) : 0,
      }));

      const topOption = optionAnalytics.sort((a, b) => b.count - a.count)[0];

      return {
        ...base,
        options: optionAnalytics,
        topOption: topOption ? topOption.option : null,
        topOptionPercentage: topOption ? topOption.percentage : 0,
      };
    });

    res.status(200).json({
      survey: {
        _id: survey._id,
        title: survey.title,
        status: survey.status,
        publishedAt: survey.publishedAt,
        closesAt: survey.closesAt,
      },
      totalEmployees,
      responseCount: survey.responses.length,
      responseRate:
        totalEmployees > 0
          ? Math.round((survey.responses.length / totalEmployees) * 100)
          : 0,
      questions: results,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Response Heatmap ───────────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/heatmap
 *
 * Returns response timing patterns:
 *   - dayOfWeek: responses grouped by day of week
 *   - hourOfDay: responses grouped by hour (0–23)
 *   - peakTime: the busiest hour
 *   - peakDay: the busiest day
 */
exports.getResponseHeatmap = async (req, res, next) => {
  try {
    const filter = {};
    const allResponses = [];

    const surveys = await PulseSurvey.find(filter).select('responses');
    for (const survey of surveys) {
      for (const response of survey.responses || []) {
        allResponses.push(response);
      }
    }

    const dayOfWeek = bucketByDayOfWeek(allResponses);
    const hourOfDay = bucketByHourOfDay(allResponses);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayData = Object.entries(dayOfWeek).map(([day, count]) => ({
      day: dayLabels[Number(day)],
      dayIndex: Number(day),
      count,
    }));

    const hourData = Object.entries(hourOfDay)
      .map(([hour, count]) => ({
        hour: Number(hour),
        label: `${Number(hour).toString().padStart(2, '0')}:00`,
        count,
      }))
      .sort((a, b) => a.hour - b.hour);

    const peakDay = dayData.reduce((max, d) => (d.count > max.count ? d : max), { count: 0 });
    const peakHour = hourData.reduce((max, h) => (h.count > max.count ? h : max), { count: 0 });

    res.status(200).json({
      heatmap: {
        dayOfWeek: dayData,
        hourOfDay: hourData,
        totalResponses: allResponses.length,
        peakDay: { label: peakDay.day, count: peakDay.count },
        peakHour: { label: peakHour.label, count: peakHour.count },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Sentiment Trend ────────────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/sentiment-trend
 *
 * Aggregates rating responses over time to show a sentiment trend line.
 * Groups by week and computes average satisfaction, positive %, negative %.
 */
exports.getSentimentTrend = async (req, res, next) => {
  try {
    const filter = {};
    const surveys = await PulseSurvey.find(filter).select('responses questions');

    // Collect all rating answers with timestamps
    const ratingAnswers = [];
    for (const survey of surveys) {
      const ratingQIds = survey.questions
        .filter((q) => q.type === 'rating')
        .map((q) => q._id.toString());

      for (const response of survey.responses || []) {
        if (!response.submittedAt) continue;
        for (const ans of response.answers || []) {
          if (ratingQIds.includes(ans.questionId?.toString())) {
            const val = Number(ans.value);
            if (!isNaN(val)) {
              ratingAnswers.push({ value: val, date: response.submittedAt });
            }
          }
        }
      }
    }

    // Sort by date
    ratingAnswers.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group by week
    const weekMap = {};
    for (const item of ratingAnswers) {
      const d = new Date(item.date);
      // Get Monday of that week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const key = monday.toISOString().slice(0, 10);

      if (!weekMap[key]) weekMap[key] = { values: [], total: 0, positive: 0, negative: 0, neutral: 0 };
      weekMap[key].values.push(item.value);
      weekMap[key].total += 1;
      if (item.value >= 4) weekMap[key].positive += 1;
      else if (item.value <= 2) weekMap[key].negative += 1;
      else weekMap[key].neutral += 1;
    }

    const trend = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 weeks
      .map(([weekStart, data]) => {
        const avg = data.values.reduce((s, v) => s + v, 0) / data.values.length;
        return {
          weekStart,
          avgSatisfaction: Math.round(avg * 100) / 100,
          totalResponses: data.total,
          positivePercentage: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
          neutralPercentage: data.total > 0 ? Math.round((data.neutral / data.total) * 100) : 0,
          negativePercentage: data.total > 0 ? Math.round((data.negative / data.total) * 100) : 0,
        };
      });

    res.status(200).json({ sentimentTrend: trend });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Survey Comparison ──────────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/comparison
 *
 * Side-by-side comparison of all published surveys with key metrics:
 *   response rate, avg satisfaction, question count, completion speed.
 */
exports.getSurveyComparison = async (req, res, next) => {
  try {
    const filter = {};
    const surveys = await PulseSurvey.find(filter).select(
      'title status responses questions publishedAt closesAt createdAt targetDepartments',
    );

    const totalEmployees = await Employee.countDocuments(
      { isActive: true, deletedAt: null },
    );

    const published = surveys.filter((s) => s.status !== 'draft');

    const comparison = published.map((survey) => {
      const responseCount = survey.responses?.length || 0;
      const responseRate =
        totalEmployees > 0 ? Math.round((responseCount / totalEmployees) * 100) : 0;

      const avgSatisfaction = computeAvgSatisfaction(
        survey.responses || [],
        survey.questions || [],
      );

      // Average completion time (time from first question seen to submission)
      // We approximate from submittedAt - publishedAt as a proxy
      let avgCompletionTimeSeconds = null;
      if (survey.publishedAt && survey.responses.length > 0) {
        const times = survey.responses
          .filter((r) => r.submittedAt)
          .map((r) => (new Date(r.submittedAt) - new Date(survey.publishedAt)) / 1000)
          .filter((t) => t > 0 && t < 86400); // Filter out unreasonable times
        if (times.length > 0) {
          avgCompletionTimeSeconds = Math.round(
            times.reduce((s, t) => s + t, 0) / times.length,
          );
        }
      }

      return {
        _id: survey._id,
        title: survey.title,
        status: survey.status,
        questionCount: survey.questions?.length || 0,
        responseCount,
        responseRate,
        avgSatisfaction,
        avgCompletionTimeSeconds,
        publishedAt: survey.publishedAt,
        closesAt: survey.closesAt,
        targetAll: survey.targetDepartments.length === 0,
        targetDepartments: survey.targetDepartments,
        daysOpen: survey.publishedAt
          ? Math.round((new Date() - new Date(survey.publishedAt)) / (1000 * 60 * 60 * 24))
          : 0,
      };
    });

    res.status(200).json({ comparison });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Engagement Scorecard ───────────────────────────────────────

/**
 * GET /api/pulse-surveys/analytics/scorecard
 *
 * High-level scorecard with engagement metrics:
 *   - Overall engagement score (0–100 composite)
 *   - Participation trend (response rate over time)
 *   - Satisfaction index
 *   - Trend direction (improving / declining / stable)
 *   - Comparison with previous period
 */
exports.getEngagementScorecard = async (req, res, next) => {
  try {
    const filter = {};
    const surveys = await PulseSurvey.find(filter).select(
      'responses questions publishedAt status',
    );

    const totalEmployees = await Employee.countDocuments(
      { isActive: true, deletedAt: null },
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Current period (last 30 days) vs previous period (30-60 days ago)
    let currentPeriodResponses = 0;
    let currentPeriodRatings = [];
    let previousPeriodResponses = 0;
    let previousPeriodRatings = [];
    let totalResponses = 0;

    for (const survey of surveys) {
      const ratingQIds = survey.questions
        .filter((q) => q.type === 'rating')
        .map((q) => q._id.toString());

      for (const response of survey.responses || []) {
        if (!response.submittedAt) continue;
        totalResponses += 1;

        const isCurrent = response.submittedAt >= thirtyDaysAgo;
        const isPrevious = response.submittedAt >= sixtyDaysAgo && response.submittedAt < thirtyDaysAgo;

        if (isCurrent) currentPeriodResponses += 1;
        if (isPrevious) previousPeriodResponses += 1;

        for (const ans of response.answers || []) {
          if (ratingQIds.includes(ans.questionId?.toString())) {
            const val = Number(ans.value);
            if (!isNaN(val)) {
              if (isCurrent) currentPeriodRatings.push(val);
              if (isPrevious) previousPeriodRatings.push(val);
            }
          }
        }
      }
    }

    const currentAvgRating =
      currentPeriodRatings.length > 0
        ? Math.round((currentPeriodRatings.reduce((s, v) => s + v, 0) / currentPeriodRatings.length) * 100) / 100
        : null;
    const previousAvgRating =
      previousPeriodRatings.length > 0
        ? Math.round((previousPeriodRatings.reduce((s, v) => s + v, 0) / previousPeriodRatings.length) * 100) / 100
        : null;

    // Engagement score = weighted composite of participation rate and satisfaction
    const participationScore =
      totalEmployees > 0
        ? Math.min((currentPeriodResponses / totalEmployees) * 100, 100)
        : 0;
    const satisfactionScore = currentAvgRating ? (currentAvgRating / 5) * 100 : 50;

    const engagementScore = Math.round(participationScore * 0.4 + satisfactionScore * 0.6);

    // Trend direction
    let trendDirection = 'stable';
    let trendDelta = 0;
    if (previousAvgRating !== null && currentAvgRating !== null) {
      trendDelta = Math.round((currentAvgRating - previousAvgRating) * 100) / 100;
      if (trendDelta > 0.2) trendDirection = 'improving';
      else if (trendDelta < -0.2) trendDirection = 'declining';
    }

    const previousParticipation =
      totalEmployees > 0
        ? Math.min((previousPeriodResponses / totalEmployees) * 100, 100)
        : 0;
    const previousEngagementScore = Math.round(
      previousParticipation * 0.4 + (previousAvgRating ? (previousAvgRating / 5) * 100 : 50) * 0.6,
    );

    res.status(200).json({
      scorecard: {
        engagementScore,
        previousEngagementScore,
        engagementDelta: engagementScore - previousEngagementScore,
        participationRate: Math.round(participationScore * 100) / 100,
        currentAvgRating,
        previousAvgRating,
        ratingDelta: trendDelta,
        trendDirection,
        totalResponses,
        totalEmployees,
        currentPeriodResponses,
        previousPeriodResponses,
      },
    });
  } catch (error) {
    next(error);
  }
};
