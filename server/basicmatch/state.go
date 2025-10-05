package basicmatch

import "github.com/heroiclabs/nakama-common/runtime"

// State represents match state.
type State struct {
	Presences map[string]runtime.Presence
	Label     string
	Players   map[string]*Player
}

// Vec2 is a 2D position used by the authoritative match.
type Vec2 struct {
	X float32 `json:"x"`
	Y float32 `json:"y"`
}

// Player holds per-user authoritative state.
type Player struct {
	UserID  string `json:"user_id"`
	Alive   bool   `json:"alive"`
	Health  int    `json:"health"`
	Pos     Vec2   `json:"pos"`
	LastSeq uint32 `json:"last_seq"`
}