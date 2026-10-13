import { z } from "zod";

export const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  "Enter a valid UUID.",
);
