# Algorithm Changelog

## 2.1 Threshold source

- **Before:** Relevance scoring imported duplicate `DEFAULTS` thresholds while the worker used `PARAMS`.
- **After:** `core/params.js` exports the sole threshold source in `PARAMS`, including `MIN_PAGE_TOKENS`.
- **Status:** Threshold values and all subsequent threshold values remain provisional until tuning is repeated on real labeled data.

## 2.2 Question-word stopwords

- **Before:** Question words and auxiliary words such as "what", "how", "does", and "when" remained in TF-IDF documents.
- **After:** Those words are removed deterministically; no topic-generic web vocabulary was added.

## 2.3 Off-topic page terms

- **Before:** Terms outside the deck vocabulary did not contribute to the page vector norm.
- **After:** Unseen page terms contribute with the deck's maximum IDF. Dot product remains over deck vocabulary terms. `normalizeOffTopic: false` restores the old comparison behavior.
- **Provisional threshold change:** Initial grid tuning on the existing sample found `T_HI=0.10`, `T_LO=0.00`; the thresholds were raised to `T_HI=0.15`, `T_LO=0.05` to reduce a false related match for a single shared term. The 6-row sample is not real labeled data.

## 2.4 Deterministic stemmer

- **Before:** Every token ending in `s` was reduced to remove the last character, producing `class -> clas`, `classes -> classe`, `process -> proces`, and `processes -> processe`.
- **After:** `sses` plurals remove `es`, while final `s` is preserved after `ss`, `us`, and `is`. `class`/`process`/`analysis` remain intact and their plural forms map deterministically to the singular.

## 2.5 SM-2 base interval

- **Before:** `card.interval` stored both the plain SM-2 chain interval and the exposure-adjusted interval, allowing credit to compound on later reviews.
- **After:** `card.baseInterval` holds the unadjusted chain; `card.interval` holds the final adjusted/due interval. Missing `baseInterval` values migrate to the stored `interval`.
- **Deadline behavior:** The exam-date cap is allowed to reduce the interval below the base interval.
