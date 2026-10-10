import { createContext, useContext, useEffect, useState } from 'react';
import { api, dataOf } from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('medisync_token');
    if (!token) { setChecking(false); return; }
    api.get('/auth/me').then(response => setUser(dataOf(response).user)).catch(() => sessionStorage.removeItem('medisync_token')).finally(() => setChecking(false));
  }, []);

  const login = async credentials => {
    const response = await api.post('/auth/login', credentials);
    const result = dataOf(response);
    sessionStorage.setItem('medisync_token', result.token);
    setUser(result.user);
    return result.user;
  };
  const logout = () => { sessionStorage.removeItem('medisync_token'); setUser(null); };
  return <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>;
}