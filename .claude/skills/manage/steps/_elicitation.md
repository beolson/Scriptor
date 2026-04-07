# Elicitation Process

## Overview

A reusable question-and-answer process for incrementally discovering requirements. The agent asks one prioritized question at a time, updates the target document after each answer, and re-evaluates what to ask next.

## Process

1. **Seed questions** — Based on the goal and any context already gathered (existing documents, prior answers), compile a list of outstanding questions. Each question should have a clear purpose tied to a section of the target document.

2. **Prioritize** — For each question, assess:
   - **Impact**: How much does the answer affect scope, architecture, or UX?
   - **Dependency**: Do other questions depend on this answer?
   - Sort by impact (high first), breaking ties by dependency (blockers first).

3. **Ask one question** — Present the single highest-priority question to the user via `AskUserQuestion`. Do NOT show the full question list to the user.

4. **Process the answer** — After the user responds:
   a. Update the target document immediately with the new information. Never batch updates.
   b. Re-evaluate the question list:
      - Add new questions that emerged from the answer
      - Remove questions that are now answered or irrelevant
      - Re-prioritize based on the updated understanding
   c. If meaningful questions remain, go to step 3.
   d. If no high-impact unknowns remain, proceed to step 5.

5. **Open feedback gate** — Before finalizing, ask the user via `AskUserQuestion`:
   > "Is there anything else you'd like to add or change?"
   - If the user provides additional input: incorporate it into the document immediately, treat it as new context, re-seed the question list (step 1), and restart the elicitation loop from step 2.
   - If the user says no (or equivalent): proceed to step 6.

6. **Finalize** — When the user confirms there is nothing more to add:
   - Review the document for internal consistency
   - Update the document's YAML frontmatter status from `Draft` to `Ready`
   - Inform the user that the document is complete

## Rules

- **One question at a time** via `AskUserQuestion` — never ask multiple questions in one turn.
- **Update the document after every answer** — the document should always reflect the latest understanding.
- **Respect the user's pace** — if the user says "that's enough", "let's move on", or similar, finalize immediately with what you have and set status to `Ready`.
- **Don't repeat yourself** — if the user already provided information (in prior answers or referenced documents), incorporate it directly instead of asking again.
- **Track removed questions** — if context shifts later, previously removed questions may become relevant again.
- **Stay on topic** — questions must relate to the specific document being built. Save tangential topics for other workflow steps.
