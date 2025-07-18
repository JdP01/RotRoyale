// Player UI Component for Health and Stamina Display
import React from 'react';
import { usePlayerState } from '../logic/PlayerState';
import '../styling/PlayerUI.css';

// Crosshair component with standard and aiming states
const Crosshair = ({ isAiming = false }) => {
  if (isAiming) {
    // Tighter, smaller crosshair for aiming
    return (
      <div className="crosshairs crosshairs-aiming">
        <div className="crosshair-line crosshair-top-aim"></div>
        <div className="crosshair-line crosshair-bottom-aim"></div>
        <div className="crosshair-line crosshair-left-aim"></div>
        <div className="crosshair-line crosshair-right-aim"></div>
      </div>
    );
  }
  
  // Standard crosshair
  return (
    <div className="crosshairs">
      <div className="crosshair-line crosshair-top"></div>
      <div className="crosshair-line crosshair-bottom"></div>
      <div className="crosshair-line crosshair-left"></div>
      <div className="crosshair-line crosshair-right"></div>
    </div>
  );
};

export const PlayerUI = ({ isAiming = false }) => {
  const { health, stamina, maxHealth, maxStamina, isDead, reset } = usePlayerState();

  return (
    <>
      {/* Dynamic Crosshairs */}
      <Crosshair isAiming={isAiming} />

      {/* Player UI - Bottom left */}
      <div className="player-ui">
        {/* Health Bar */}
        <div className="stat-container">
          <label>❤️ Health</label>
          <div className="stat-bar-container">
            <div 
              className="stat-bar health-bar" 
              style={{ width: `${(health / maxHealth) * 100}%` }}
            />
            <div className="stat-bar-background" />
          </div>
          <span className="stat-text">{Math.floor(health)}/{maxHealth}</span>
        </div>
        
        {/* Stamina Bar */}
        <div className="stat-container">
          <label>⚡ Stamina</label>
          <div className="stat-bar-container">
            <div 
              className="stat-bar stamina-bar" 
              style={{ width: `${(stamina / maxStamina) * 100}%` }}
            />
            <div className="stat-bar-background" />
          </div>
          <span className="stat-text">{Math.floor(stamina)}/{maxStamina}</span>
        </div>
        
        {/* Death Overlay */}
        {isDead && (
          <div className="death-overlay">
            <div className="death-content">
              <h2>💀 You Died!</h2>
              <p>Don't worry, you can respawn</p>
              <button onClick={reset} className="respawn-button">
                🔄 Respawn
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
