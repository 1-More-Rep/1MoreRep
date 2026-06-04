import { z } from 'zod';

// Mirrors the Prisma FeedbackCategory / FeedbackStatus enums (keep in sync).
export const FEEDBACK_CATEGORIES = ['FEATURE', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER'] as const;
export const FEEDBACK_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export type FeedbackCategoryT = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatusT = (typeof FEEDBACK_STATUSES)[number];

export const CATEGORY_LABEL: Record<FeedbackCategoryT, string> = {
  FEATURE: 'Feature request',
  BUG: 'Bug',
  IMPROVEMENT: 'Improvement',
  QUESTION: 'Question',
  OTHER: 'Other',
};

export const STATUS_LABEL: Record<FeedbackStatusT, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(5, 'Please add a little more detail (5+ characters).').max(2000, 'Keep it under 2000 characters.'),
});
