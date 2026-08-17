// src/LoginPage.jsx
import React, { useState } from 'react';
import '../styling/LoginPage.css';
import * as Nakama from "@heroiclabs/nakama-js";

const googleImage = "/images/google.svg";
const GoogleIcon = () => <img src={googleImage} alt="Google sign-in" style={{ width: '20px', height: '20px', marginRight: '0px' }} />;
const FacebookIcon = () => <img src={googleImage} alt="Facebook sign-in" style={{ width: '20px', height: '20px', marginRight: '0px' }} />;
const GUEST_DEVICE_ID_KEY = 'rot-royale-guest-device-id';

const getGuestDeviceId = () => {
  const existingDeviceId = window.localStorage.getItem(GUEST_DEVICE_ID_KEY);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(GUEST_DEVICE_ID_KEY, deviceId);
  return deviceId;
};

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const imagePath = "/images/DinoConceptArt/Title.png";

  const connectAuthenticatedUser = async (client, session, isGuest = false) => {
    const socket = client.createSocket(false, false);
    await socket.connect(session);
    console.log("Socket connected successfully");

    const account = await client.getAccount(session);
    console.log("User account:", account);

    onLoginSuccess({
      client,
      session,
      socket,
      account,
      username: account.user.username,
      isGuest
    });
  };

  const createClient = () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const host = window.location.hostname;
    const useSsl = window.location.protocol === 'https:';
    const port = isLocalhost ? '7350' : (window.location.port || (useSsl ? '443' : '80'));
    return new Nakama.Client("defaultkey", host, port, useSsl);
  };

  // Updated LoginPage.jsx authentication function
  const handleUsernamePasswordLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting to authenticate with Nakama...");
      
      // Create client with explicit configuration

      const client = createClient();
      
      // Add timeout and retry logic
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      const authPromise = client.authenticateEmail(
        username,
        password,
        true, // create account if not exists
        username // set username as account's username
      );

      const session = await Promise.race([authPromise, timeoutPromise]);
      console.log("Authenticated with Nakama:", session);

      await connectAuthenticatedUser(client, session);

    } catch (err) {
      console.error("Nakama authentication error:", err);
      
      let errorMessage = "Login failed. Please try again.";
      const rawMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      const normalizedMessage = rawMessage.toLowerCase();
      
      // Enhanced error handling
      if (normalizedMessage.includes("timeout")) {
        errorMessage = "Connection timeout. Please check if Nakama server is running.";
      } else if (normalizedMessage.includes("cors") || err.response?.type === 'cors') {
        errorMessage = "CORS error. Please check server configuration.";
      } else if (err.status === 401 || normalizedMessage.includes("401")) {
        errorMessage = "Authentication failed. Check your credentials.";
      } else if (normalizedMessage.includes("unavailable") || normalizedMessage.includes("econnrefused")) {
        errorMessage = "Cannot connect to server. Please check the Rot Royale gateway and Nakama container.";
      } else if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
        errorMessage = "Network error. Check your connection and server status.";
      }
      
      setError(errorMessage);
      console.error("Detailed error:", {
        message: rawMessage,
        status: err.status,
        response: err.response,
        stack: err.stack
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const deviceId = getGuestDeviceId();
      const client = createClient();
      const session = await client.authenticateDevice(
        deviceId,
        true,
        `Guest-${deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`
      );

      await connectAuthenticatedUser(client, session, true);
    } catch (err) {
      console.error("Guest login error:", err);
      setError("Guest login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    alert('Google Login not implemented yet');
  };

  const handleFacebookLogin = () => {
    alert('Facebook Login not implemented yet');
  };

  const backgroundStyle = {
    backgroundImage: `url("${imagePath}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div className="login-page-container" style={imagePath ? backgroundStyle : {}}>
      <div className="login-form-overlay-section">
        <div className="login-form-content">
          <h1>Game Login</h1>
          <form onSubmit={handleUsernamePasswordLogin}>
            <div className="input-group">
              <label htmlFor="username">Username (Email)</label>
              <input
                type="email"
                id="username"
                placeholder="Enter your email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Type your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Login'}
            </button>
            {error && <p style={{color: 'red', marginTop: '10px', fontSize: '14px'}}>{error}</p>}
          </form>

          <button type="button" className="guest-login-button" onClick={handleGuestLogin} disabled={isLoading}>
            Play as Guest
          </button>

          <div className="social-login-divider">Or Sign In Using</div>
          <div className="social-login-buttons">
            <button onClick={handleGoogleLogin} className="social-button google-button" disabled={isLoading}>
              <GoogleIcon /> Google
            </button>
            <button onClick={handleFacebookLogin} className="social-button facebook-button" disabled={isLoading}>
              <FacebookIcon /> Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;