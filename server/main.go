package main

import (
	"context"
	"database/sql"
	"encoding/json"
    
	"github.com/heroiclabs/nakama-common/runtime"

	// Local modules
	"rotbackend/basicmatch"
	mm "rotbackend/matchmaking"
)

func getAssetsRpc(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok {
		return "", runtime.NewError("user not authenticated", 3)
	}

	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		logger.Error("Failed to get account: %v", err)
		return "", runtime.NewError("failed to get account", 13)
	}

	// Parse wallet JSON to get coins
	coins := int64(0)
	if account.Wallet != "" {
		var wallet map[string]int64
		if err := json.Unmarshal([]byte(account.Wallet), &wallet); err == nil {
			if c, exists := wallet["coins"]; exists {
				coins = c
			}
		}
	}

	// Get skins from account metadata
	skins := []string{}
	if account.User.Metadata != "" {
		var metadata map[string]interface{}
		if err := json.Unmarshal([]byte(account.User.Metadata), &metadata); err == nil {
			if s, exists := metadata["skins"]; exists {
				if skinsList, ok := s.([]interface{}); ok {
					for _, skin := range skinsList {
						if skinStr, ok := skin.(string); ok {
							skins = append(skins, skinStr)
						}
					}
				}
			}
		}
	}

	// Structure the response
	responseData := map[string]interface{}{
		"coins": coins,
		"skins": skins,
	}

	response, err := json.Marshal(responseData)
	if err != nil {
		logger.Error("Failed to marshal response: %v", err)
		return "", runtime.NewError("failed to serialize response", 13)
	}

	return string(response), nil
}

func addCoinsRpc(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok {
		return "", runtime.NewError("user not authenticated", 3)
	}

	var request struct {
		CoinsToAdd int64 `json:"coinsToAdd"`
	}
	if err := json.Unmarshal([]byte(payload), &request); err != nil {
		return "", runtime.NewError("invalid payload", 3)
	}

	changeset := map[string]int64{
		"coins": request.CoinsToAdd,
	}

	_, _, err := nk.WalletUpdate(ctx, userID, changeset, nil, true)
	if err != nil {
		logger.Error("Failed to update wallet: %v", err)
		return "", runtime.NewError("failed to update wallet", 13)
	}

	return "{\"success\": true}", nil
}

// getPlayersConnectedRpc expects payload {"match_id":"<id>"} and returns {"players":N}.
func getPlayersConnectedRpc(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// Ensure user is authenticated (optional but recommended)
	if _, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string); !ok {
		return "", runtime.NewError("user not authenticated", 3)
	}

	var req struct {
		MatchID string `json:"match_id"`
	}
	if payload != "" {
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", runtime.NewError("invalid payload", 3)
		}
	}
	if req.MatchID == "" {
		return "", runtime.NewError("match_id required", 3)
	}

	// Use MatchSignal to query the match instance for live info.
	if resp, err := nk.MatchSignal(ctx, req.MatchID, "get_players_connected"); err == nil {
		return resp, nil
	}
	logger.Error("MatchSignal failed for %s", req.MatchID)
	return "", runtime.NewError("failed to query match", 13)
}

func addSkinRpc(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok {
		return "", runtime.NewError("user not authenticated", 3)
	}

	var request struct {
		SkinToAdd string `json:"skinToAdd"`
	}
	if err := json.Unmarshal([]byte(payload), &request); err != nil {
		return "", runtime.NewError("invalid payload", 3)
	}

	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		logger.Error("Failed to get account: %v", err)
		return "", runtime.NewError("failed to get account", 13)
	}

	// Parse existing metadata
	existingMetadata := make(map[string]interface{})
	if account.User.Metadata != "" {
		if err := json.Unmarshal([]byte(account.User.Metadata), &existingMetadata); err != nil {
			logger.Error("Failed to parse existing metadata: %v", err)
			return "", runtime.NewError("failed to parse metadata", 13)
		}
	}

	// Get existing skins
	skins := []string{}
	if s, exists := existingMetadata["skins"]; exists {
		if skinsList, ok := s.([]interface{}); ok {
			for _, skin := range skinsList {
				if skinStr, ok := skin.(string); ok {
					skins = append(skins, skinStr)
				}
			}
		}
	}

	// Check if skin already exists
	for _, existingSkin := range skins {
		if existingSkin == request.SkinToAdd {
			return "{\"success\": true}", nil // Already exists
		}
	}

	// Add new skin and merge with existing metadata
	skins = append(skins, request.SkinToAdd)
	existingMetadata["skins"] = skins

	err = nk.AccountUpdateId(ctx, userID, "", existingMetadata, "", "", "", "", "")
	if err != nil {
		logger.Error("Failed to update account metadata: %v", err)
		return "", runtime.NewError("failed to update account", 13)
	}

	return "{\"success\": true}", nil
}

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	// Register RPCs
	err := initializer.RegisterRpc("get_assets", getAssetsRpc)
	if err != nil {
		logger.Error("Unable to register get_assets RPC: %v", err)
		return err
	}

	err = initializer.RegisterRpc("add_coins", addCoinsRpc)
	if err != nil {
		logger.Error("Unable to register add_coins RPC: %v", err)
		return err
	}

	err = initializer.RegisterRpc("add_skin", addSkinRpc)
	if err != nil {
		logger.Error("Unable to register add_skin RPC: %v", err)
		return err
	}

	// Register RPC to get accurate player count from a match.
	if err := initializer.RegisterRpc("get_players_connected", getPlayersConnectedRpc); err != nil {
		logger.Error("Unable to register get_players_connected RPC: %v", err)
		return err
	}

	// Register authoritative match handler used by matchmaker.
	if err := initializer.RegisterMatch("basicmatch", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return basicmatch.New(), nil
	}); err != nil {
		logger.Error("Unable to register basicmatch: %v", err)
		return err
	}

	// Register matchmaker matched hook to create our match.
	if err := mm.Register(initializer); err != nil {
		logger.Error("Unable to register matchmaker matched hook: %v", err)
		return err
	}

	logger.Info("🎉 Your custom backend plugin loaded successfully!")
	return nil
}