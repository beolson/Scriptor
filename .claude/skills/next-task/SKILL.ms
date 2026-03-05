---
name: next-task
description: Work the next pending task from the current phase. Use ONLY when the user explicitly invokes this skill (e.g. "/next-task" or "work the next task"). Do NOT invoke automatically.
disable-model-invocation: true
---

# NextTask

## Workflow

1. **Find the current phase**: Scan `spec/` for directories matching `phase{N}`. The current phase = the highest N found. All paths below use `spec/phase{N}/`.

2. **Find the task**: Open `spec/phase{N}/tasks.md`. Scan from the top for the first task with status `not started` or `in progress`. Update its status to `in progress`.

3. **Understand the task**:
   - Read the task's Description carefully.
   - If the status was already `in progress`, read the Implementation Notes and Next Steps to understand current progress before writing any code.

4. **Implement the task**:
   - Adhere strictly to the tech stack in `spec/phase{N}/tech-standards.md`. Do not introduce libraries, tools, or patterns not listed there without explicit user permission.
   - Stay within the scope of the current task only. Do not implement features belonging to future tasks.
   - Follow the functional requirements in `spec/phase{N}/FunctionalRequirements.md` as they apply to this task's scope.
   - For tasks marked "Use TDD": write failing tests first (red), then implement until tests pass (green).

5. **Update implementation notes**: As you work, keep the task's Implementation Notes current. Include:
   - Sub-steps completed
   - Files created, modified, or deleted and a brief description of each change

6. **If blocked or incomplete**: Before stopping, add a `Next Steps` section to the task describing:
   - What remains to be done, OR
   - What question needs to be answered by the user (word it so the question can be re-asked in a fresh session)

7. **Stop after one task**: Once the current task is complete, update its status to `completed` and stop. Do not begin the next task.