// Simple Player State Management for Health and Stamina
import { create } from 'zustand';

export const usePlayerState = create((set, get) => ({
  // Player stats
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  
  // State flags
  isDead: false,
  isExhausted: false,
  
  // Raycast visualization state
  raycastVisible: false,
  raycastStart: null,
  raycastEnd: null,
  
  // Enemy raycast visualization (from other players)
  enemyRaycastVisible: false,
  enemyRaycastStart: null,
  enemyRaycastEnd: null,
  
  // Damage overlay state
  damageOverlayIntensity: 0,
  damageOverlayVisible: false,
  
  // Callback functions
  broadcastCallback: null,
  lobbyKickCallback: null,
  
  // Actions
  takeDamage: (amount, source = 'unknown') => {
    const currentHealth = get().health;
    const newHealth = Math.max(0, currentHealth - amount);
    
    set({ 
      health: newHealth,
      isDead: newHealth <= 0
    });
    
    // If player died, trigger lobby kick after a short delay
    if (newHealth <= 0) {
      console.log("💀 Player died! Kicking back to lobby in 3 seconds...");
      
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
      setTimeout(() => {
        const { lobbyKickCallback } = get();
        if (lobbyKickCallback) {
          console.log("🚪 Executing lobby kick callback");
          lobbyKickCallback("You died and have been returned to the lobby.");
        }
      }, 3000); // 3 second delay to show death screen
    }
    
    // Trigger damage overlay effect
    const { damageOverlayIntensity } = get();
    const newIntensity = Math.min(1, damageOverlayIntensity + 0.3); // Stack damage overlay, cap at 1
    
    set({
      damageOverlayVisible: true,
      damageOverlayIntensity: newIntensity
    });
    
    // Fade out the overlay over 1 second
    const fadeOutInterval = setInterval(() => {
      const current = get();
      const newFadeIntensity = Math.max(0, current.damageOverlayIntensity - 0.05);
      
      if (newFadeIntensity <= 0) {
        set({
          damageOverlayVisible: false,
          damageOverlayIntensity: 0
        });
        clearInterval(fadeOutInterval);
      } else {
        set({ damageOverlayIntensity: newFadeIntensity });
      }
    }, 50); // Update every 50ms for smooth fade
    
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
    const { health, maxHealth } = get();
    const newHealth = Math.min(maxHealth, health + amount);
    
    console.log(`💚 Healed ${amount} health. Health: ${health} → ${newHealth}`);
    
    set({ 
      health: newHealth,
      isDead: false
    });
  },
  
  // Reset player state (on respawn)
  reset: () => {
    console.log("🔄 Player state reset - respawning");
    set({
      health: 100,
      stamina: 100,
      isDead: false,
      isExhausted: false,
      raycastVisible: false,
      raycastStart: null,
      raycastEnd: null,
      enemyRaycastVisible: false,
      enemyRaycastStart: null,
      enemyRaycastEnd: null,
      damageOverlayVisible: false,
      damageOverlayIntensity: 0
    });
  },
  
  // Set callback for broadcasting to other players
  setBroadcastCallback: (callback) => set({ broadcastCallback: callback }),
  
  // Set callback for kicking player back to lobby on death
  setLobbyKickCallback: (callback) => set({ lobbyKickCallback: callback }),
  
  // Raycast actions
  fireRaycast: (startPos, endPos) => {
    // console.log(`🔫 Raycast fired from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)}) to (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}, ${endPos.z.toFixed(1)})`);
    
    set({
      raycastVisible: true,
      raycastStart: { ...startPos },
      raycastEnd: { ...endPos }
    });
    
    // Broadcast raycast to other players if callback is set
    const { broadcastCallback } = get();
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
    setTimeout(() => {
      set({ raycastVisible: false });
    }, 1500);
  },
  
  hideRaycast: () => {
    set({ raycastVisible: false });
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
    setTimeout(() => {
      set({ enemyRaycastVisible: false });
    }, 1000);
  },
  
  hideEnemyRaycast: () => {
    set({ enemyRaycastVisible: false });
  },
  
  // Debug function to get current state
  getState: () => {
    const { health, stamina, isDead, isExhausted } = get();
    return { health, stamina, isDead, isExhausted };
  }
}));
