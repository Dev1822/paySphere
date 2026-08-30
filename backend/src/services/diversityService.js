const { DemographicSnapshot, InclusionSurveyMetric } = require('../models/DiversityMetrics');

class DiversityService {

  /**
   * Generates predictive 5-year D&I demographic trends based on current snapshots.
   */
  async getPredictiveDemographics() {
    const snapshots = await DemographicSnapshot.find({}).sort({ snapshotDate: -1 }).lean();

    let baselineMale = 0, baselineFemale = 0, baselineNB = 0, baselineTotal = 0;

    // Aggregate the most recent snapshot across all departments
    if (snapshots.length > 0) {
      // Find the most recent date
      const latestDate = snapshots[0].snapshotDate;
      const latestSlice = snapshots.filter(s => s.snapshotDate.getTime() === latestDate.getTime());

      latestSlice.forEach(slice => {
        baselineMale += slice.genderMale;
        baselineFemale += slice.genderFemale;
        baselineNB += slice.genderNonBinary;
        baselineTotal += slice.totalHeadcount;
      });
    } else {
      baselineMale = 3500;
      baselineFemale = 1200;
      baselineNB = 300;
      baselineTotal = 5000;
    }

    let projections = [];
    const currentYear = new Date().getFullYear();

    let currentM = baselineMale;
    let currentF = baselineFemale;
    let currentNB = baselineNB;
    let total = baselineTotal;

    // Time-series ML heuristic simulation pushing towards parity over 5 years
    for (let i = 0; i < 6; i++) {
      projections.push({
        year: currentYear + i,
        maleCount: Math.round(currentM),
        femaleCount: Math.round(currentF),
        nbCount: Math.round(currentNB),
        malePercentage: parseFloat(((currentM / total) * 100).toFixed(1)),
        femalePercentage: parseFloat(((currentF / total) * 100).toFixed(1)),
        nbPercentage: parseFloat(((currentNB / total) * 100).toFixed(1)),
        totalHeadcount: total
      });

      // Simulate historical drift: Decrease male dominancy organically via hiring funnel shifts
      const parityShift = total * 0.025; // 2.5% natural churn replacement
      if (currentM > total * 0.45) currentM -= parityShift; // Stop shifting if already at parity

      // Headcount grows slightly by 5% a year
      total = total * 1.05;
      currentF += (parityShift * 0.70) + (total * 0.05 * 0.55); // Over-index hiring women
      currentNB += (parityShift * 0.30) + (total * 0.05 * 0.10);
      currentM += (total * 0.05 * 0.35); // Under-index hiring men to fix ratio
    }

    return {
      baseline: projections[0],
      projections
    };
  }

  /**
   * Retrieves department level matrix breakdown
   */
  async getDepartmentMatrix() {
    // Only get the most recent snapshot for each department
    const snapshots = await DemographicSnapshot.aggregate([
      { $sort: { snapshotDate: -1 } },
      { $group: { _id: "$department", latest: { $first: "$$ROOT" } } }
    ]);

    if (!snapshots || snapshots.length === 0) return [];

    return snapshots.map(group => {
      const s = group.latest;
      return {
        department: s.department,
        totalHeadcount: s.totalHeadcount,
        leadershipFemalePct: Math.floor((s.leadershipFemaleRepresentation / (s.leadershipHeadcount || 1)) * 100),
        leadershipUrmPct: Math.floor((s.leadershipUnderrepresented / (s.leadershipHeadcount || 1)) * 100),
        metrics: {
          white: Math.floor((s.ethnicityWhite / s.totalHeadcount) * 100) || 0,
          asian: Math.floor((s.ethnicityAsian / s.totalHeadcount) * 100) || 0,
          black: Math.floor((s.ethnicityBlack / s.totalHeadcount) * 100) || 0,
          hispanic: Math.floor((s.ethnicityHispanic / s.totalHeadcount) * 100) || 0,
          other: Math.floor((s.ethnicityOther / s.totalHeadcount) * 100) || 0
        },
        attritionRisk: s.annualAttritionRate,
        inclusionScore: s.overallInclusionIndex || 85 // mock default
      };
    }).sort((a, b) => b.totalHeadcount - a.totalHeadcount);
  }

  /**
   * Retrieve historical inclusion survey scores globally
   */
  async getInclusionTrends() {
    const scores = await InclusionSurveyMetric.find({}).sort({ quarter: 1 }).lean();
    // Group by quarter mapping averages
    const trendMap = {};
    scores.forEach(s => {
      if (!trendMap[s.quarter]) {
        trendMap[s.quarter] = { belonging: 0, fairness: 0, voice: 0, items: 0 };
      }
      trendMap[s.quarter].belonging += s.belongingScore;
      trendMap[s.quarter].fairness += s.fairnessScore;
      trendMap[s.quarter].voice += s.voiceScore;
      trendMap[s.quarter].items++;
    });

    return Object.keys(trendMap).map(q => ({
      quarter: q,
      belonging: Math.round(trendMap[q].belonging / trendMap[q].items),
      fairness: Math.round(trendMap[q].fairness / trendMap[q].items),
      voice: Math.round(trendMap[q].voice / trendMap[q].items),
    }));
  }

  /**
   * Seed massive mock Diversity Data to simulate an enterprise
   */
  async seedDemoData() {
    await DemographicSnapshot.deleteMany({});
    await InclusionSurveyMetric.deleteMany({});

    const depts = ['Engineering', 'Product', 'Sales', 'Marketing', 'Executive', 'Legal', 'Customer Success', 'Finance'];
    const mocks = [];
    const surveys = [];

    const today = new Date();

    depts.forEach(dept => {
      const isTech = dept === 'Engineering' || dept === 'Product';
      const headcount = isTech ? 1200 : (dept === 'Executive' ? 80 : 350);
      const maleRate = isTech ? 0.72 : 0.48; // Big Tech bro culture heuristic
      const whiteAsnRate = isTech ? 0.85 : 0.65;

      mocks.push({
        department: dept,
        snapshotDate: today,
        totalHeadcount: headcount,

        genderMale: Math.floor(headcount * maleRate),
        genderFemale: Math.floor(headcount * (1 - maleRate - 0.04)),
        genderNonBinary: Math.floor(headcount * 0.04),

        ethnicityWhite: Math.floor(headcount * (whiteAsnRate * 0.6)),
        ethnicityAsian: Math.floor(headcount * (whiteAsnRate * 0.4)),
        ethnicityBlack: Math.floor(headcount * ((1 - whiteAsnRate) * 0.5)),
        ethnicityHispanic: Math.floor(headcount * ((1 - whiteAsnRate) * 0.4)),
        ethnicityIndigenous: Math.floor(headcount * ((1 - whiteAsnRate) * 0.1)),
        ethnicityOther: 0,

        genZ: Math.floor(headcount * 0.2),
        millennial: Math.floor(headcount * 0.5),
        genX: Math.floor(headcount * 0.25),
        boomer: Math.floor(headcount * 0.05),

        leadershipHeadcount: Math.floor(headcount * 0.12),
        leadershipFemaleRepresentation: Math.floor(headcount * 0.12 * (isTech ? 0.18 : 0.45)),
        leadershipUnderrepresented: Math.floor(headcount * 0.12 * (isTech ? 0.08 : 0.25)),

        annualAttritionRate: isTech ? 18.5 : 12.0,
        diversityHiringFunnelRate: isTech ? 25.0 : 45.0
      });

      // Survey generations for last 4 quarters
      ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'].forEach(q => {
        // Tech depts often score lower on inclusion based on industry benchmarks
        const inclusionPenalty = isTech ? -12 : 5;
        surveys.push({
          department: dept,
          quarter: q,
          belongingScore: Math.floor(Math.random() * 10) + 70 + inclusionPenalty,
          fairnessScore: Math.floor(Math.random() * 10) + 75 + inclusionPenalty,
          voiceScore: Math.floor(Math.random() * 10) + 72 + inclusionPenalty,
          overallInclusionIndex: Math.floor(Math.random() * 10) + 72 + inclusionPenalty
        });
      });
    });

    await DemographicSnapshot.insertMany(mocks);
    await InclusionSurveyMetric.insertMany(surveys);
    return { recordsSeeded: mocks.length + surveys.length };
  }
}

module.exports = new DiversityService();
