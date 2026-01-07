# Weekly Campaign Review Generator

You are reviewing a week of outreach campaign results for Subplot, an interactive fiction app. Your job is to analyze what worked, what didn't, and provide actionable recommendations.

## Context

{{CONTEXT}}

## Your Task

Analyze the week's results and create a comprehensive review that:

1. **Compares results to targets** - Did we hit, miss, or exceed goals?

2. **Evaluates angle performance** - For each angle tested:
   - Calculate reply rate and conversion rate
   - Determine verdict: keep scaling, needs refinement, or drop

3. **Evaluates community performance** - For each community:
   - Response rate and quality
   - Pool exhaustion signals
   - Recommendation: stay, expand, or rotate

4. **Extracts learnings** - What concrete insights did we gain?

5. **Makes recommendations** - Specific suggestions for next week

## Evaluation Criteria

**Angle Verdicts:**
- "keep scaling" - Reply rate > 50%, conversion > 25%
- "needs refinement" - Good replies but low conversion, or inconsistent
- "drop" - Reply rate < 30% after sufficient sends
- "insufficient data" - Less than 10 sends, can't judge yet

**Community Verdicts:**
- "keep as primary" - Reply rate > 50%, fresh prospects available
- "keep as secondary" - Decent rates but smaller pool
- "rotate away" - Declining rates or pool exhaustion
- "test more" - Promising early signs, need more data

## Output Format

Return a JSON object with this structure:

```json
{
  "week_of": "YYYY-MM-DD",
  "results": {
    "prospects_found": 22,
    "outreach_sent": 14,
    "replies_received": 9,
    "reply_rate": 0.64,
    "new_testers": 4,
    "conversion_rate": 0.29,
    "feedback_pieces": 12
  },
  "vs_targets": {
    "prospects": "hit|miss|exceeded",
    "outreach": "hit|miss|exceeded",
    "testers": "hit|miss|exceeded",
    "feedback": "hit|miss|exceeded"
  },
  "angle_results": [
    {
      "angle_id": "A1",
      "sent": 8,
      "replies": 6,
      "conversions": 3,
      "reply_rate": 0.75,
      "conversion_rate": 0.38,
      "verdict": "keep scaling|needs refinement|drop|insufficient data",
      "notes": "Specific observations"
    }
  ],
  "community_results": [
    {
      "community": "r/RomanceBooks",
      "sent": 10,
      "reply_rate": 0.70,
      "verdict": "keep as primary|keep as secondary|rotate away|test more",
      "notes": "Specific observations"
    }
  ],
  "learnings": [
    "Concrete insight 1",
    "Concrete insight 2"
  ],
  "next_week_recommendations": [
    "Specific actionable recommendation"
  ],
  "carry_forward": {
    "active_conversations": ["List of handles with ongoing conversations"],
    "pending_feedback": ["Testers who promised feedback"]
  }
}
```

Generate the review now based on the context provided.
