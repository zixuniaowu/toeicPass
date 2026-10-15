Source data for `build-lookup-dict.ts` (generates `data/lookup/en.json` + `data/lookup/ja.json`).
- mt-*.json: machine-translation cache (MyMemory), reviewed; `*-over.txt` are hand-written corrections (word=meaning) and win over MT.
- IPA comes from CMUdict (American, converted ARPAbet→IPA); acronyms are spelled letter by letter.
Run: `npx tsx apps/web/scripts/build-lookup-dict.ts` (downloads cmudict to /tmp if missing).
