// ──────────────────────────────────────────────────────────────────────────────
// Employee Survey & Pulse Check — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type QuestionType = 'LIKERT_5' | 'LIKERT_7' | 'YES_NO' | 'RATING_1_10' | 'OPEN_TEXT' | 'MULTIPLE_CHOICE' | 'NET_PROMOTER';
export type PulseQuestionType = 'EMOJI_1_5' | 'SLIDER_1_10' | 'YES_NO';
export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ANALYZING';
export type SurveyType = 'PULSE' | 'ENGAGEMENT' | 'ONBOARDING' | 'EXIT' | 'CUSTOM';
export type PulseStatus = 'ACTIVE' | 'CLOSED';
export type PulseSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'NO_DATA';

export interface SurveyQuestion {
  _id?: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  isRequired: boolean;
  category: string;
}

export interface Survey {
  _id: string;
  tenantId: string;
  title: string;
  description: string;
  type: SurveyType;
  questions: SurveyQuestion[];
  isAnonymous: boolean;
  targetDepartments: string[];
  targetAll: boolean;
  status: SurveyStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: { _id: string; name: string; email: string };
  responseCount: number;
  completionRate: number;
  createdAt: string;
}

export interface SurveyResponse {
  _id: string;
  surveyId: string;
  answers: Array<{
    questionId: string;
    questionText: string;
    questionType: string;
    value: number | string | boolean;
    textValue: string;
  }>;
  department: string;
  completionTime: number;
  submittedAt: string;
}

export interface PulseCheck {
  _id: string;
  tenantId: string;
  title: string;
  question: string;
  questionType: PulseQuestionType;
  status: PulseStatus;
  startDate: string;
  endDate: string | null;
  responseCount: number;
  avgScore: number;
  sentiment: PulseSentiment;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  avg: number;
  distribution: Record<number, number>;
  textResponses: string[];
}

export interface SurveyDashboard {
  totalSurveys: number;
  activeSurveys: number;
  totalPulseChecks: number;
  activePulseChecks: number;
  totalResponses: number;
  recentSurveys: Survey[];
  recentPulses: PulseCheck[];
}
