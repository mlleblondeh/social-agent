# Feedback Classification for Subplot

You're analyzing feedback from a beta tester of Subplot, an interactive romance fiction app. Classify this feedback to help prioritize product decisions.

## About Subplot
Subplot lets readers interact with fictional characters through AI-powered storytelling. Users pick tropes, make choices, and shape how relationships develop. Stories can continue indefinitely based on user choices.

## Feedback to Classify

**Source:** {{source}}
**User ID:** {{user_id}}
**User Type:** {{user_type}}
**Context:** {{context}}

**Feedback:**
```
{{content}}
```

## Classification Categories

### resonating
Things they love or get excited about.
**Signals:** enthusiastic language, "omg", "love this", "perfect", "exactly what I wanted", repeat usage, sharing with others

### confusing
Friction points, misunderstandings, "how do I..." questions.
**Signals:** questions about functionality, "I thought it would...", hesitation, uncertainty

### missing
Feature requests, gaps between expectation and reality.
**Signals:** "I wish", "would be cool if", comparisons to other products, workarounds

### breaking
Bugs, errors, things that don't work.
**Signals:** "didn't work", frustration, error descriptions, abandonment

## Product Areas

- `onboarding` - First-time experience, understanding what Subplot is
- `narrative-engine` - Story generation, coherence, quality
- `character-system` - Character behavior, consistency, personality
- `trope-selection` - Choosing and customizing tropes
- `story-memory` - Remembering previous choices, continuity
- `pacing` - Story speed, buildup, tension
- `ui-ux` - Interface, navigation, ease of use
- `endings` - Story conclusions, satisfaction
- `general` - Overall experience, not specific to one area

## Your Task

Classify this feedback and extract actionable insights.

Return ONLY a JSON object:

```json
{
  "category": "confusing",
  "subcategory": "story-memory",
  "sentiment": "frustrated",
  "intensity": "medium",
  "product_area": "narrative-engine",
  "extracted_insight": "Story not retaining trope preferences across sessions",
  "key_quote": "it forgot I wanted slow burn",
  "is_actionable": true,
  "is_specific": true,
  "noise_score": 0.2,
  "pattern_type": "expectation-gap"
}
```

## Field Definitions

- **category**: resonating | confusing | missing | breaking
- **subcategory**: more specific issue within category
- **sentiment**: excited | positive | neutral | confused | frustrated | negative
- **intensity**: high | medium | low (how strongly do they feel)
- **product_area**: which part of the product this relates to
- **extracted_insight**: one-line summary of the core feedback
- **key_quote**: most representative quote from their feedback
- **is_actionable**: can we do something about this?
- **is_specific**: is it detailed enough to act on?
- **noise_score**: 0.0 (signal) to 1.0 (noise) - is this vague/unhelpful?
- **pattern_type**: expectation-gap | comparison-anchor | aha-moment | churn-signal | advocacy-signal | null

## Noise Indicators (high noise_score)
- Very short, vague responses ("it's okay", "cool")
- No specific details
- Contradictory statements
- Off-topic feedback

Return ONLY the JSON object, no other text.
