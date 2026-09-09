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
  LockOutlined as LockIcon,
  PersonOutlined as PersonIcon,
  Verified as VerifiedIcon,
  ShowChart as ChartIcon,
  Security as SecurityIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!identifier.trim()) {
      setErrorMsg("Please enter your username or email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        identifier: identifier.trim(),
        password
      });

      const { access_token, user } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", user.username);
      if (user.email) localStorage.setItem("email", user.email);
      if (user.full_name) localStorage.setItem("fullName", user.full_name);

      setSuccessMsg("Welcome back! Signing you in...");
      if (onLoginSuccess) {
        onLoginSuccess(user, access_token);
      }
      setTimeout(() => {
        navigate("/heart-risk-prediction");
      }, 500);
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid login credentials. Please try again.";
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
        backgroundImage: "radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.15) 0px, transparent 50%)",
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
          
            bgcolor: "#ffffff"
          }}
        >
          {/* Left Brand Panel */}
          <Box
            sx={{
              flex: { xs: "1", md: "1.1" },
              bgcolor: "#0088ff",
              p: { xs: 4, md: 6 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "#ffffff",
              borderRight: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            {/* Top Logo */}
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
                Advanced Cardiovascular Risk Intelligence & Decision Support
              </Typography>
              <Typography variant="body2" sx={{ color: "#fff", fontSize: "0.95rem", lineHeight: 1.6, mb: 4 }}>
                Clinical-grade machine learning with Calibrated XGBoost, explainable SHAP reasoning, and grounded medical AI for physicians and patients.
              </Typography>

              {/* Feature Highlights */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <VerifiedIcon sx={{ color: "#10b981", fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                    Calibrated XGBoost & Multi-Model Risk Scoring
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <ChartIcon sx={{ color: "#3b82f6", fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                    Explainable AI (SHAP Waterfall & Feature Impact)
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <SecurityIcon sx={{ color: "#8b5cf6", fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                    Secure Clinical Authentication & Medical Reports
                  </Typography>
                </Box>
              </Box>
            </Box>

          
          </Box>

          {/* Right Login Form */}
          <Box
            sx={{
              flex: "1",
              p: { xs: 3.5, md: 6 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              bgcolor: "#ffffff"
            }}
          >
            <Box sx={{ mb: 3.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.6rem", mb: 0.5 }}>
                Sign In to Your Account
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.9rem" }}>
                Enter your credentials to access prediction models and reports.
              </Typography>
            </Box>

            {errorMsg && (
              <Fade in={Boolean(errorMsg)}>
                <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px", fontSize: "0.85rem" }}>
                  {errorMsg}
                </Alert>
              </Fade>
            )}
            {successMsg && (
              <Fade in={Boolean(successMsg)}>
                <Alert severity="success" sx={{ mb: 2.5, borderRadius: "10px", fontSize: "0.85rem" }}>
                  {successMsg}
                </Alert>
              </Fade>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.6, display: "block" }}>
                  USERNAME OR EMAIL ADDRESS
                </Typography>
                <TextField
                  fullWidth
                  placeholder="doctor@hospital.org or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: "#94a3b8", fontSize: 22 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                      bgcolor: "#f8fafc"
                    }
                  }}
                />
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                    PASSWORD
                  </Typography>
                  <Link
                    to="/forgot-password"
                    style={{
                      color: "#3b82f6",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      textDecoration: "none"
                    }}
                  >
                    Forgot Password?
                  </Link>
                </Box>
                <TextField
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: "#94a3b8", fontSize: 22 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ color: "#94a3b8" }}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                      bgcolor: "#f8fafc"
                    }
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  mt: 1.5,
                  py: 1.4,
                  borderRadius: "12px",
                  bgcolor: "#3b82f6",
                  fontWeight: 700,
                  fontSize: "1rem",
                  textTransform: "none",
                  boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                  "&:hover": { bgcolor: "#2563eb" }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In to CardioMind"}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>OR</Typography>
            </Divider>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.92rem" }}>
                Don't have an account yet?{" "}
                <Link
                  to="/register"
                  style={{
                    color: "#3b82f6",
                    fontWeight: 700,
                    textDecoration: "none"
                  }}
                >
                  Create an Account &rarr;
                </Link>
              </Typography>
            </Box>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
