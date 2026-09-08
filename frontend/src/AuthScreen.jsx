import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Avatar
} from '@mui/material';

const API_BASE = "http://localhost:8000/api";

export default function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState(0); // 0: Login, 1: Signup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (tab === 0) {
        // Login
        const res = await axios.post(`${API_BASE}/login`, { username, password });
        onLogin(res.data.access_token, res.data.username);
      } else {
        // Signup
        await axios.post(`${API_BASE}/signup`, { username, password });
        setSuccess('Account created successfully! You can now log in.');
        setTab(0);
        setPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      backgroundImage: 'radial-gradient(circle at 50% 50%, #1a233a 0%, #0b111e 100%)',
      p: 2
    }}>
      <Card sx={{ 
        maxWidth: 400, 
        width: '100%', 
        bgcolor: 'background.paper',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 4
      }}>
        <Box sx={{ 
          p: 3, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mb: 2 }}>
            <span style={{ fontSize: '1.5rem' }}>❤️</span>
          </Avatar>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', fontFamily: 'var(--font-heading)' }}>
            CardioMind
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            AI-Powered Clinical Research Platform
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Tabs 
            value={tab} 
            onChange={(e, v) => { setTab(v); setError(''); setSuccess(''); }} 
            centered 
            sx={{ mb: 3 }}
          >
            <Tab label="Login" />
            <Tab label="Sign Up" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              variant="outlined"
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ 
                py: 1.5, 
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '1.1rem',
                borderRadius: 2
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : (tab === 0 ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
