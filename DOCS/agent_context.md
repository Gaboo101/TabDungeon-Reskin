# TabDungeon: context for a new AI agent

Read this whole file before touching anything. It is a briefing written from the team's
conversations, NOT a description of the code. Where the code disagrees with this file, the
code wins: report the difference instead of silently "fixing" either one.

## 1. What this project is
TabDungeon is a Chrome Manifest V3 extension (vanilla JS ES modules, side panel UI) built by
three BSCS 3-6 students at Cavite State University for Software Engineering 2 (thesis-style
project). Roles: one developer (core logic), one designer who also runs surveys and
interviews, one documentation lead. Schedule (from the project plan): integration and bug
fixing until about Nov 23, 2026; user testing and surveys Nov 24 - Dec 7; final documentation
Dec 8 - Dec 21. Check the current date and the repo's state before assuming where we are.

## 2. How the project changed (important history)
- ORIGINAL: a gamified rogue-like focus tool. Tabs were classified "productive" or
  "distracting" (hand-written domain lists, regex, keyword counts), a dungeon canvas reacted
  (HP, XP, inventory), and a modified SM-2 flashcard system shortened intervals based on
  minutes spent "distracted".
- ADVISOR FEEDBACK (the reason for the pivot), treat as requirements:
  1. "Distracting" had no defined, computable measure (a lo-fi study playlist could be
     labeled distracting).
  2. No algorithm, training, process or evaluation behind the classification ("how was it
     computed? what training? how long?").
  3. Integration work (APIs, LLM wiring) is not what a CS thesis is graded on; the algorithm
     and the process are.
  4. The always-running dungeon animation could itself be a distraction.
  5. She asked about a button that simulates a run/session, and whether it was Pomodoro-like
     (it is not).
- CURRENT DESIGN: a flashcard-centered study helper for memory retention (details in section 3).
  The classifier no longer judges websites. The dungeon gameplay (HP, XP penalties,
  procedural rooms, inventory) was removed in favor of a light, effort-based game layer on
  card review.
- Documentation (proposal, SRS, project plan) still describes the OLD design in places
  (dungeon, productive/distracting, "popup" instead of side panel, Anthropic instead of
  Gemini, a "trained" classifier that was not trained). Do not treat those documents as
  the current spec. Do not edit them unless asked.

## 3. Current design and algorithms
- Decks by topic, each with an optional exam date. Cards appear ONLY when due: no popups, no
  overlays, no blocking, no mid-work interruptions.
- Scheduler: SM-2 modified with (a) capped "exposure credit" and (b) a deadline cap.
  - Exposure credit: time on pages related to a deck, from the ACTIVE focused tab only
    (not background tabs; idle time excluded; minimum dwell; same URL counts once per deck
    per day). Credit accumulates between reviews and is applied at the next SUCCESSFUL review
    (quality >= 3) as a capped multiplier on the interval. A failed recall discards the credit.
  - Deadline cap: when a deck has an exam date, interval <= (days to exam) / K, which
    overrides any exposure extension. Past exam date or no date: plain SM-2 plus capped credit.
  - A two-sided variant (low exposure shortens) exists only as a simulator variant. Default is
    one-sided (credit can only lengthen).
- Relevance scoring: TF-IDF cosine similarity between the active page's metadata (title,
  description, keywords, headings) and the deck's text, giving related / unrelated / uncertain.
  Only "related" earns credit. An optional small Naive Bayes or logistic stage may exist
  (relevance-model); verify in code whether it is trained and used.
- Simulation: a Simulate panel/page replays scripted visits and time-skips through the REAL
  scorer and scheduler (fake clock, seeded RNG, forgetting curve R = exp(-t/S)), comparing
  standard SM-2 vs the exposure-adjusted variants. A separate Node script runs batch and
  sensitivity simulations. Simulation encodes assumptions: it is FEASIBILITY evidence, not
  proof that memory improves.
- Evaluation plan (thesis evidence): relevance labels collected from people vs the old
  task-blind classifier as baseline (precision, recall, F1, confusion matrix, 5-fold CV,
  Cohen's/Fleiss' kappa for rater agreement); inference time under 200 ms; SUS for usability;
  a small pilot recall test if time allows. All parameters (thresholds, caps, gamma, K) are
  PROVISIONAL until tuned by simulation or labeled data.
- Main research question: does adapting SM-2 intervals using exposure to deck-related pages
  improve simulated retention or reduce review workload vs standard SM-2? A known weakness:
  user recall ratings may already capture what exposure adds. Never claim proven benefits.

## 4. Game layer (visual and effort-based; must never affect scheduling)
- Monsters = due cards. Tier from card difficulty (ease, lapses): t1, t2, t3, boss (leech).
- Recalled (quality >= 3): monster defeated, XP by tier. XP must NOT differ between Hard,
  Good and Easy (self-rating must not be rewarded). Again: monster "escapes", small effort XP.
  NEVER any hero HP loss, hurt animation, game-over or punishment.
- Level, daily streak (grace day), floor-cleared bonus, unlocks, adventure log. Rules are in
  pure modules with tests. The game depends on review events; the scheduler never imports game code.
- Settings: Game effects, Reduce motion, (planned) Ambient animation. Effects must never block
  the next card; max about 1.1 s.
- Art themes: "pixel_duo" (96px grid sheets, soldier + slime, both face left) and
  "tiny_swords" (Aseprite-style JSON + PNG: Warrior_Blue, Torch_Red goblin, Dead skull effect,
  tilemap scene; both face right; anchor-aligned; missing hurt/death handled with CSS or the
  Dead effect). Theme chosen by one constant in the asset map. Boss = crown icon + tint,
  NEVER fractional scaling.

## 5. Hard engineering rules (apply to every change)
1. Manifest V3: service worker keeps no state in memory that matters; persist in
   chrome.storage. No bundler, no frameworks, no new dependencies without approval.
2. Core logic modules (relevance, scheduler, params, game rules) are PURE: no chrome.*, no DOM,
   no Date.now (clock injected), deterministic, runnable in Node and in the Simulate panel.
3. All data stays local. Only the optional Gemini AI Guide may use the network. No remote
   fonts or images in new work. No page text stored; keep labels, scores, normalized URL or
   domain, timestamps only.
4. Do not change SM-2 math, TF-IDF math, thresholds, game rules or storage formats unless the
   task explicitly says so. Never alter tests' expected values to make them pass.
5. Pixel art: integer scales only, image-rendering: pixelated. No popups or overlays.
6. Keep every element ID or class that JS reads. grep before renaming or deleting.
7. Do not delete files or large blocks without listing them with evidence first.
8. UI text and docs must not claim the game improves memory or motivation.


## 6. How to work with this team
- Read first, report, then wait. Do not edit during the first task.
- Work in small phases with one commit each; stop after each phase and report: what changed,
  anything uncertain, bugs found (list, do not fix unless trivial), test results, a manual
  smoke-test checklist (you cannot run Chrome or see the UI; the team checks screenshots).
- Ask instead of guessing when a decision is product-level, affects the thesis claims, or
  changes behavior.
- Be honest in code comments and docs: label provisional values, simulations, and assumptions.
- The team will defend this project to a panel: prefer readable code and explainable logic over
  cleverness.