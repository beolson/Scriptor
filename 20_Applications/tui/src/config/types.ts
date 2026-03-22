import { z } from "zod";

export const configSchema = z.object({
	repo: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;
