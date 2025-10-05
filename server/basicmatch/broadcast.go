package basicmatch

import (
	"github.com/heroiclabs/nakama-common/runtime"
)

// BroadcastToAll sends a message to all connected presences.
func BroadcastToAll(dispatcher runtime.MatchDispatcher, opCode int64, data []byte, sender runtime.Presence, reliable bool) error {
	return dispatcher.BroadcastMessage(opCode, data, nil, sender, reliable)
}

