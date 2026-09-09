import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
  CircularProgress,
  Container,
  Fade
} from "@mui/material";
import {
  EmailOutlined as EmailIcon,
  KeyOutlined as KeyIcon,
  ArrowBack as ArrowBackIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your registered email address or username.");
      return;
    }

    setLoading(true);
    try {
      const frontendUrl = window.location.origin;
      const res = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: email.trim(),
        frontend_url: frontendUrl
      });

      const target = res.data.target_email || email.trim();
      setSuccessMsg(`Verification code sent to ${res.data.email || target}! Redirecting to verification...`);

      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(target)}`);
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not find an account with that email. Please check and try again.";
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
      <Container maxWidth="sm">
        <Card
          sx={{
            borderRadius: "24px",
            p: { xs: 3.5, md: 5 },
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            bgcolor: "#ffffff"
          }}
        >
          {/* Header Icon */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "16px",
                bgcolor: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2
              }}
            >
              <KeyIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.5rem", mb: 0.5 }}>
              Reset Your Password
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Enter your registered email address or username. We'll send you a 6-digit OTP code and a 1-click reset link.
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

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.6, display: "block" }}>
                REGISTERED EMAIL OR USERNAME
              </Typography>
              <TextField
                fullWidth
                placeholder="doctor@hospital.org or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: "#94a3b8", fontSize: 22 }} />
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
                py: 1.3,
                borderRadius: "12px",
                bgcolor: "#3b82f6",
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                "&:hover": { bgcolor: "#2563eb" }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Send Reset Verification Code"}
            </Button>

            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Link
                to="/login"
                style={{
                  color: "#64748b",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to Sign In
              </Link>
            </Box>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
