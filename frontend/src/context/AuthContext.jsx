// Auth Context: Module level logic for the feature area.
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { AuthContext } from './auth-context-core';

// Auth Provider: Runs Auth provider flow. Inputs: {. Returns: a function result.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore Session: Loads the current session user on initial render and restores auth state in memory. Inputs: none. Returns: a function result.
    const restoreSession = async () => {
      try {
        const response = await api.get('/user/me');
        setUser(response.data?.user || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Register: Registers a new account and signs the user in on success. Inputs: userData. Returns: side effects and response to caller.
  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { user } = response.data;
      setUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  };

  // Login: Authenticates a user and establishes a session through a response cookie. Inputs: email, password. Returns: side effects and response to caller.
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user } = response.data;
      setUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  };

  // Logout: Clears the auth cookie and resets client session state. Inputs: none. Returns: side effects and response to caller.
  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
