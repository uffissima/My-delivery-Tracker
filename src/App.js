import React, { useState } from 'react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import PackageTable from './PackageTable'; // We will create this next
import './App.css';

function App() {
  const [user, setUser] = useState(null); // This will remember if you are logged in

  return (
    <div className="App">
      <header className="App-header">
        <h1>📦 Dispatch</h1>
        {!user ? (
          // Show this if you are logged out
          <div>
            <p>Sign in to track your packages.</p>
            <GoogleLogin
              onSuccess={() => setUser({ loggedIn: true })}
              onError={() => console.log('Login Failed')}
            />
          </div>
        ) : (
          // Show this if you are logged in
          <div>
            <h2>Your Deliveries</h2>
            <button onClick={() => { googleLogout(); setUser(null); }} style={{marginBottom: '20px'}}>
              Logout
            </button>
            <PackageTable />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;