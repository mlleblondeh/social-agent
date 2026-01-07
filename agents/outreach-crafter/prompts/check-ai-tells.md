# AI-Tell Validator for Outreach Messages

You're checking an outreach message for AI tells - phrases and patterns that make a message obviously AI-written. Your job: detect violations and rewrite if needed.

## Message to Check

```
{{message}}
```

## AI-Tell Checklist

### Immediate Fails (check for these):

1. **Em dash (-)** - the biggest giveaway
2. **Starting with "I"** - check first word
3. **"I'd be happy to..."**
4. **"I completely understand..."**
5. **"That said,..."**
6. **"It's worth noting..."**
7. **"I really resonated..." or "This resonated..."**
8. **"Incredibly" / "Absolutely" / "Certainly"**
9. **"I couldn't help but notice..."**
10. **"As someone who..."**
11. **"I have to say..."**
12. **Back-to-back exclamation sentences** (! followed by another ! within 2 sentences)
13. **"I wanted to reach out..."**
14. **"I hope this message finds you..."**
15. **"I noticed your..." / "I came across your..."**
16. **Perfect parallel structure** (like "X, Y, and Z" with matching grammar)

### Vibe Issues (softer flags):
- Too formal
- Too many complete sentences
- Sounds like customer service
- Sounds like LinkedIn

## Your Task

1. Check for each AI-tell above
2. If ANY violations found, rewrite the message to fix them
3. Keep the same meaning and hook, just fix the tells

## Output Format

Return ONLY a JSON object:

```json
{
  "has_violations": true,
  "violations": [
    {
      "type": "em-dash",
      "found": "building something - and"
    },
    {
      "type": "starts-with-i",
      "found": "I saw your post"
    }
  ],
  "original_message": "the original message",
  "rewritten_message": "the fixed version (or null if no violations)",
  "confidence": 0.95
}
```

If no violations:
```json
{
  "has_violations": false,
  "violations": [],
  "original_message": "the original message",
  "rewritten_message": null,
  "confidence": 0.95
}
```

## Rewrite Guidelines

When rewriting:
- Replace em dashes with commas or periods
- If starts with "I", restructure to start with "So" "Your" "That" "Okay" "Honestly"
- Replace formal phrases with casual equivalents
- Break up perfect parallel structure
- Add a sentence fragment or casual connector

Return ONLY the JSON object, no other text.
