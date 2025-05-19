// src/LoginPage.jsx
import React, { useState } from 'react';
import './LoginPage.css'; // We'll heavily rely on this CSS file now

// Placeholder for actual social login icons
const GoogleIcon = () => <span className="icon-placeholder">G</span>;
const FacebookIcon = () => <span className="icon-placeholder">f</span>;

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- IMPORTANT: Image Handling ---
  // For a background image, it's often best to set it via CSS for better control.
  // However, if you need it to be dynamic from imagePath:
  // 1. Import it if it's in src/assets:
  // import backgroundImage from './assets/your-background-image.jpg';
  // 2. Or ensure imagePath is a valid URL if it's from public folder or external.
  const imagePath = "/DinoConceptArt/Title.png"; // Example, replace or import

  const handleUsernamePasswordLogin = (event) => {
    event.preventDefault();
    if (username === "Juan" && password === "yes") {
      onLoginSuccess();
    } else {
      alert('Invalid credentials for username/password');
    }
  };

  const handleGoogleLogin = () => {
    alert('Google Login Clicked (implement logic)');
  };

  const handleFacebookLogin = () => {
    alert('Facebook Login Clicked (implement logic)');
  };

  // Style for the background image div
  const backgroundStyle = {
    // If using an imported image:
    // backgroundImage: `url(${backgroundImage})`,
    // If using imagePath string:
    backgroundImage: `url("${imagePath}")`, // Make sure imagePath is a valid URL or relative path from public
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div className="login-page-container" style={imagePath ? backgroundStyle : {}}>
      {/* This div is now primarily for positioning the form section */}
      <div className="login-form-overlay-section">
        <div className="login-form-content">
          <h1>Game Login</h1>
          <form onSubmit={handleUsernamePasswordLogin}>
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="Type your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              />
            </div>
            <button type="submit" className="login-button">
              Login
            </button>
          </form>

          <div className="social-login-divider">Or Sign In Using</div>

          <div className="social-login-buttons">
            <button onClick={handleGoogleLogin} className="social-button google-button">
              <GoogleIcon /> Google
            </button>
            <button onClick={handleFacebookLogin} className="social-button facebook-button">
              <FacebookIcon /> Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;