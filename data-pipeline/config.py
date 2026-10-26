"""Shared configuration for the data ingestion pipeline.

Mirrors the `StatCategory` / `DifficultyConfig` shapes from TDD.md section 6.
"""

import pathlib

# --- Paths -------------------------------------------------------------

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE_DIR = PROJECT_ROOT / "data-pipeline" / ".cache"
# Served as-is by Vite, so the React app can fetch `${BASE_URL}data/...`.
DATA_DIR = PROJECT_ROOT / "public" / "data"
PLAYER_IMAGES_DIR = PROJECT_ROOT / "public" / "images" / "players"


# --- Stat categories (TDD.md section 2.2) -------------------------------

# `nba_column` is the per-game column in LeagueDashPlayerStats output and the
# dataset prefix (e.g. "PTS" -> "PTSLeaders") in AllTimeLeadersGrids.
STAT_CATEGORIES = {
    "ppg": {
        "label": "Points Per Game",
        "unit": "PPG",
        "decimals": 1,
        "range_size": 10.0,
        "nba_column": "PTS",
    },
    "apg": {
        "label": "Assists Per Game",
        "unit": "APG",
        "decimals": 1,
        "range_size": 4.0,
        "nba_column": "AST",
    },
    "spg": {
        "label": "Steals Per Game",
        "unit": "SPG",
        "decimals": 1,
        "range_size": 1.0,
        "nba_column": "STL",
    },
    "bpg": {
        "label": "Blocks Per Game",
        "unit": "BPG",
        "decimals": 1,
        "range_size": 1.5,
        "nba_column": "BLK",
    },
    "rpg": {
        "label": "Rebounds Per Game",
        "unit": "RPG",
        "decimals": 1,
        "range_size": 6.0,
        "nba_column": "REB",
    },
    "3ptpg": {
        "label": "3-Pointers Made Per Game",
        "unit": "3PM/G",
        "decimals": 1,
        "range_size": 2.0,
        "nba_column": "FG3M",
    },
    # Percentage stats are stored as percent points (51.2, not 0.512). `qualifier` is
    # the made-shots minimum a season needs (the NBA's own leaderboard minimums,
    # scaled for shortened seasons); `career_percent` reads the all-time grid directly.
    "fgpct": {
        "label": "Field Goal %",
        "unit": "FG%",
        "decimals": 1,
        "range_size": 8.0,
        "nba_column": "FG_PCT",
        "scale": 100,
        "qualifier": {"made_column": "FGM", "season_min": 300, "playoffs_min": 60},
        "career_percent": True,
    },
    "3ppct": {
        "label": "3-Point %",
        "unit": "3P%",
        "decimals": 1,
        "range_size": 6.0,
        "nba_column": "FG3_PCT",
        "scale": 100,
        "qualifier": {"made_column": "FG3M", "season_min": 82, "playoffs_min": 15},
        "career_percent": True,
    },
    "ftpct": {
        "label": "Free Throw %",
        "unit": "FT%",
        "decimals": 1,
        "range_size": 10.0,
        "nba_column": "FT_PCT",
        "scale": 100,
        "qualifier": {"made_column": "FTM", "season_min": 125, "playoffs_min": 25},
        "career_percent": True,
    },
    "tovpg": {
        "label": "Turnovers Per Game",
        "unit": "TOV",
        "decimals": 1,
        "range_size": 2.0,
        "nba_column": "TOV",
    },
}


# --- Scopes (TDD.md section 2.3) ----------------------------------------

SEASON_TYPE_BY_SCOPE = {
    "season": "Regular Season",
    "playoffs": "Playoffs",
}

# LeagueDashPlayerStats only has data from 1996-97 onwards (older seasons
# return zero rows), so season/playoffs scopes cover this range. Career scope
# covers all-time via AllTimeLeadersGrids.
FIRST_SEASON_START_YEAR = 1996
LAST_SEASON_START_YEAR = 2025  # 2025-26 is the most recent completed season


def season_label(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[-2:]}"


SEASONS = [season_label(y) for y in range(FIRST_SEASON_START_YEAR, LAST_SEASON_START_YEAR + 1)]


# --- Eligibility (TDD.md section 2.4) -----------------------------------

# Gameplay default cutoffs live in the TS app. These caps are how deep the
# shipped datasets go, i.e. the highest value Infinite Mode can raise the
# cutoffs to.
SEASON_INGEST_RANK_CAP = 150
CAREER_INGEST_RANK_CAP = 750

# "Qualified" player filters, so tiny samples don't pollute the leaderboards.
REGULAR_SEASON_MIN_GP_FRACTION = 0.5  # of the most games anyone played that season
PLAYOFFS_MIN_GP = 5
MIN_MINUTES_PER_GAME = 10
CAREER_MIN_GAMES = 400


# --- Data availability guardrails (TDD.md Risks #3) ---------------------

# First NBA season (start year) in which the stat was officially tracked.
# Career totals for players who started earlier would be divided by games in
# which the stat wasn't recorded, so those players are excluded per category.
STAT_AVAILABILITY_START_YEAR = {
    "spg": 1973,
    "bpg": 1973,
    "3ptpg": 1979,
    "tovpg": 1977,
}
