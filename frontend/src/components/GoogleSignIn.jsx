import React, { useEffect } from 'react';
import useAuthStore from '../stores/authStore';
import client from '../api/client';

export default function GoogleSignIn() {
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Initialize Google Sign-In
    window.google?.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '239644021087-p9u38lshg973ld12s4a8c0fmgemh6mah.apps.googleusercontent.com',
      callback: handleCredentialResponse,
    });

    window.google?.accounts.id.renderButton(
      document.getElementById("googleSignInDiv"),
      { theme: "outline", size: "large" }
    );
  }, []);

  async function handleCredentialResponse(response) {
    try {
      // Send ID token to your backend
      const res = await client.post('/api/auth/google', {
        token: response.credential
      });
      
      // Set authentication state
      setAuth(res.data.user, res.data.token);
    } catch (error) {
      console.error('Authentication failed:', error);
      alert('Failed to sign in with Google');
    }
  }

  return (
    <div id="googleSignInDiv"></div>
  );
}