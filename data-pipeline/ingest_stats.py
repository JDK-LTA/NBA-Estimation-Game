"""Phase 1 data ingestion (TDD.md section 11).

Reads stats from stats.nba.com via nba_api (cached on disk) and writes the
static dataset the React app and the puzzle generator consume:

    public/data/players.json          bios for every player referenced by a stat row
    public/data/stats/{category}.json PlayerStatValue rows, one file per stat category
    public/data/meta.json             provenance (when it was generated, coverage)

Usage:
    py ingest_stats.py            # reuse cached API responses where possible
    py ingest_stats.py --refresh  # re-fetch everything from nba_api
"""

import argparse
import datetime
import json
import math

from config import (
    CAREER_INGEST_RANK_CAP,
    CAREER_MIN_GAMES,
    DATA_DIR,
    MIN_MINUTES_PER_GAME,
    PLAYER_IMAGES_DIR,
    PLAYOFFS_MIN_GP,
    REGULAR_SEASON_MIN_GP_FRACTION,
    SEASON_INGEST_RANK_CAP,
    SEASON_TYPE_BY_SCOPE,
    SEASONS,
    STAT_AVAILABILITY_START_YEAR,
    STAT_CATEGORIES,
)
from nba_client import fetch_career_totals, fetch_player_index, fetch_season_player_stats


def competition_ranks(values):
    """Rank values descending; ties share the best rank (1, 2, 2, 4, ...)."""
    order = sorted(values, reverse=True)
    first_position = {}
    for position, value in enumerate(order, start=1):
        first_position.setdefault(value, position)
    return [first_position[value] for value in values]


def qualified_rows(rows, scope):
    """Rows meeting the games/minutes filters, plus the season's maximum games played."""
    if not rows:
        return [], 0
    season_games = max(row["GP"] for row in rows)
    if scope == "season":
        min_games = math.ceil(season_games * REGULAR_SEASON_MIN_GP_FRACTION)
    else:
        min_games = PLAYOFFS_MIN_GP
    qualified = [
        row
        for row in rows
        if row["GP"] >= min_games and row["MIN"] >= MIN_MINUTES_PER_GAME
    ]
    return qualified, season_games


def meets_qualifier(row, category, scope, season_games):
    """Percentages need enough made shots; per-game stats have no extra minimum."""
    qualifier = category.get("qualifier")
    if not qualifier:
        return True
    if scope == "season":
        minimum = qualifier["season_min"] * season_games / 82
    else:
        minimum = qualifier["playoffs_min"]
    # Per-game makes are rounded to 0.1, so this total is accurate to a few shots.
    return row[qualifier["made_column"]] * row["GP"] >= minimum


def build_season_values(refresh):
    """PlayerStatValue rows for season + playoffs scopes, plus each player's teams."""
    stat_values = {key: [] for key in STAT_CATEGORIES}
    names = {}
    teams = {}  # player id -> teams in chronological order of first appearance

    for season in SEASONS:
        for scope in SEASON_TYPE_BY_SCOPE:
            all_rows = fetch_season_player_stats(season, scope, refresh=refresh)
            rows, season_games = qualified_rows(all_rows, scope)
            print(f"  {season} {scope:<8} {len(rows):>3} qualified players")

            for category_key, category in STAT_CATEGORIES.items():
                column = category["nba_column"]
                scale = category.get("scale", 1)
                category_rows = [row for row in rows if meets_qualifier(row, category, scope, season_games)]
                values = [round(float(row[column]) * scale, 1) for row in category_rows]
                for row, value, rank in zip(category_rows, values, competition_ranks(values)):
                    if rank > SEASON_INGEST_RANK_CAP or value <= 0:
                        continue
                    player_id = str(row["PLAYER_ID"])
                    names[player_id] = row["PLAYER_NAME"]
                    team = row["TEAM_ABBREVIATION"]
                    player_teams = teams.setdefault(player_id, [])
                    if team and team not in player_teams:
                        player_teams.append(team)
                    stat_values[category_key].append(
                        {
                            "playerId": player_id,
                            "categoryKey": category_key,
                            "scope": scope,
                            "season": season,
                            "value": value,
                            "leaderboardRank": rank,
                        }
                    )
    return stat_values, names, teams


def build_career_values(refresh, index_by_id):
    """PlayerStatValue rows for career scope (regular season, all time)."""
    grids = fetch_career_totals(refresh=refresh)
    games = {row["PLAYER_ID"]: row["GP"] for row in grids["GPLeaders"]}
    names = {str(row["PLAYER_ID"]): row["PLAYER_NAME"] for row in grids["GPLeaders"]}
    stat_values = {}

    for category_key, category in STAT_CATEGORIES.items():
        column = category["nba_column"]
        first_valid_year = STAT_AVAILABILITY_START_YEAR.get(category_key)

        if category.get("career_percent"):
            # The all-time grid already holds career percentages as fractions.
            figures = {row["PLAYER_ID"]: row[column] for row in grids[f"{column}Leaders"]}

            def career_value(player_id, player_games, figures=figures):
                return round(figures[player_id] * category["scale"], 1)

        else:
            figures = {row["PLAYER_ID"]: row[column] for row in grids[f"{column}Leaders"]}

            def career_value(player_id, player_games, figures=figures):
                return round(figures[player_id] / player_games, 1)

        candidates = []
        for player_id, player_games in games.items():
            if player_games < CAREER_MIN_GAMES or (figures.get(player_id) or 0) <= 0:
                continue
            if first_valid_year is not None:
                bio = index_by_id.get(str(player_id))
                if not bio or int(bio["FROM_YEAR"]) < first_valid_year:
                    continue
            candidates.append((player_id, career_value(player_id, player_games)))

        ranks = competition_ranks([value for _, value in candidates])
        stat_values[category_key] = [
            {
                "playerId": str(player_id),
                "categoryKey": category_key,
                "scope": "career",
                "season": None,
                "value": value,
                "leaderboardRank": rank,
            }
            for (player_id, value), rank in zip(candidates, ranks)
            if rank <= CAREER_INGEST_RANK_CAP
        ]
        print(f"  career {category_key:<6} {len(stat_values[category_key]):>4} players")
    return stat_values, names


def career_year(bio, column):
    """Start year of a player's first/last season (e.g. 2002 for 2002-03), or None if unknown."""
    try:
        return int(bio[column])
    except (TypeError, KeyError, ValueError):
        return None


def build_players(player_ids, names, teams, index_by_id):
    players = []
    for player_id in sorted(player_ids, key=int):
        bio = index_by_id.get(player_id)
        full_name = f"{bio['PLAYER_FIRST_NAME']} {bio['PLAYER_LAST_NAME']}".strip() if bio else names[player_id]
        has_photo = (PLAYER_IMAGES_DIR / f"{player_id}.png").exists()
        players.append(
            {
                "id": player_id,
                "fullName": full_name,
                "photoUrl": f"images/players/{player_id}.png" if has_photo else None,
                "photoAttribution": "NBA.com" if has_photo else None,
                "position": (bio or {}).get("POSITION") or None,
                "teams": teams.get(player_id, []),
                "firstYear": career_year(bio, "FROM_YEAR"),
                "lastYear": career_year(bio, "TO_YEAR"),
            }
        )
    return players


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, separators=(",", ":"), ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="Ingest NBA stats into static JSON.")
    parser.add_argument("--refresh", action="store_true", help="bypass the response cache")
    args = parser.parse_args()

    print("Player index...")
    index_by_id = {str(row["PERSON_ID"]): row for row in fetch_player_index(refresh=args.refresh)}

    print("Season + playoffs leaderboards...")
    season_values, season_names, teams = build_season_values(args.refresh)

    print("Career leaderboards...")
    career_values, career_names = build_career_values(args.refresh, index_by_id)

    names = {**career_names, **season_names}
    player_ids = set()
    for category_key in STAT_CATEGORIES:
        rows = season_values[category_key] + career_values[category_key]
        player_ids.update(row["playerId"] for row in rows)
        write_json(DATA_DIR / "stats" / f"{category_key}.json", rows)

    players = build_players(player_ids, names, teams, index_by_id)
    write_json(DATA_DIR / "players.json", players)

    write_json(
        DATA_DIR / "meta.json",
        {
            "generatedAt": datetime.date.today().isoformat(),
            "firstSeason": SEASONS[0],
            "lastSeason": SEASONS[-1],
            "playerCount": len(players),
        },
    )
    print(f"Wrote {len(players)} players and {len(STAT_CATEGORIES)} stat files to {DATA_DIR}")


if __name__ == "__main__":
    main()
