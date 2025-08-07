import React, { useState } from 'react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import axios from 'axios'; // Import axios to make API calls
import PackageTable from './PackageTable';
import './App.css';

const initialPackages = [
    { sender: 'System', carrier: 'App', description: 'Ready to scan for your packages!', date: 'Thursday, August 7', status: 'Idle' },
];

function App() {
  // State for the user, packages, the Google token, and loading status
  const [user, setUser] = useState(null);
  const [packages, setPackages] = useState(initialPackages);
  const [token, setToken] = useState(null); // Will hold the Google Access Token
  const [loading, setLoading] = useState(false); // True when scanning is in progress

  // This function now saves the access token we need for the backend
  const handleLoginSuccess = (credentialResponse) => {
    setUser({ loggedIn: true });
    setToken(credentialResponse.access_token);
  };

  // This is the function that calls our secure backend
  const handleScan = async () => {
    if (!token) {
      alert("Authentication token not found. Please log in again.");
      return;
    }
    setLoading(true); // Show loading indicator
    try {
      // Call our Netlify serverless function
      const response = await axios.post('/.netlify/functions/scanGmail', {
        token: token, // Send the token to the backend
      });
      // Update the table with the real data from the backend
      setPackages(response.data);
    } catch (error) {
      console.error("Error fetching packages:", error);
      alert("Failed to fetch packages. Check the console for details.");
    }
    setLoading(false); // Hide loading indicator
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setToken(null);
    setPackages(initialPackages); // Reset to initial state on logout
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📦 Dispatch</h1>
        {!user ? (
          <div>
            <p>Sign in to track your packages.</p>
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => console.log('Login Failed')}
              // IMPORTANT: We must request permission to read mail
              scope="https://www.googleapis.com/auth/gmail.readonly"
            />
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