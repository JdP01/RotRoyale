// Player UI Component for Health and Stamina Display
import React, { useState, useEffect } from 'react';
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

const HitMarker = () => (
  <div className="hit-marker" aria-hidden="true">
    <span></span>
    <span></span>
  </div>
);

const InventoryBar = () => {
  const { inventory, selectedInventorySlot, itemUseProgress } = usePlayerState();

  return (
    <div className="inventory-bar" aria-label="Inventory">
      {inventory.map((item, index) => {
        const itemType = item?.type || 'empty';
        const isSelected = index === selectedInventorySlot;

        return (
          <div
            key={index}
            className={`inventory-slot inventory-slot-type-${itemType}${isSelected ? ' inventory-slot-selected' : ''}`}
            aria-current={isSelected ? 'true' : undefined}
          >
            <span className="inventory-slot-number">{index + 1}</span>
            <span className="inventory-slot-label">{item?.label || ''}</span>
            {isSelected && itemType !== 'gun' && itemType !== 'empty' && (
              <span className="inventory-use-progress" style={{ transform: `scaleX(${itemUseProgress})` }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Death countdown timer component
const DeathCountdown = () => {
  const [countdown, setCountdown] = useState(3); // 3 seconds to match the timeout
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="death-timer">
      <p>Returning to lobby in {countdown} seconds...</p>
    </div>
  );
};

export const PlayerUI = ({ isAiming = false }) => {
  const { 
    health, 
    stamina, 
    maxHealth, 
    maxStamina, 
    clipAmmo,
    clipCapacity,
    isDead, 
    damageOverlayVisible,
    damageOverlayIntensity,
    hitMarkerVisible
  } = usePlayerState();

  return (
    <>
      {/* Dynamic Crosshairs */}
      <Crosshair isAiming={isAiming} />
      {hitMarkerVisible && <HitMarker />}
      <InventoryBar />

      {/* Damage Overlay */}
      {damageOverlayVisible && (
        <div 
          className="damage-overlay"
          style={{
            opacity: damageOverlayIntensity,
            backgroundColor: `rgba(255, 0, 0, ${damageOverlayIntensity * 0.9})`
          }}
        />
      )}

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

        <div className="ammo-container">
          <span>Clip</span>
          <strong>{clipAmmo}/{clipCapacity}</strong>
        </div>
        
        {/* Death Overlay */}
        {isDead && (
          <div className="death-overlay">
            <div className="death-content">
              <h2>💀 You Died!</h2>
              <p>You were eliminated from the match.</p>
              <DeathCountdown />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
