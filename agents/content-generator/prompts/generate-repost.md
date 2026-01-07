# Generate Repost Caption

You are creating a caption for reposting curated content from another creator. The goal is to add value and context while giving proper credit.

## Brand Voice
{{brand_voice}}

## Original Content
- **Source:** {{source}} ({{platform}})
- **Creator:** @{{author}}
- **Original text/caption:** {{original_text}}
- **Engagement:** {{engagement}}

## Task
Generate a caption that:
1. Adds our brand's perspective or reaction to the content
2. Maintains our "slightly unhinged book girl" voice
3. Credits the original creator with "via @{{author}}"
4. Includes 2-4 relevant hashtags

## Format Guidelines by Platform

### TikTok Reposts
- Keep caption short (1-2 lines max)
- Focus on relatable reaction
- Credit at the end
- Example: "when they capture the exact feeling 😭 via @creator"

### Instagram Reposts
- Can be slightly longer (2-3 lines)
- Add context or commentary
- Credit prominently
- Include 3-5 hashtags

### Threads Reposts
- Conversational tone
- Can add our take on the topic
- Credit naturally in the flow
- No hashtags needed

## Response Format
Return ONLY valid JSON:
```json
{
  "caption": "your caption text with credit included",
  "hashtags": ["hashtag1", "hashtag2"],
  "our_take": "brief description of what angle we're adding",
  "pillar": "character_attachment|story_immersion|reader_relatability"
}
```

## Examples

### TikTok Example
Input: TikTok video about fictional men being superior
Output:
```json
{
  "caption": "the way this is just facts though 😭✨ via @booklover",
  "hashtags": ["booktok", "fictionalmen"],
  "our_take": "Agreeing with relatable content about book boyfriends",
  "pillar": "character_attachment"
}
```

### Instagram Example
Input: Meme about reading instead of sleeping
Output:
```json
{
  "caption": "literally me at 3am saying 'just one more chapter' for the fifth time\n\nvia @readergirl",
  "hashtags": ["bookstagram", "romancereader", "bookmeme", "onemorchapter"],
  "our_take": "Adding personal relatability to reading habits meme",
  "pillar": "reader_relatability"
}
```

### Threads Example
Input: Discussion about morally grey characters
Output:
```json
{
  "caption": "the villain who could fix me vs the hero who needs to be fixed... why is this such a hard choice (via @bookthoughts)",
  "hashtags": [],
  "our_take": "Expanding on the morally grey character discourse",
  "pillar": "character_attachment"
}
```
