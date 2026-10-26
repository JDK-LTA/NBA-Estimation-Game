"""Cached, retrying wrappers around the nba_api endpoints this project uses.

Every call goes through `get_or_fetch`, so re-running ingestion never re-hits
stats.nba.com unless `refresh=True` (TDD.md 3.4, Risks #1).
"""

import time

from nba_api.stats.endpoints import alltimeleadersgrids, leaguedashplayerstats, playerindex

from cache_utils import get_or_fetch
from config import SEASON_TYPE_BY_SCOPE, SEASONS

REQUEST_PAUSE_SECONDS = 1.0
MAX_ATTEMPTS = 4


def _with_retries(call):
    """stats.nba.com intermittently answers with an HTML error page; back off and retry."""
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            result = call()
            time.sleep(REQUEST_PAUSE_SECONDS)
            return result
        except Exception as error:  # nba_api raises JSON/HTTP/timeout errors of many types
            last_error = error
            time.sleep(3 * attempt)
    raise RuntimeError(f"nba_api call failed after {MAX_ATTEMPTS} attempts: {last_error!r}")


def fetch_season_player_stats(season: str, scope: str, refresh: bool = False):
    """Per-game stats for every player in one season (regular season or playoffs)."""
    if scope not in SEASON_TYPE_BY_SCOPE:
        raise ValueError(f"scope must be one of {list(SEASON_TYPE_BY_SCOPE)}, got {scope!r}")

    def _fetch():
        def call():
            response = leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                season_type_all_star=SEASON_TYPE_BY_SCOPE[scope],
                per_mode_detailed="PerGame",
                timeout=60,
            )
            return response.get_data_frames()[0].to_dict(orient="records")

        return _with_retries(call)

    return get_or_fetch(f"dash_{scope}_{season}", _fetch, refresh=refresh)


def fetch_career_totals(refresh: bool = False):
    """All-time regular-season career totals for every player, keyed by dataset name.

    Returns e.g. {"PTSLeaders": [{"PLAYER_ID": ..., "PTS": ...}, ...], "GPLeaders": [...]}.
    """

    def _fetch():
        def call():
            # topx is far above the number of players in history, so everyone is returned.
            response = alltimeleadersgrids.AllTimeLeadersGrids(
                per_mode_simple="Totals",
                season_type="Regular Season",
                topx=10000,
                timeout=120,
            )
            return response.get_normalized_dict()

        return _with_retries(call)

    return get_or_fetch("career_totals_all_time", _fetch, refresh=refresh)


def fetch_player_index(refresh: bool = False):
    """Bio info (name, position, first/last season) for every player in history."""

    def _fetch():
        def call():
            response = playerindex.PlayerIndex(
                historical_nullable="1",
                season=SEASONS[-1],
                timeout=60,
            )
            return response.get_data_frames()[0].to_dict(orient="records")

        return _with_retries(call)

    return get_or_fetch("player_index_all", _fetch, refresh=refresh)
