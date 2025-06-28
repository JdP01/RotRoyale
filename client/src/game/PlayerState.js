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
  
  // Actions
  takeDamage: (amount, source = 'unknown') => {
    const currentHealth = get().health;
    const newHealth = Math.max(0, currentHealth - amount);
    
    console.log(`💔 Player took ${amount} damage from ${source}. Health: ${currentHealth} → ${newHealth}`);
    
    set({ 
      health: newHealth,
      isDead: newHealth <= 0
    });
    
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
    
    console.log(`⚡ Consumed ${amount} stamina. Stamina: ${currentStamina} → ${newStamina}`);
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
      raycastEnd: null
    });
  },
  
  // Set callback for broadcasting to other players
  setBroadcastCallback: (callback) => set({ broadcastCallback: callback }),
  
  // Raycast actions
  fireRaycast: (startPos, endPos) => {
    console.log(`🔫 Raycast fired from (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)}) to (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}, ${endPos.z.toFixed(1)})`);
    
    set({
      raycastVisible: true,
      raycastStart: { ...startPos },
      raycastEnd: { ...endPos }
    });
    
    // Auto-hide after a short duration
    setTimeout(() => {
      set({ raycastVisible: false });
    }, 1500);
  },
  
  hideRaycast: () => {
    set({ raycastVisible: false });
  },
  
  // Debug function to get current state
  getState: () => {
    const { health, stamina, isDead, isExhausted } = get();
    return { health, stamina, isDead, isExhausted };
  }
}));
