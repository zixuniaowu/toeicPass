# Official Question Pack Import

## Purpose
- The built-in repository questions are TOEIC-style practice items.
- For licensed official materials, place your authorized pack in a runtime file and the API will auto-load it.

## File path
- Default: `.runtime/question-bank-official-pack.json`
- Optional override: set `OFFICIAL_QUESTION_PACK_FILE` env var.

## JSON format
```json
{
  "questions": [
    {
      "partNo": 7,
      "skillTag": "reading-detail",
      "difficulty": 3,
      "stem": "Notice: ...\n\nWhat is mainly announced?",
      "explanation": "Why B is correct.",
      "options": [
        { "key": "A", "text": "..." },
        { "key": "B", "text": "..." },
        { "key": "C", "text": "..." },
        { "key": "D", "text": "..." }
      ],
      "correctKey": "B"
    }
  ]
}
```

## Notes
- Questions are validated with the same quality gate as built-in content.
- Part 1 needs image alignment; Part 5/6 require blanks (`___`); Part 7 needs passage context and question-form stem.
- Restart API after changing the official pack file.

## Current Official Sample Source (ST-05)
- Source pages (official IIBC/ETS licensed sample):
  - `https://www.iibc-global.org/toeic/test/lr/about/format/sample01.html`
  - `https://www.iibc-global.org/toeic/test/lr/about/format/sample02.html`
  - `https://www.iibc-global.org/toeic/test/lr/about/format/sample03.html`
  - `https://www.iibc-global.org/toeic/test/lr/about/format/sample04.html`
  - Reading sample PDF: `https://www.ets.org/content/dam/ets-org/pdfs/toeic/toeic-listening-reading-sample-test.pdf`
- Local mirrored listening media used by the app:
  - `apps/web/public/assets/audio/toeic-official/st05/`
- Local mirrored visuals used by the app:
  - `apps/web/public/assets/images/toeic-official/`

## Compliance
- The source pages explicitly state ETS copyright. Keep this content for licensed/internal learning usage.
- Do not redistribute official audio/image/question assets publicly without permission.
