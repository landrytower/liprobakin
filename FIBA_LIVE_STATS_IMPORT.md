# FIBA Live Stats Import (Auto + Manual)

This project supports **2 ways** to submit game/player stats:

## Option 1 — Automatic Pull (FIBA Live Stats)

Use the admin stats page:
- Open `Admin → Statistiques`
- Expand a game
- In **Option 1: Auto Pull**, paste a JSON endpoint URL
- Click **Pull Now**
- Review data, then click **Save Game Stats**

### Endpoint used by UI
`POST /api/stats/fiba`

Body:
```json
{
  "sourceUrl": "https://example.com/fiba-live-stats.json"
}
```

The API fetches JSON and normalizes common aliases for:
- Score: `homeScore`, `awayScore`
- Team side: `home/away` (also `domicile/visiteur`, `h/a`)
- Player identity: `jerseyNumber|number`, `playerName|name|firstName+lastName`
- Stat aliases: PTS, MIN, REB/OREB/DREB, AST, STL, BLK, TOV, PF, FD,
  FGM/FGA, 2PM/2PA, 3PM/3PA, FTM/FTA, +/-

### Minimal accepted JSON example
```json
{
  "homeScore": 92,
  "awayScore": 88,
  "players": [
    {
      "team": "home",
      "jerseyNumber": "12",
      "playerName": "John Doe",
      "stats": {
        "pts": 18,
        "min": 31,
        "reb": 7,
        "ast": 5,
        "stl": 2,
        "blk": 1,
        "tov": 3,
        "pf": 2,
        "fd": 4,
        "fgm": 6,
        "fga": 12,
        "2pm": 4,
        "2pa": 7,
        "3pm": 2,
        "3pa": 5,
        "ftm": 4,
        "fta": 5,
        "plusMinus": 9
      }
    }
  ]
}
```

## Option 2 — Manual Entry

You can still enter data manually in the same stats page:
1. Select winner
2. Enter score
3. Enter all player stats in table
4. Save

## Persistence behavior
On save, the app:
- Stores per-player game stats in `games/{gameId}/playerStats/{playerId}`
- Mirrors combined stats to `games/{gameId}.playerStats`
- Recomputes roster season averages and totals for each player in `teams/{teamId}/roster`

This keeps stats reflected across team page, player page, game page, account page, and ranking widgets.
