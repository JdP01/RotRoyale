package basicmatch

import (
    "context"
    "database/sql"
    "encoding/json"
    "math"

    "github.com/heroiclabs/nakama-common/runtime"
)

type Match struct{}

// Ensure Match implements runtime.Match
var _ runtime.Match = (*Match)(nil)

func New() *Match { return &Match{} }

// Reserve a small opcode range for server-validated messages.
// Keep relaying all other opcodes so existing clients are unaffected.
const (
    OpClientPos     = 100 // client proposes position {x,y,seq}
    OpClientDamage  = 101 // client proposes damage {target,amount}
    OpClientDie     = 102 // client says they died (optional)
    OpClientRespawn = 103 // client requests respawn
    OpServerSnapshot = 150 // server authoritative snapshot broadcast
)

func (m *Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
    s := &State{
        Presences: make(map[string]runtime.Presence),
        Players:   make(map[string]*Player),
    }
    if pc, ok := params["player_count"].(int); ok {
        s.Label = jsonNumberString(pc)
    }
    // 20 ticks per second, label s.Label
    return s, 20, s.Label
}

func (m *Match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
    // Accept all join attempts.
    return state, true, ""
}

func (m *Match) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
    s := state.(*State)
    for _, p := range presences {
        s.Presences[p.GetUserId()] = p
        // Initialize player authoritative state.
        if _, ok := s.Players[p.GetUserId()]; !ok {
            s.Players[p.GetUserId()] = &Player{
                UserID: p.GetUserId(),
                Alive:  true,
                Health: 100,
                Pos:    Vec2{X: 0, Y: 0},
            }
        }
    }
    return s
}

func (m *Match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
    s := state.(*State)
    for _, p := range presences {
        delete(s.Presences, p.GetUserId())
        delete(s.Players, p.GetUserId())
    }
    return s
}

func (m *Match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
    s := state.(*State)

    for _, msg := range messages {
        sender := msg.GetUserId()
        player, ok := s.Players[sender]
        if !ok {
            // Unknown sender; ignore.
            continue
        }

        switch msg.GetOpCode() {

        case OpClientPos:
            // Expect JSON: {x: number, y: number, seq: number}
            var pld struct {
                X   float32 `json:"x"`
                Y   float32 `json:"y"`
                Seq uint32  `json:"seq"`
            }
            if err := json.Unmarshal(msg.GetData(), &pld); err != nil {
                continue
            }
            // Simple anti-replay: ignore out-of-order seq.
            if pld.Seq <= player.LastSeq {
                continue
            }
            player.LastSeq = pld.Seq

            // Simple speed check: clamp large teleports.
            // With 20 TPS, allow ~10 units/sec => 0.5 units/tick.
            const maxStep = 0.5
            dx := float64(pld.X - player.Pos.X)
            dy := float64(pld.Y - player.Pos.Y)
            dist := math.Hypot(dx, dy)
            if dist > maxStep {
                scale := maxStep / dist
                player.Pos.X += float32(dx * scale)
                player.Pos.Y += float32(dy * scale)
            } else {
                player.Pos.X = pld.X
                player.Pos.Y = pld.Y
            }

        case OpClientDamage:
            // Expect JSON: {target: "user_id", amount: number}
            var pld struct {
                Target string `json:"target"`
                Amount int    `json:"amount"`
            }
            if err := json.Unmarshal(msg.GetData(), &pld); err != nil {
                continue
            }
            // Damage must be a positive, bounded integer and must name a
            // connected player. Reject invalid requests rather than treating
            // them as zero-damage updates.
            if pld.Target == "" || pld.Amount <= 0 || pld.Amount > 100 {
                continue
            }
            // Validate target exists and is alive.
            if tgt, ok := s.Players[pld.Target]; ok && tgt.Alive {
                tgt.Health -= pld.Amount
                logger.Info("💥 Player %s took %d damage, health now: %d", tgt.UserID, pld.Amount, tgt.Health)
                if tgt.Health <= 0 {
                    tgt.Health = 0
                    tgt.Alive = false
                    logger.Info("💀 Player %s died!", tgt.UserID)
                }
            }

        case OpClientDie:
            // Allow client to report death; server enforces state.
            player.Health = 0
            player.Alive = false
            logger.Info("💀 Player %s reported death", player.UserID)

        case OpClientRespawn:
            // Only allow if currently dead; place at a spawn.
            if !player.Alive {
                player.Alive = true
                player.Health = 100
                player.Pos = Vec2{X: 0, Y: 0} // TODO: pick spawn
            }

        default:
            // Preserve existing behavior: relay unknown opcodes unchanged.
            _ = dispatcher.BroadcastMessage(msg.GetOpCode(), msg.GetData(), nil, msg, true)
        }
    }

    // Periodic authoritative snapshot (e.g., 5 times per second).
    if tick%4 == 0 {
        // Build a lightweight snapshot of all players.
        type snap struct {
            UserID string `json:"u"`
            X      float32 `json:"x"`
            Y      float32 `json:"y"`
            HP     int     `json:"hp"`
            A      bool    `json:"a"` // alive
        }
        out := make([]snap, 0, len(s.Players))
        for _, p := range s.Players {
            out = append(out, snap{UserID: p.UserID, X: p.Pos.X, Y: p.Pos.Y, HP: p.Health, A: p.Alive})
        }
        if b, err := json.Marshal(out); err == nil {
            logger.Debug("📸 Broadcasting snapshot: %s", string(b))
            _ = dispatcher.BroadcastMessage(OpServerSnapshot, b, nil, nil, false)
        } else {
            logger.Error("Failed to marshal snapshot: %v", err)
        }
    }

    return s
}

func (m *Match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
    return state
}

func (m *Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
    // Allow external RPCs to query simple match info like player count.
    s := state.(*State)
    switch data {
    case "get_players_connected":
        // Respond with a tiny JSON payload {"players": <count>}.
        type resp struct{ Players int `json:"players"` }
        b, _ := json.Marshal(resp{Players: len(s.Presences)})
        return s, string(b)
    default:
        return s, ""
    }
}

// jsonNumberString returns a JSON string for a simple label with a number.
func jsonNumberString(n int) string {
    b, _ := json.Marshal(map[string]int{"players": n})
    return string(b)
}