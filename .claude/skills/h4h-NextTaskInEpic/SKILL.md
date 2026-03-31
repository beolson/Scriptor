---
name: h4h:NextTaskInEpic
description: Work the next pending task from an epic's delivery.md. Use ONLY when the user explicitly invokes this skill (e.g. "/h4h-NextTaskInEpic" or "work the next task"). Do NOT invoke automatically.
disable-model-invocation: true
---

# NextTaskInEpic

## Workflow

1. **Find the target epic**: Scan `10_Specifications/Epics/` for subdirectories matching `NNN_*` that contain a `delivery.md` with at least one task status of `not started` or `in progress`. If exactly one such epic exists, target it automatically. If multiple match, use `AskUserQuestion` to ask the user which one to work on.

2. **Find the task**: Open the target epic's `delivery.md`. Scan from the top for the first task with status `not started` or `in progress`. Update its status to `in progress`.

3. **Understand the task**:
   - Read the task's Description carefully.
   - If the status was already `in progress`, read the Implementation Notes and Next Steps to understand current progress before writing any code.

4. **Implement the task**:
   - Adhere strictly to the tech stack in the epic's `technical.md`. Do not introduce libraries, tools, or patterns not listed there without explicit user permission.
   - Stay within the scope of the current task only. Do not implement features belonging to future tasks.
   - Follow the functional requirements in the epic's `functional.md` as they apply to this task's scope.
   - For tasks marked "Use TDD": write failing tests first (red), then implement until tests pass (green).

5. **Update implementation notes**: As you work, keep the task's Implementation Notes current. Include:
   - Sub-steps completed
   - Files created, modified, or deleted and a brief description of each change

6. **If blocked or incomplete**: Before stopping, add a `Next Steps` section to the task describing:
   - What remains to be done, OR
   - What question needs to be answered by the user (word it so the question can be re-asked in a fresh session)

7. **Stop after one task**: Once the current task is complete, update its status to `completed` and stop. Do not begin the next task.
