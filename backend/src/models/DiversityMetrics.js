const mongoose = require('mongoose');

const DemographicSnapshotSchema = new mongoose.Schema({
  department: { type: String, required: true, index: true },
  snapshotDate: { type: Date, required: true },

  // Aggregate Metrics
  totalHeadcount: { type: Number, required: true },

  // Gender Representation
  genderMale: { type: Number, default: 0 },
  genderFemale: { type: Number, default: 0 },
  genderNonBinary: { type: Number, default: 0 },
  genderUndisclosed: { type: Number, default: 0 },

  // Ethnicity Representation 
  ethnicityWhite: { type: Number, default: 0 },
  ethnicityAsian: { type: Number, default: 0 },
  ethnicityBlack: { type: Number, default: 0 },
  ethnicityHispanic: { type: Number, default: 0 },
  ethnicityIndigenous: { type: Number, default: 0 },
  ethnicityOther: { type: Number, default: 0 },

  // Generational Representation
  genZ: { type: Number, default: 0 },
  millennial: { type: Number, default: 0 },
  genX: { type: Number, default: 0 },
  boomer: { type: Number, default: 0 },

  // Leadership Specific (Manager and above)
  leadershipHeadcount: { type: Number, default: 0 },
  leadershipFemaleRepresentation: { type: Number, default: 0 }, // Nominal count
  leadershipUnderrepresented: { type: Number, default: 0 }, // Nominal count

  // Attrition & Hiring vectors (predictive triggers)
  annualAttritionRate: { type: Number, default: 0 },
  diversityHiringFunnelRate: { type: Number, default: 0 }
}, { timestamps: true });

DemographicSnapshotSchema.index({ department: 1, snapshotDate: -1 });
DemographicSnapshotSchema.index({ snapshotDate: 1 });

const InclusionSurveyMetricSchema = new mongoose.Schema({
  department: { type: String, required: true },
  quarter: { type: String, required: true }, // e.g. Q3-2026

  belongingScore: { type: Number, min: 0, max: 100 },
  fairnessScore: { type: Number, min: 0, max: 100 },
  voiceScore: { type: Number, min: 0, max: 100 },
  overallInclusionIndex: { type: Number, min: 0, max: 100 }
});

InclusionSurveyMetricSchema.index({ department: 1, quarter: 1 }, { unique: true });

module.exports = {
  DemographicSnapshot: mongoose.model('DemographicSnapshot', DemographicSnapshotSchema),
  InclusionSurveyMetric: mongoose.model('InclusionSurveyMetric', InclusionSurveyMetricSchema)
};
