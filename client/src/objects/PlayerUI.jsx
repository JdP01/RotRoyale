// Player UI Component for Health and Stamina Display
import React from 'react';
import { usePlayerState } from '../game/PlayerState';
import './PlayerUI.css';

export const PlayerUI = () => {
  const { health, stamina, maxHealth, maxStamina, isDead, reset } = usePlayerState();

  return (
    <>
      {/* Crosshairs - Center of screen */}
      <div className="crosshairs">
        <div className="crosshair-line crosshair-top"></div>
        <div className="crosshair-line crosshair-bottom"></div>
        <div className="crosshair-line crosshair-left"></div>
        <div className="crosshair-line crosshair-right"></div>
      </div>

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
