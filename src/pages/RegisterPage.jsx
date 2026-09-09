import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Divider,
  Container,
  Fade
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  PersonOutlined as PersonIcon,
  Verified as VerifiedIcon,
  FavoriteBorder as HeartIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function RegisterPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!username.trim() || username.trim().length < 3) {
      setErrorMsg("Username must be at least 3 characters long.");
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      setErrorMsg("Please provide a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username: username.trim(),
        email: email.trim(),
        password
      });

      const { access_token, user } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", user.username);
      if (user.email) localStorage.setItem("email", user.email);

      setSuccessMsg("Account created successfully! Redirecting...");
      if (onLoginSuccess) {
        onLoginSuccess(user, access_token);
      }
      setTimeout(() => {
        navigate("/heart-risk-prediction");
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.detail || "Registration failed. Please check your information.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0c1527",
        backgroundImage: "radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.15) 0px, transparent 50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, md: 4 }
      }}
    >
      <Container maxWidth="lg">
        <Card
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            bgcolor: "#ffffff"
          }}
        >
          {/* Left Brand Panel */}
          <Box
            sx={{
              flex: { xs: "1", md: "1" },
              bgcolor: "#0088ff",
              p: { xs: 4, md: 6 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "#ffffff",
              borderRight: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    bgcolor: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(59, 130, 246, 0.45)"
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
                    <path d="M4 11h3l2-4 3 8 2-5 2 3h4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#ffffff", fontSize: "1.35rem", lineHeight: 1.1 }}>
                    CardioMind AI
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#fff", fontSize: "0.78rem", fontWeight: 500 }}>
                    Smarter Insights, Healthier Hearts.
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 800, color: "#f8fafc", mb: 2, fontSize: { xs: "1.6rem", md: "2rem" }, lineHeight: 1.25 }}>
                Join CardioMind Medical AI Network
              </Typography>
              <Typography variant="body2" sx={{ color: "#fff", fontSize: "0.95rem", lineHeight: 1.6, mb: 4 }}>
                Create your account to unlock continuous heart risk assessment, automated patient reports, and clinical AI chat assistant.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <VerifiedIcon sx={{ color: "#10b981", fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                    Instant PDF Medical Report Generation & Cloud Storage
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <HeartIcon sx={{ color: "#f43f5e", fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                    Continuous Risk Monitoring & History Tracking
                  </Typography>
                </Box>
              </Box>
            </Box>

         
          </Box>

          {/* Right Register Form */}
          <Box
            sx={{
              flex: "1.1",
              p: { xs: 3.5, md: 5 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              bgcolor: "#ffffff"
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.6rem", mb: 0.5 }}>
                Create Your Account
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.9rem" }}>
                Fill in your details to get started in seconds.
              </Typography>
            </Box>

            {errorMsg && (
              <Fade in={Boolean(errorMsg)}>
                <Alert severity="error" sx={{ mb: 2, borderRadius: "10px", fontSize: "0.85rem" }}>
                  {errorMsg}
                </Alert>
              </Fade>
            )}
            {successMsg && (
              <Fade in={Boolean(successMsg)}>
                <Alert severity="success" sx={{ mb: 2, borderRadius: "10px", fontSize: "0.85rem" }}>
                  {successMsg}
                </Alert>
              </Fade>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                  USERNAME *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="doctor_smith"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#f8fafc" } }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                  EMAIL ADDRESS *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="email"
                  placeholder="doctor@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#f8fafc" } }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                  PASSWORD (MIN 6 CHARACTERS) *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "#94a3b8" }}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#f8fafc" } }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  mt: 1,
                  py: 1.3,
                  borderRadius: "10px",
                  bgcolor: "#3b82f6",
                  fontWeight: 700,
                  fontSize: "0.98rem",
                  textTransform: "none",
                  boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                  "&:hover": { bgcolor: "#2563eb" }
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Complete Registration"}
              </Button>
            </Box>

            <Divider sx={{ my: 2.5 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>OR</Typography>
            </Divider>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.9rem" }}>
                Already registered?{" "}
                <Link
                  to="/login"
                  style={{
                    color: "#3b82f6",
                    fontWeight: 700,
                    textDecoration: "none"
                  }}
                >
                  Sign In &rarr;
                </Link>
              </Typography>
            </Box>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
