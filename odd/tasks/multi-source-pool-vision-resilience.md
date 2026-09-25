# Feature Tasks: Multi-Source Pool Fusion & Vision Resilience (Phase 1)

## Status
- Branch: `agent-version`
- Tracking: Active

## Tasks
- [ ] Task 1: Unify and deduplicate car pools in `front/src/app/api/chat/route.ts` (combine agent results with high-speed scraper results, deduplicate by URL/title, balanced fair distribution)
- [ ] Task 2: Multi-image fallback and video resilience in `front/src/lib/vision-auditor.ts` (support candidate images list `[car.image_url, ...(car.images || [])]`, skip videos/broken images, fallback to 2nd/3rd photo)
- [ ] Task 3: Extract and preserve image galleries in `server/browser_worker/main.py` (extract multiple images per card into `images` list)
- [ ] Task 4: Run tests and verify the multi-source pool and vision fallback behavior
- [ ] Task 5: Final review and work-unit commit
