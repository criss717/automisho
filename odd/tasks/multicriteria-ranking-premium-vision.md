# Feature Tasks: Multicriteria Pre-Ranking & Premium 8-10 Vision Advisory (Phase 2)

## Status
- Branch: `agent-version`
- Tracking: Complete
- Verification: Passed (tsx unit tests & pytest)

## Tasks
- [x] Task 1: Multicriteria Pre-ranking Matrix in `front/src/lib/chat-helpers.ts` (bodyType, fuel, minCv, purpose/viajes largos, colors in title, wantedMakes)
- [x] Task 2: Default 8-10 target count and "La Ñapa" (+1 bonus audit) in `front/src/app/api/chat/route.ts`
- [x] Task 3: Increase concurrency to 3 parallel calls (`batchSize = 3`) in `front/src/lib/vision-auditor.ts`
- [x] Task 4: Run unit and integration tests to verify pre-ranking, concurrency, and advisory rules
- [x] Task 5: Final review and work-unit commit
