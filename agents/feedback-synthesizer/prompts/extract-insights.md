# Insight Extraction for Feedback Synthesis

You're synthesizing classified feedback from Subplot beta testers into actionable product insights. Look for patterns, themes, and prioritize what matters.

## Classified Feedback Batch

```json
{{feedback_items}}
```

## Your Task

Analyze this batch of feedback and identify the key themes/insights. Group related feedback, identify patterns, and provide actionable recommendations.

## Action Labels

| Label | When to Use | Urgency |
|-------|-------------|---------|
| `fix-now` | Breaking core experience, multiple users affected | This week |
| `fix-soon` | Significant friction, clear pattern | Next 2 weeks |
| `roadmap-consider` | Good idea, not urgent, nice-to-have | Backlog |
| `protect` | Working well, users love it, dont break it | Ongoing |
| `monitor` | Not enough signal yet, could be one-off | Watch |
| `ignore` | Noise, not actionable, conflicts with vision | Skip |

## Prioritization Factors

**Upweight:**
- Same issue from multiple users (pattern)
- High intensity language (strong feelings)
- Specific and actionable feedback
- From users who match ICP well
- Breaking or confusing category

**Downweight:**
- Single occurrence
- Vague feedback
- Low intensity
- Conflicts with core product vision

## Output Format

Return a JSON object with synthesized insights:

```json
{
  "insights": [
    {
      "theme": "Story forgets previous choices",
      "category": "confusing",
      "product_area": "story-memory",
      "evidence_count": 5,
      "intensity": "high",
      "sample_quotes": [
        "it forgot I wanted slow burn",
        "why did the character act like we just met"
      ],
      "user_ids": ["prospect-012", "prospect-023"],
      "product_implication": "Memory/continuity issues breaking immersion. Check context window handling and state persistence.",
      "action": "fix-soon",
      "confidence": 0.85
    }
  ],
  "patterns_detected": [
    {
      "type": "expectation-gap",
      "description": "Users expect story to remember all choices, but memory is limited",
      "frequency": 3
    }
  ],
  "category_summary": {
    "resonating": 8,
    "confusing": 5,
    "missing": 4,
    "breaking": 1
  },
  "top_priorities": [
    "Story memory continuity",
    "Character consistency"
  ]
}
```

## Guidelines

1. **Group similar feedback** - Don't create separate insights for the same issue from different users
2. **Be specific** - "Story memory issues" is better than "users are confused"
3. **Include evidence** - Back up insights with actual quotes
4. **Be actionable** - Product implications should suggest what to do
5. **Prioritize ruthlessly** - Not everything is fix-now

Return ONLY the JSON object, no other text.
