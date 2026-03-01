---
name: next-task
description: Work the next pending task from spec/tasks.md. Use ONLY when the user explicitly invokes this skill (e.g. "/next-task" or "work the next task"). Do NOT invoke automatically.
---

# NextTask

## Workflow

1. **Find the task**: Open `spec/tasks.md`. Scan from the top for the first task with status `not started` or `in progress`. Update its status to `in progress`.

2. **Understand the task**:
   - Read the task's Description carefully.
   - If the status was already `in progress`, read the Implementation Notes and Next Steps to understand current progress before writing any code.

3. **Implement the task**:
   - Adhere strictly to the tech stack in `spec/tech.md`. Do not introduce libraries, tools, or patterns not listed there without explicit user permission.
   - Stay within the scope of the current task only. Do not implement features belonging to future tasks.
   - Follow the functional requirements in `spec/requirements.md` as they apply to this task's scope.
   - For tasks marked "Use TDD": write failing tests first (red), then implement until tests pass (green).

4. **Update implementation notes**: As you work, keep the task's Implementation Notes current. Include:
   - Sub-steps completed
   - Files created, modified, or deleted and a brief description of each change

5. **If blocked or incomplete**: Before stopping, add a `Next Steps` section to the task describing:
   - What remains to be done, OR
   - What question needs to be answered by the user (word it so the question can be re-asked in a fresh session)

6. **Stop after one task**: Once the current task is complete, update its status to `completed` and stop. Do not begin the next task.