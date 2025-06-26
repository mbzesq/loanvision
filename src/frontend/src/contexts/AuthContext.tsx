import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User, AuthResponse, LoginRequest } from '@loanvision/shared/src/types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setToken(storedToken);
        setUser(parsedUser);
        
        // Set default axios header
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (credentials: LoginRequest) => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await axios.post<AuthResponse>(`${apiUrl}/api/auth/login`, credentials);
    
    const { token: newToken, user: newUser } = response.data;
    
    // Store in localStorage
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    // Set axios default header
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Update state
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Clear axios default header
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear state
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    isAuthenticated: !!token,
    user,
    token,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}