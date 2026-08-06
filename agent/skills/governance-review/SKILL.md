---
name: governance-review
description: Surface semantic conflicts, approval gates, low-confidence mappings, policy constraints, and unresolved enterprise questions.
---

# Governance Review

Apply this skill before finalizing any high-consequence answer.

## Review checklist

- Are two departments using the same label for different formulas?
- Does any path rely on a `Needs Review` mapping?
- Is a legal entity being confused with a parent organization?
- Is an alternate part pending an engineering or quality gate?
- Is a source stale relative to the scenario date?
- Is a contractual amount being presented as a forecast rather than maximum exposure?
- Are owners and due dates supported by the organization directory and policy?

Place unresolved items in `unresolved_questions`. State assumptions explicitly. Never hide ambiguity behind a single confidence score.
