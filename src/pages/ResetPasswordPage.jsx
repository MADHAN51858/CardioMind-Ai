import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  Container,
  Fade
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  MarkEmailReadOutlined as MailSentIcon,
  ArrowBack as ArrowBackIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlToken = searchParams.get("token") || searchParams.get("reset_token") || "";
  const urlEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(urlEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (urlEmail) setEmail(urlEmail);
  }, [urlEmail]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email.trim() || resendCooldown > 0) return;
    try {
      const frontendUrl = window.location.origin;
      await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: email.trim(),
        frontend_url: frontendUrl
      });
      setSuccessMsg("A new verification code has been sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Failed to resend code.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!urlToken && !otp.trim()) {
      setErrorMsg("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        new_password: password
      };

      if (urlToken) {
        payload.token = urlToken;
      } else {
        payload.email = email.trim();
        payload.otp = otp.trim();
      }

      const res = await axios.post(`${API_BASE}/auth/reset-password`, payload);
      setSuccessMsg(res.data.message || "Password reset successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to reset password. The code or link may have expired.";
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
                bgcolor: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2
              }}
            >
              <MailSentIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: "1.5rem", mb: 0.5 }}>
              {urlToken ? "Set Your New Password" : "Verify Code & Set Password"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {urlToken
                ? "Your secure reset link is verified. Enter your new password below."
                : `Enter the 6-digit OTP code sent to ${email || "your email"} and set your new password.`}
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
            {/* If no token, show Email and OTP inputs */}
            {!urlToken && (
              <>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.6, display: "block" }}>
                    REGISTERED EMAIL
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    placeholder="name@hospital.org"
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
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                      6-DIGIT VERIFICATION CODE (OTP)
                    </Typography>
                    <Button
                      size="small"
                      disabled={resendCooldown > 0}
                      onClick={handleResend}
                      sx={{
                        fontSize: "0.75rem",
                        p: 0,
                        minWidth: "auto",
                        textTransform: "none",
                        color: resendCooldown > 0 ? "#94a3b8" : "#3b82f6"
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputProps={{
                      maxLength: 6,
                      style: {
                        textAlign: "center",
                        letterSpacing: "6px",
                        fontSize: "1.3rem",
                        fontWeight: 700,
                        fontFamily: "monospace"
                      }
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        bgcolor: "#eff6ff",
                        border: "1px solid #bfdbfe"
                      }
                    }}
                  />
                </Box>
              </>
            )}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.6, display: "block" }}>
                NEW PASSWORD (MIN 6 CHARACTERS)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
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
                borderRadius: "12px",
                bgcolor: "#10b981",
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                "&:hover": { bgcolor: "#059669" }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Save New Password"}
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
