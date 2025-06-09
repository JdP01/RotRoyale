import React, {useState} from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import GameCanvas from './objects/GameCanvas';
import LoginPage from './LandingPage/LoginPage'; 

export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSession, setUserSession] = useState(null);
  
  const handleLogin = (sessionData) => {
    console.log("Login successful, session data:", sessionData);
    setUserSession(sessionData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    // Close socket connection if it exists
    if (userSession?.socket) {
      userSession.socket.disconnect();
    }
    setUserSession(null);
    setIsLoggedIn(false);
  };

  // If not logged in, show the LoginPage
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  return (
    <div>
      {/* Optional: Add a logout button or user info */}
      <div style={{
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <p>Welcome, {userSession?.username || 'Player'}!</p>
        <button onClick={handleLogout} style={{
          background: '#ff4444',
          color: 'white',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}>
          Logout
        </button>
      </div>
      <GameCanvas userSession={userSession} />
    </div>
  );
}