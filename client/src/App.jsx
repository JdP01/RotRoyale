import React, {useState} from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import GameCanvas from './objects/GameCanvas';
import LoginPage from './LandingPage/LoginPage'; 

export default function App() { 

  const [isLoggedIn,setIsLoggedIn]  = useState(false);
  
  const handleLogin = () => {
    setIsLoggedIn(true); // Set login status to true
  };

  // If not logged in, show the LoginPage
  //if (!isLoggedIn) {
    //return <LoginPage onLoginSuccess={handleLogin} />;}

  return (
    <GameCanvas/>
  );
}