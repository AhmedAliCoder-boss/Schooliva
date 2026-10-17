import { z } from "zod";

export const roleAnnouncementSchema = z.object({
  roleSlugs: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  title: z.string().trim().min(1, "Add a notification title.").max(160),
  message: z.string().trim().min(1, "Add a notification message.").max(1200),
});

export const platformAnnouncementSchema = z.object({
  schoolIds: z.array(
    z.string().trim().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, "A selected school ID is invalid."),
  ).min(1, "Select at least one active school."),
  roleSlugs: z.array(z.string().trim().min(1).max(80)).min(1, "Choose at least one recipient role.").max(100),
  title: z.string().trim().min(1, "Add a notification title.").max(160),
  message: z.string().trim().min(1, "Add a notification message.").max(1200),
});
