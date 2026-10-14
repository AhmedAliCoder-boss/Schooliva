import { z } from "zod";

export const roleAnnouncementSchema = z.object({
  roleSlugs: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  title: z.string().trim().min(1, "Add a notification title.").max(160),
  message: z.string().trim().min(1, "Add a notification message.").max(1200),
});
