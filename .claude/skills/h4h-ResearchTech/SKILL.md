---
name: research-tech
description: >
  Deep technical research with iterative human elicitation and structured output.
  Use this skill whenever the user wants to research, investigate, compare, or
  evaluate a technology, library, architecture pattern, or approach — especially
  when the outcome should inform a technical decision. Triggers on: "research X",
  "I want to investigate Y", "let's dig into Z", "compare these options",
  "how does X work", "should we use X or Y". Also triggers when the user references
  an existing 20_Research/ folder to continue or extend prior research. Always use
  this skill proactively when research is clearly the goal, even if the word
  "research" isn't used.
---

# Deep Research Skill

A structured research and elicitation workflow. The goal is to go deep on a topic,
surface what matters for the user's specific context, and produce reusable written
artifacts that capture the findings and reasoning.

---

## Workflow

### Step 1: Understand the Research Context

Before launching any research, clarify:
- What specifically is being researched? (technology, library, pattern, comparison)
- What decision does this research inform? (helps scope what matters)
- What constraints or context apply? (tech stack, team preferences, existing decisions)
- Is there an existing `15_Research/<slug>/` folder to continue from?

If continuing existing research, read the `research_summary.md` from that folder first
to restore full context before proceeding. Update both output files when done.

### Step 2: Initial Deep Research

Launch **2–3 parallel Explore agents** covering different angles of the topic. Think in terms of:
- How the technology/approach works under the hood
- How teams are using it in practice (real-world examples, tradeoffs)
- How it fits the user's specific constraints (tech stack, monorepo setup, etc.)

Synthesize the findings into a clear summary. Aim for depth, not just surface facts.

### Step 3: Proactive Elicitation

After presenting initial findings, **explicitly identify 3–5 open questions or angles**
worth investigating further. Present them as options:

> "Based on the initial research, here are the angles worth digging into:
> 1. How [X] handles [specific concern]
> 2. Whether [Y] is compatible with [constraint]
> 3. The tradeoffs between [A] and [B] in your context
> 4. ..."
>
> "Which of these do you want to go deeper on, or is there something else?"

This is the core elicitation loop — don't just wait for the human to ask questions.
Actively surface what you found that you didn't fully resolve.

### Step 4: Elicitation Loop

Repeat until the human signals they're done:
- Human picks an angle or asks a question
- Launch targeted Explore agents for that angle
- Synthesize and present findings
- Offer the next set of open questions

Good signals that the human is done: "that's enough", "write it up", "save the research",
"I think we have what we need", "create the folder".

### Step 5: Write Output

When triggered to write, create `15_Research/<slug>/` and write two files:

**Slug naming**: kebab-case, descriptive, 3–5 words. Conveys topic + key aspect.
Examples: `design-system-lit-react-architecture`, `api-gateway-options`, `auth-strategy-comparison`

#### `recommended.md`
The final recommendation with enough detail to act on:
- The recommended approach/stack/decision
- Key implementation details and code examples where relevant
- Why alternatives were not chosen (brief)
- All reference links (documentation, source repos, articles)
- Structured for someone who wants to implement, not just understand

#### `research_summary.md`
A complete record of everything researched — structured so the conversation can be
resumed in a future session:
- Date and research scope
- Every thread investigated (what was asked, what was found)
- Paths rejected and why (important — captures reasoning not visible in the recommendation)
- Open questions that weren't fully resolved
- Enough context that a future session can pick up without re-doing the research

The research_summary is NOT a summary of the recommendation. It's a record of the
research process itself — including dead ends, tradeoffs considered, and the
conversation that shaped the outcome.

---

## Quality Checklist

Before writing files, verify:
- [ ] The recommendation is specific enough to act on, not just a list of options
- [ ] All reference links are real and included
- [ ] Research summary captures rejected paths with reasoning
- [ ] Research summary has enough context to resume the conversation cold
- [ ] Slug name is descriptive and follows kebab-case

---

## Continuing Existing Research

When the user references an existing research folder:
1. Read `15_Research/<slug>/research_summary.md` to restore context
2. Continue the elicitation loop from where it left off
3. When writing, **update** both files rather than creating new ones
4. Append a dated section to `research_summary.md` for the new session's findings