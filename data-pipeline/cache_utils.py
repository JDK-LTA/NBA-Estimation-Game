"""A tiny JSON-file cache for raw API responses.

See TDD.md section 3.4 (Aggressive caching): every raw `nba_api` response
should be cached to disk as soon as it's fetched, *before* any processing,
so iterating on the ingestion/generation logic never re-hits the (unofficial,
rate-limitable - see Risks #1) API unless you explicitly ask for fresh data.
"""

import json
import re

from config import CACHE_DIR


def _safe_filename(cache_key: str) -> str:
    """Turn a cache key like "leaders ppg season 2023-24" into a safe filename."""
    return re.sub(r"[^A-Za-z0-9_-]+", "_", cache_key)


def get_or_fetch(cache_key: str, fetch_fn, refresh: bool = False):
    """Return cached data for `cache_key`, calling `fetch_fn()` only if needed.

    `fetch_fn` must return something JSON-serializable (e.g. a list of dicts).
    Pass `refresh=True` to bypass the cache and force a fresh API call.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{_safe_filename(cache_key)}.json"

    if cache_file.exists() and not refresh:
        with cache_file.open("r", encoding="utf-8") as f:
            return json.load(f)

    data = fetch_fn()

    with cache_file.open("w", encoding="utf-8") as f:
        json.dump(data, f)

    return data
