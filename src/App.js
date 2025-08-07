import React, { useState } from 'react';
// UPDATED: We now import 'useGoogleLogin' instead of 'GoogleLogin'
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

  // NEW: We define the login process using the hook
  const login = useGoogleLogin({
    // This is the function that will run on a successful login
    onSuccess: (tokenResponse) => {
      setUser({ loggedIn: true });
      // The token is now correctly found in tokenResponse.access_token
      setToken(tokenResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    // We still must request permission to read mail
    scope: "https://www.googleapis.com/auth/gmail.readonly"
  });

  const handleScan = async () => {
    // This part is now correct and will find the token
    if (!token) {
      alert("Authentication token not found. Please log in again.");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post('/.netlify/functions/scanGmail', {
        token: token,
      });
      setPackages(response.data);
    } catch (error) {
      console.error("Error fetching packages:", error);
      alert("Failed to fetch packages. Check the console for details.");
    }
    setLoading(false);
  };

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
            {/* UPDATED: We now use a regular button that calls our login function */}
            <button onClick={() => login()} className="login-button">
              Sign in with Google
            </button>
          </div>
        ) : (
          <div>
            <h2>Your Deliveries</h2>
            <button onClick={handleLogout} style={{marginBottom: '10px', marginRight: '10px'}}>Logout</button>
            <button onClick={handleScan} style={{marginBottom: '10px'}} disabled={loading}>
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