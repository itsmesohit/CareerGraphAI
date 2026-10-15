import { z } from 'zod';

export const CreateInterviewScheduleSchema = z.object({
  applicationId: z.string().min(1, 'applicationId is required'),
  roundName: z.string().min(1, 'roundName is required'),
  roundType: z.string().default('HR'),
  scheduledAt: z.string().datetime('Valid ISO-8601 scheduledAt is required'),
  durationMinutes: z.number().int().positive().default(45),
  meetingLink: z.string().url().optional().or(z.literal('')),
  interviewerNames: z.array(z.string()).default([]),
  notes: z.string().optional(),
  syncCalendar: z.boolean().default(false),
});
export type CreateInterviewScheduleInput = z.infer<typeof CreateInterviewScheduleSchema>;

export const UpdateInterviewScheduleSchema = z.object({
  roundName: z.string().min(1).optional(),
  roundType: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  interviewerNames: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});
export type UpdateInterviewScheduleInput = z.infer<typeof UpdateInterviewScheduleSchema>;

export type { InterviewScheduleDTO } from './application.js';
