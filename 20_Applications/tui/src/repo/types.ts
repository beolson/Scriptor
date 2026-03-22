import { z } from "zod";

export const repoSchema = z.object({
	owner: z.string().min(1),
	name: z.string().min(1),
});

export type Repo = z.infer<typeof repoSchema>;
