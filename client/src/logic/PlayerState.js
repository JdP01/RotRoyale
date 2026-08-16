// Simple Player State Management for Health and Stamina
import { create } from 'zustand';

export const usePlayerState = create((set, get) => ({
  // Player stats
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  clipAmmo: 20,
  clipCapacity: 20,
  
  // State flags
  isDead: false,
  isExhausted: false,
  
  // Timeout tracking
  deathTimeoutId: null,
  damageFadeIntervalId: null,
  raycastTimeoutId: null,
  enemyRaycastTimeoutId: null,
  hitMarkerTimeoutId: null,
  
  // Raycast visualization state
  raycastVisible: false,
  raycastStart: null,
  raycastEnd: null,
  
  // Enemy raycast visualization (from other players)
  enemyRaycastVisible: false,
  enemyRaycastStart: null,
  enemyRaycastEnd: null,
  enemyRespawnSeconds: 0,
  
  // Damage overlay state
  damageOverlayIntensity: 0,
  damageOverlayVisible: false,
  hitMarkerVisible: false,
  
  // Callback functions
  broadcastCallback: null,
  lobbyKickCallback: null,
  localRaycastCallbacks: new Set(),
  
  // Actions
  takeDamage: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const { health, isDead, deathTimeoutId, damageFadeIntervalId } = get();
    
    // Don't take damage if already dead
    if (isDead) {
      console.log("💀 Player already dead, ignoring damage");
      return;
    }

    const newHealth = Math.max(0, health - amount);
    
    console.log(`💥 Took ${amount} damage. Health: ${health} → ${newHealth}`);
    
    set({
      health: newHealth,
      isDead: newHealth <= 0
    });
    
    // If player died, trigger lobby kick after a short delay
    if (newHealth <= 0) {
      console.log("💀 Player died! Kicking back to lobby in 3 seconds...");
      
      // Clear any existing death timeout
      if (deathTimeoutId) {
        clearTimeout(deathTimeoutId);
      }
      
      // Broadcast death to other players first
      const { broadcastCallback } = get();
      if (broadcastCallback) {
        broadcastCallback({
          type: 'player_death',
          playerId: 'self', // Will be filled by the game logic
          timestamp: Date.now()
        });
      }
      
      // Kick to lobby after a short delay to show death screen
      const newTimeoutId = setTimeout(() => {
        const currentState = get();
        // Only kick to lobby if player is still dead and callback still exists
        if (currentState.isDead && currentState.lobbyKickCallback) {
          console.log("🚪 Executing lobby kick callback");
          currentState.lobbyKickCallback("You died and have been returned to the lobby.");
        } else {
          console.log("🚪 Skipping lobby kick - player no longer dead or callback cleared");
        }
      }, 3000); // 3 second delay to show death screen
      
      // Store the timeout ID so we can clear it later
      set({ deathTimeoutId: newTimeoutId });
    }
    
    // Trigger damage overlay effect
    const { damageOverlayIntensity } = get();
    const newIntensity = Math.min(1, damageOverlayIntensity + 0.3); // Stack damage overlay, cap at 1
    
    set({
      damageOverlayVisible: true,
      damageOverlayIntensity: newIntensity
    });
    
    // Fade out the overlay over 1 second
    if (damageFadeIntervalId) {
      clearInterval(damageFadeIntervalId);
    }

    const fadeOutInterval = setInterval(() => {
      const current = get();
      const newFadeIntensity = Math.max(0, current.damageOverlayIntensity - 0.05);
      
      if (newFadeIntensity <= 0) {
        set({
          damageOverlayVisible: false,
          damageOverlayIntensity: 0,
          damageFadeIntervalId: null
        });
        clearInterval(fadeOutInterval);
      } else {
        set({ damageOverlayIntensity: newFadeIntensity });
      }
    }, 50); // Update every 50ms for smooth fade
    set({ damageFadeIntervalId: fadeOutInterval });
    
    // Broadcast to other players if callback is set
    const { broadcastCallback } = get();
    if (broadcastCallback) {
      broadcastCallback({
        type: 'player_health_update',
        health: newHealth,
        isDead: newHealth <= 0
      });
    }
  },
  
  consumeStamina: (amount) => {
    const currentStamina = get().stamina;
    const newStamina = Math.max(0, currentStamina - amount);
    
    set({ 
      stamina: newStamina,
      isExhausted: newStamina <= 5 // Exhausted when stamina is very low
    });
    },
  
  regenerateStamina: (amount) => {
    const { stamina, maxStamina } = get();
    const newStamina = Math.min(maxStamina, stamina + amount);
    
    set({ 
      stamina: newStamina,
      isExhausted: newStamina <= 5
    });
  },
  
  heal: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const { health, maxHealth, isDead } = get();
    // A normal heal must not silently revive a dead player while the pending
    // death timeout is still scheduled. Respawn/reset owns revival instead.
    if (isDead) return;
    const newHealth = Math.min(maxHealth, health + amount);
    
    console.log(`💚 Healed ${amount} health. Health: ${health} → ${newHealth}`);
    
    set({ 
      health: newHealth,
      isDead: false
    });
  },
  
  // Reset player state (on respawn)
  reset: () => {
    const { deathTimeoutId, damageFadeIntervalId, raycastTimeoutId, enemyRaycastTimeoutId, hitMarkerTimeoutId, clipCapacity } = get();
    
    // Clear any pending death timeout
    if (deathTimeoutId) {
      clearTimeout(deathTimeoutId);
      console.log("� Cleared pending death timeout");
    }
    if (damageFadeIntervalId) clearInterval(damageFadeIntervalId);
    if (raycastTimeoutId) clearTimeout(raycastTimeoutId);
    if (enemyRaycastTimeoutId) clearTimeout(enemyRaycastTimeoutId);
    if (hitMarkerTimeoutId) clearTimeout(hitMarkerTimeoutId);
    
    console.log("�🔄 Player state reset - returning to lobby");
    set({
      health: 100,
      stamina: 100,
      clipAmmo: clipCapacity,
      isDead: false,
      isExhausted: false,
      deathTimeoutId: null,
      damageFadeIntervalId: null,
      raycastTimeoutId: null,
      enemyRaycastTimeoutId: null,
      hitMarkerTimeoutId: null,
      raycastVisible: false,
      raycastStart: null,
      raycastEnd: null,
      enemyRaycastVisible: false,
      enemyRaycastStart: null,
      enemyRaycastEnd: null,
      enemyRespawnSeconds: 0,
      damageOverlayVisible: false,
      damageOverlayIntensity: 0,
      hitMarkerVisible: false
      // Note: NOT clearing lobbyKickCallback and broadcastCallback here
      // They should only be cleared when component unmounts to prevent loops
    });
  },
  
  // Set callback for broadcasting to other players
  setBroadcastCallback: (callback) => set({ broadcastCallback: callback }),
  
  // Set callback for kicking player back to lobby on death
  setLobbyKickCallback: (callback) => set({ lobbyKickCallback: callback }),

  registerLocalRaycastCallback: (callback) => set((state) => {
    const callbacks = new Set(state.localRaycastCallbacks);
    callbacks.add(callback);
    return { localRaycastCallbacks: callbacks };
  }),

  unregisterLocalRaycastCallback: (callback) => set((state) => {
    const callbacks = new Set(state.localRaycastCallbacks);
    callbacks.delete(callback);
    return { localRaycastCallbacks: callbacks };
  }),

  setEnemyRespawnSeconds: (seconds) => set({ enemyRespawnSeconds: seconds }),

  showHitMarker: () => {
    const { hitMarkerTimeoutId } = get();
    if (hitMarkerTimeoutId) clearTimeout(hitMarkerTimeoutId);

    set({ hitMarkerVisible: true });
    const timeoutId = setTimeout(() => {
      set({ hitMarkerVisible: false, hitMarkerTimeoutId: null });
    }, 140);
    set({ hitMarkerTimeoutId: timeoutId });
  },

  reloadClip: () => {
    const { clipAmmo, clipCapacity } = get();
    if (clipAmmo >= clipCapacity) return false;

    set({ clipAmmo: clipCapacity });
    return true;
  },
  
  // Raycast actions
  fireRaycast: (startPos, endPos) => {
    const { clipAmmo } = get();
    if (clipAmmo <= 0) return false;

    // console.log(`🔫 Raycast fired from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)}) to (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}, ${endPos.z.toFixed(1)})`);
    
    set({
      clipAmmo: clipAmmo - 1,
      raycastVisible: true,
      raycastStart: { ...startPos },
      raycastEnd: { ...endPos }
    });
    
    // Resolve every local single-player target before broadcasting to other players.
    const { localRaycastCallbacks, broadcastCallback } = get();
    localRaycastCallbacks.forEach((callback) => callback(startPos, endPos));

    // Broadcast raycast to other players if callback is set
    if (broadcastCallback) {
      broadcastCallback({
        type: 'raycast_shot',
        startPosition: startPos,
        endPosition: endPos,
        damage: 25, // Base damage per shot
        timestamp: Date.now()
      });
    }
    
    // Auto-hide after a short duration
    const { raycastTimeoutId } = get();
    if (raycastTimeoutId) clearTimeout(raycastTimeoutId);
    const timeoutId = setTimeout(() => {
      set({ raycastVisible: false, raycastTimeoutId: null });
    }, 1500);
    set({ raycastTimeoutId: timeoutId });
    return true;
  },
  
  hideRaycast: () => {
    const { raycastTimeoutId } = get();
    if (raycastTimeoutId) clearTimeout(raycastTimeoutId);
    set({ raycastVisible: false, raycastTimeoutId: null });
  },
  
  // Enemy raycast actions (for visualizing other players' shots)
  showEnemyRaycast: (startPos, endPos) => {
    // console.log(`👁️ Showing enemy raycast from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)}) to (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}, ${endPos.z.toFixed(1)})`);
    
    set({
      enemyRaycastVisible: true,
      enemyRaycastStart: { ...startPos },
      enemyRaycastEnd: { ...endPos }
    });
    
    // Auto-hide after a short duration
    const { enemyRaycastTimeoutId } = get();
    if (enemyRaycastTimeoutId) clearTimeout(enemyRaycastTimeoutId);
    const timeoutId = setTimeout(() => {
      set({ enemyRaycastVisible: false, enemyRaycastTimeoutId: null });
    }, 1000);
    set({ enemyRaycastTimeoutId: timeoutId });
  },
  
  hideEnemyRaycast: () => {
    const { enemyRaycastTimeoutId } = get();
    if (enemyRaycastTimeoutId) clearTimeout(enemyRaycastTimeoutId);
    set({ enemyRaycastVisible: false, enemyRaycastTimeoutId: null });
  },
  
  // Debug function to get current state
  getState: () => {
    const { health, stamina, isDead, isExhausted } = get();
    return { health, stamina, isDead, isExhausted };
  }
}));
