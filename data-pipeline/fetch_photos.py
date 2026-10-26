"""Download player headshots so the app serves them itself (TDD.md 3.4, Risks #8).

By default only players that appear in generated puzzles are fetched; use
--all for every player in players.json (much larger). Re-runs skip photos that
already exist, and players with no real photo are remembered so they aren't retried.

Usage:
    py fetch_photos.py [--all] [--retry-missing]
"""

import argparse
import hashlib
import json
import time

import requests

from config import CACHE_DIR, DATA_DIR, PLAYER_IMAGES_DIR

PHOTO_URL = "https://cdn.nba.com/headshots/nba/latest/260x190/{player_id}.png"
MISSING_FILE = CACHE_DIR / "missing_photos.json"
REQUEST_PAUSE_SECONDS = 0.15
# The CDN serves one identical silhouette for players without a photo.
PLACEHOLDER_HASH_THRESHOLD = 4
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; the-range-game/1.0; local build tool)"}


def puzzle_player_ids():
    ids = set()
    for path in (DATA_DIR / "puzzles").glob("[0-9][0-9][0-9][0-9].json"):
        for puzzle in json.loads(path.read_text(encoding="utf-8")):
            for round_ in puzzle["rounds"]:
                ids.update(player["playerId"] for player in round_["players"])
    return ids


def download(session, player_id):
    response = session.get(PHOTO_URL.format(player_id=player_id), headers=HEADERS, timeout=20)
    if response.status_code != 200 or "image" not in response.headers.get("content-type", ""):
        return None
    return response.content if len(response.content) > 1000 else None


def main():
    parser = argparse.ArgumentParser(description="Download player headshots.")
    parser.add_argument("--all", action="store_true", help="fetch every player, not just puzzle players")
    parser.add_argument("--retry-missing", action="store_true", help="retry players previously marked as having no photo")
    args = parser.parse_args()

    players_path = DATA_DIR / "players.json"
    players = json.loads(players_path.read_text(encoding="utf-8"))
    wanted = {player["id"] for player in players} if args.all else puzzle_player_ids()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    PLAYER_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    missing = set() if args.retry_missing or not MISSING_FILE.exists() else set(json.loads(MISSING_FILE.read_text()))

    todo = sorted(
        (pid for pid in wanted if not (PLAYER_IMAGES_DIR / f"{pid}.png").exists() and pid not in missing), key=int
    )
    print(f"{len(wanted)} players wanted, {len(todo)} to download")

    session = requests.Session()
    hashes = {}
    for index, player_id in enumerate(todo, start=1):
        try:
            content = download(session, player_id)
        except requests.RequestException as error:
            print(f"  {player_id}: network error ({error.__class__.__name__}), will retry next run")
            continue
        if content is None:
            missing.add(player_id)
        else:
            hashes.setdefault(hashlib.sha1(content).hexdigest(), []).append(player_id)
            (PLAYER_IMAGES_DIR / f"{player_id}.png").write_bytes(content)
        if index % 100 == 0:
            print(f"  {index}/{len(todo)}")
        time.sleep(REQUEST_PAUSE_SECONDS)

    # Identical images shared by many players are placeholders, not photos.
    for digest, ids in hashes.items():
        if len(ids) > PLACEHOLDER_HASH_THRESHOLD:
            print(f"Dropping {len(ids)} identical placeholder images")
            for player_id in ids:
                (PLAYER_IMAGES_DIR / f"{player_id}.png").unlink(missing_ok=True)
                missing.add(player_id)

    MISSING_FILE.write_text(json.dumps(sorted(missing, key=int)), encoding="utf-8")

    with_photo = 0
    for player in players:
        has_photo = (PLAYER_IMAGES_DIR / f"{player['id']}.png").exists()
        player["photoUrl"] = f"images/players/{player['id']}.png" if has_photo else None
        player["photoAttribution"] = "NBA.com" if has_photo else None
        with_photo += has_photo
    players_path.write_text(json.dumps(players, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{with_photo} of {len(players)} players now have a photo; {len(missing)} have none available")


if __name__ == "__main__":
    main()
