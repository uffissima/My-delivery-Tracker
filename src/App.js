import React, { useState } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios';
import PackageTable from './PackageTable';
import './App.css';

const initialPackages = [
    { sender: 'System', carrier: 'App', description: 'Ready to scan for your packages!', date: 'Thursday, August 7', status: 'Idle' },
];

function App() {
  const [user, setUser] = useState(null);
  const [packages, setPackages] = useState(initialPackages);
  const [token, setToken] = useState(null); 
  const [loading, setLoading] = useState(false);

  // This function can now be called with a token directly,
  // or it will use the one saved in state.
  const handleScan = async (currentToken) => {
    const tokenToUse = currentToken || token; // Use the provided token or the saved one

    if (!tokenToUse) {
      alert("Authentication token not found. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/.netlify/functions/scanGmail', {
        token: tokenToUse,
      });
      setPackages(response.data);
    } catch (error) {
      console.error("Error fetching packages:", error);
      alert("Failed to fetch packages. Please check the browser console for details.");
    }
    setLoading(false);
  };
  
  // This is the key change. We now immediately call handleScan
  // with the new token right after login.
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setUser({ loggedIn: true });
      const newToken = tokenResponse.access_token;
      setToken(newToken); // Save the token for later
      handleScan(newToken); // Trigger the first scan immediately
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: "https://www.googleapis.com/auth/gmail.readonly"
  });

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setToken(null);
    setPackages(initialPackages);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📦 Dispatch</h1>
        {!user ? (
          <div>
            <p>Sign in to track your packages.</p>
            <button onClick={() => login()} className="login-button">
              Sign in with Google
            </button>
          </div>
        ) : (
          <div>
            <h2>Your Deliveries</h2>
            <button onClick={handleLogout} style={{marginBottom: '10px', marginRight: '10px'}}>Logout</button>
            {/* This button now calls handleScan without an argument, so it uses the saved token */}
            <button onClick={() => handleScan()} style={{marginBottom: '10px'}} disabled={loading}>
              {loading ? 'Scanning...' : 'Refresh Packages'}
            </button>
            
            <PackageTable packages={packages} />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;