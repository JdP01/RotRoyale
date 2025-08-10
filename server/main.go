package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"github.com/heroiclabs/nakama-common/runtime"
)

func getAssetsRpc(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok {
		return "", runtime.NewError("user not authenticated", 3)
	}

	wallet, metadata, err := nk.WalletRead(ctx, userID)
	if err != nil {
		logger.Error("Failed to read wallet: %v", err)
		return "", runtime.NewError("failed to read wallet", 13)
	}

	// Get coins from wallet, default to 0 if missing
	coins := int64(0)
	if c, exists := wallet["coins"]; exists {
		coins = c
	}

	// Get skins from metadata, default to empty array if missing
	skins := []string{}
	if s, exists := metadata["skins"]; exists {
		if skinsList, ok := s.([]interface{}); ok {
			for _, skin := range skinsList {
				if skinStr, ok := skin.(string); ok {
					skins = append(skins, skinStr)
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

	_, metadata, err := nk.WalletRead(ctx, userID)
	if err != nil {
		logger.Error("Failed to read wallet: %v", err)
		return "", runtime.NewError("failed to read wallet", 13)
	}

	// Get existing skins
	skins := []string{}
	if s, exists := metadata["skins"]; exists {
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

	// Add new skin
	skins = append(skins, request.SkinToAdd)
	newMetadata := map[string]interface{}{
		"skins": skins,
	}

	_, _, err = nk.WalletUpdate(ctx, userID, nil, newMetadata, true)
	if err != nil {
		logger.Error("Failed to update wallet metadata: %v", err)
		return "", runtime.NewError("failed to update wallet", 13)
	}

	return "{\"success\": true}", nil
}

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
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

	logger.Info("🎉 Your custom backend plugin loaded successfully!")
	return nil
}