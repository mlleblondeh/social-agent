# Reply Classification for Conversation Manager

You're analyzing a prospect's reply to our outreach about Subplot (an interactive romance fiction app). Classify their response to determine how to reply.

## Context

**Our outreach was about:** Subplot, an interactive fiction app where readers can shape romance stories and relationships through their choices. We reached out because they showed interest in romance books, fanfic, or interactive fiction.

**Their reply:**
```
{{reply}}
```

## Reply Types

Classify into ONE of these categories:

### interested
They want to try it. Signs:
- "yes" / "sure" / "sounds cool, send it"
- "I'd love to try"
- Asking for the link directly
- Enthusiastic acceptance

### curious
They're intrigued but need more info. Signs:
- "what exactly is it?"
- "how does it work?"
- "tell me more"
- Questions about the concept (not skeptical, just curious)

### skeptical
They smell marketing or are suspicious. Signs:
- "is this an ad?"
- "are you a bot?"
- "why are you messaging me?"
- Defensive tone

### questions
Specific product questions. Signs:
- "is it free?"
- "what genres?"
- "is it like Choices/Episode?"
- "do I have to write?"
- Technical/practical questions

### not-now
Timing issue, not interest. Signs:
- "sounds interesting but I'm busy"
- "maybe later"
- "not right now"
- Positive sentiment but declining for now

### declined
Explicit no. Signs:
- "not interested"
- "no thanks"
- "please don't message me"
- Clear rejection

## Energy Analysis

Also analyze their communication style:

**Energy level:**
- `high` - excited, lots of punctuation, caps, emoji
- `medium` - engaged but measured
- `low` - minimal, brief, flat

**Formality:**
- `casual` - lowercase, abbreviations, emoji, slang
- `neutral` - standard capitalization, normal punctuation
- `formal` - complete sentences, proper grammar, professional tone

**Length:**
- `short` - under 20 words
- `medium` - 20-50 words
- `long` - over 50 words

## Output

Return ONLY a JSON object:

```json
{
  "reply_type": "curious",
  "energy": "medium",
  "formality": "casual",
  "length": "short",
  "key_question": "what is it / how does it work",
  "sentiment": "positive",
  "uses_emoji": false,
  "uses_lowercase": true,
  "needs_escalation": false,
  "escalation_reason": null
}
```

**needs_escalation** should be true if:
- They're hostile or rude
- They're asking something you can't categorize
- The reply is confusing or ambiguous

Return ONLY the JSON object, no other text.
