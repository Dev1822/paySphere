// ──────────────────────────────────────────────────────────────────────────────
// Employee Survey & Pulse Check — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
  Survey, PulseCheck, QuestionAnalytics, SurveyDashboard,
  SurveyStatus, PulseSentiment,
} from '../types/survey';

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const PEOPLE = [
  { _id: 'u1', name: 'Priya Sharma', email: 'priya@paysphere.com' },
  { _id: 'u2', name: 'Marcus Johnson', email: 'marcus@paysphere.com' },
  { _id: 'u3', name: 'Aisha Patel', email: 'aisha@paysphere.com' },
  { _id: 'u4', name: 'Sarah Kim', email: 'sarah@paysphere.com' },
  { _id: 'u5', name: 'David Okafor', email: 'david@paysphere.com' },
];

const SURVEY_TEMPLATES = [
  {
    title: 'Q3 2026 Employee Engagement Survey',
    description: 'Quarterly engagement pulse to measure satisfaction, alignment, and growth opportunities.',
    type: 'ENGAGEMENT' as const,
    questions: [
      { questionText: 'How satisfied are you with your current role?', questionType: 'LIKERT_5' as const, options: [], isRequired: true, category: 'satisfaction' },
      { questionText: 'Do you feel your work is meaningful?', questionType: 'LIKERT_5' as const, options: [], isRequired: true, category: 'purpose' },
      { questionText: 'How likely are you to recommend this company as a workplace?', questionType: 'NET_PROMOTER' as const, options: [], isRequired: true, category: 'advocacy' },
      { questionText: 'What could we do better?', questionType: 'OPEN_TEXT' as const, options: [], isRequired: false, category: 'feedback' },
    ],
  },
  {
    title: 'Remote Work Satisfaction Check',
    description: 'Quick pulse on remote work experience and tooling.',
    type: 'PULSE' as const,
    questions: [
      { questionText: 'How well do you collaborate with your team remotely?', questionType: 'LIKERT_5' as const, options: [], isRequired: true, category: 'collaboration' },
      { questionText: 'Do you have the right tools to work from home?', questionType: 'YES_NO' as const, options: [], isRequired: true, category: 'tools' },
      { questionText: 'Rate your work-life balance (1-10)', questionType: 'RATING_1_10' as const, options: [], isRequired: true, category: 'wellbeing' },
    ],
  },
  {
    title: 'New Hire Onboarding Experience',
    description: 'How was your first 30 days at PaySphere?',
    type: 'ONBOARDING' as const,
    questions: [
      { questionText: 'How welcome did you feel during onboarding?', questionType: 'LIKERT_5' as const, options: [], isRequired: true, category: 'welcome' },
      { questionText: 'Was the onboarding process clear and helpful?', questionType: 'YES_NO' as const, options: [], isRequired: true, category: 'process' },
      { questionText: 'Any suggestions for improving onboarding?', questionType: 'OPEN_TEXT' as const, options: [], isRequired: false, category: 'feedback' },
    ],
  },
];

const PULSE_QUESTIONS = [
  'How are you feeling about work today?',
  'How supported do you feel by your manager this week?',
  'How is your energy level this week?',
  'How confident are you about the company direction?',
  'How would you rate your team collaboration this week?',
];

const TEXT_RESPONSES = [
  'Great work environment, but need more clarity on career growth paths.',
  'Management communication could be improved during busy periods.',
  'Love the flexible work policy, it makes a real difference.',
  'Would appreciate more structured feedback sessions.',
  'The new project management tools are fantastic.',
  'Sometimes feel disconnected from the team during remote weeks.',
  'Benefits package is excellent, especially the health insurance.',
  'Would like to see more investment in learning and development.',
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function generateSurveys(count = 8): Survey[] {
  const statuses: SurveyStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED', 'ACTIVE', 'CLOSED'];

  return Array.from({ length: count }, (_, i) => {
    const template = SURVEY_TEMPLATES[i % SURVEY_TEMPLATES.length];
    const status = i < count ? pick(statuses) : 'ACTIVE';
    const dayOffset = rng(5, 60);

    return {
      _id: `survey-${i}`,
      tenantId: 'tenant-1',
      title: template.title,
      description: template.description,
      type: template.type,
      questions: template.questions.map((q, qi) => ({ ...q, _id: `q-${i}-${qi}` })),
      isAnonymous: Math.random() > 0.3,
      targetDepartments: [],
      targetAll: true,
      status,
      startDate: status !== 'DRAFT' ? daysAgo(dayOffset) : null,
      endDate: status === 'CLOSED' ? daysAgo(dayOffset - 14) : null,
      createdBy: pick(PEOPLE),
      responseCount: rng(5, 50),
      completionRate: rng(30, 95),
      avgCompletionTime: rng(120, 600),
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generatePulseChecks(count = 10): PulseCheck[] {
  const sentiments: PulseSentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_DATA'];

  return Array.from({ length: count }, (_, i) => {
    const dayOffset = rng(1, 30);
    const isActive = i < 4;
    const avgScore = rng(2, 5);
    const maxScore = 5;

    return {
      _id: `pulse-${i}`,
      tenantId: 'tenant-1',
      title: `Pulse: ${pick(PULSE_QUESTIONS).replace('?', '')}`,
      question: pick(PULSE_QUESTIONS),
      questionType: pick(['EMOJI_1_5', 'SLIDER_1_10', 'YES_NO'] as const),
      status: isActive ? 'ACTIVE' : 'CLOSED',
      startDate: daysAgo(dayOffset),
      endDate: isActive ? null : daysAgo(dayOffset - 7),
      responseCount: rng(10, 45),
      avgScore,
      sentiment: isActive
        ? (avgScore >= 4 ? 'POSITIVE' : avgScore >= 3 ? 'NEUTRAL' : 'NEGATIVE')
        : pick(sentiments),
      createdBy: pick(PEOPLE),
      createdAt: daysAgo(dayOffset),
    };
  });
}

export function generateQuestionAnalytics(): QuestionAnalytics[] {
  const questions = SURVEY_TEMPLATES[0].questions;
  return questions.map((q, i) => {
    const isNumeric = q.questionType !== 'OPEN_TEXT';
    return {
      questionId: `q-0-${i}`,
      questionText: q.questionText,
      questionType: q.questionType,
      totalResponses: rng(15, 40),
      avg: isNumeric ? rng(25, 80) / 10 : 0,
      distribution: isNumeric
        ? Object.fromEntries(Array.from({ length: 5 }, (_, j) => [j + 1, rng(2, 12)]))
        : {},
      textResponses: !isNumeric ? TEXT_RESPONSES.slice(0, rng(2, 5)) : [],
    };
  });
}

export function generateSurveyDashboard(): SurveyDashboard {
  return {
    totalSurveys: rng(10, 25),
    activeSurveys: rng(2, 5),
    totalPulseChecks: rng(15, 30),
    activePulseChecks: rng(3, 8),
    totalResponses: rng(200, 800),
    recentSurveys: generateSurveys(5),
    recentPulses: generatePulseChecks(5),
  };
}
