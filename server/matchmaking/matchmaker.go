package matchmaking

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

// matchedHook is invoked by Nakama when the matchmaker finds a group of players.
// We create an authoritative match using our "basicmatch" handler and return its ID.
func matchedHook(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	// You can pass params to the match here if needed. Keep empty for now.
	params := map[string]interface{}{
		"player_count": len(entries),
	}
	matchID, err := nk.MatchCreate(ctx, "basicmatch", params)
	if err != nil {
		logger.Error("matchmaker: failed to create basicmatch: %v", err)
		return "", err
	}
	logger.Info("matchmaker: created match %s for %d entries", matchID, len(entries))
	return matchID, nil
}

// Register wires the matchmaker matched hook into the runtime.
func Register(initializer runtime.Initializer) error {
	return initializer.RegisterMatchmakerMatched(matchedHook)
}

