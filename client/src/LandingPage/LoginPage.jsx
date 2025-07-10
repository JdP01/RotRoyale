// src/LoginPage.jsx
import React, { useState } from 'react';
import './LoginPage.css';
import * as Nakama from "@heroiclabs/nakama-js";

const googleImage = "/images/google.svg";
const GoogleIcon = () => <img src={googleImage} alt="Google sign-in" style={{ width: '20px', height: '20px', marginRight: '0px' }} />;
const FacebookIcon = () => <img src={googleImage} alt="Facebook sign-in" style={{ width: '20px', height: '20px', marginRight: '0px' }} />;

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const imagePath = "/images/DinoConceptArt/Title.png";

  // Updated LoginPage.jsx authentication function
  const handleUsernamePasswordLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting to authenticate with Nakama...");
      
      // Create client with explicit configuration
      const client = new Nakama.Client("defaultkey", "147.182.219.213", 7350, false);
      
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

      // Connect socket for real-time features
      const socket = client.createSocket(false, false);
      await socket.connect(session);
      console.log("Socket connected successfully");

      // Get user account info
      const account = await client.getAccount(session);
      console.log("User account:", account);

      // Pass all necessary data to parent
      onLoginSuccess({ 
        client, 
        session, 
        socket, 
        account,
        username: account.user.username 
      });

    } catch (err) {
      console.error("Nakama authentication error:", err);
      
      let errorMessage = "Login failed. Please try again.";
      
      // Enhanced error handling
      if (err.message.includes("timeout") || err.message.includes("TIMEOUT")) {
        errorMessage = "Connection timeout. Please check if Nakama server is running.";
      } else if (err.message.includes("CORS") || err.response?.type === 'cors') {
        errorMessage = "CORS error. Please check server configuration.";
      } else if (err.status === 401 || err.message.includes("401")) {
        errorMessage = "Authentication failed. Check your credentials.";
      } else if (err.message.includes("UNAVAILABLE") || err.message.includes("ECONNREFUSED")) {
        errorMessage = "Cannot connect to server. Is Nakama running on port 7350?";
      } else if (err.message.includes("network") || err.message.includes("fetch")) {
        errorMessage = "Network error. Check your connection and server status.";
      }
      
      setError(errorMessage);
      console.error("Detailed error:", {
        message: err.message,
        status: err.status,
        response: err.response,
        stack: err.stack
      });
      
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