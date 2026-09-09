import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Divider,
  Fade
} from "@mui/material";
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  PersonOutlined as PersonIcon,
  KeyOutlined as KeyIcon,
  MarkEmailReadOutlined as MailSentIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function AuthModal({
  open,
  onClose,
  initialMode = "login",
  initialToken = "",
  initialEmail = "",
  onLoginSuccess
}) {
  const [mode, setMode] = useState(initialMode); // "login" | "register" | "forgot" | "reset"
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync mode and prefilled params when props change
  useEffect(() => {
    if (open) {
      setMode(initialMode || "login");
      setErrorMsg("");
      setSuccessMsg("");
      if (initialToken) {
        setResetToken(initialToken);
        setMode("reset");
      }
      if (initialEmail) {
        setEmail(initialEmail);
      }
    }
  }, [open, initialMode, initialToken, initialEmail]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resetFormState = () => {
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const switchMode = (newMode) => {
    resetFormState();
    setMode(newMode);
  };

  // 1. Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!username.trim()) {
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
        identifier: username.trim(),
        password
      });

      const { access_token, user } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", user.username);
      if (user.email) localStorage.setItem("email", user.email);
      if (user.full_name) localStorage.setItem("fullName", user.full_name);

      setSuccessMsg("Signed in successfully! Welcome back.");
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(user, access_token);
        }
        onClose();
      }, 500);
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid login credentials. Please try again.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Register
  const handleRegister = async (e) => {
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
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-check.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim()
      });

      const { access_token, user } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("username", user.username);
      if (user.email) localStorage.setItem("email", user.email);
      if (user.full_name) localStorage.setItem("fullName", user.full_name);

      setSuccessMsg("Account created successfully! Welcome to CardioMind AI.");
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(user, access_token);
        }
        onClose();
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.detail || "Registration failed. Please try a different username or email.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password (Trigger Email OTP & Link)
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const queryTarget = email.trim() || username.trim();
    if (!queryTarget) {
      setErrorMsg("Please enter your registered email address or username.");
      return;
    }

    setLoading(true);
    try {
      const frontendUrl = window.location.origin;
      const res = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: queryTarget,
        frontend_url: frontendUrl
      });

      setMaskedEmail(res.data.email || queryTarget);
      if (res.data.target_email) {
        setEmail(res.data.target_email);
      }
      setSuccessMsg(`Verification code sent to ${res.data.email || queryTarget}! Check your inbox.`);
      setResendCooldown(60);
      
      // Advance to Reset mode where user can type OTP
      setTimeout(() => {
        setMode("reset");
        setErrorMsg("");
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not find an account with that email. Please check and try again.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Reset Password (Verify OTP / Token and Save New Password)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!resetToken && !otp.trim()) {
      setErrorMsg("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        new_password: password
      };

      if (resetToken) {
        payload.token = resetToken;
      } else {
        payload.email = email.trim();
        payload.otp = otp.trim();
      }

      const res = await axios.post(`${API_BASE}/auth/reset-password`, payload);
      setSuccessMsg(res.data.message || "Password reset successful!");

      setTimeout(() => {
        switchMode("login");
        setSuccessMsg("Your password was updated successfully. You can now sign in with your new password.");
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to reset password. The code or link may have expired.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "20px",
          bgcolor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(12, 21, 39, 0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }
      }}
    >
      {/* Brand Header Banner */}
      <Box
        sx={{
          bgcolor: "#0c1527",
          p: 3,
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          color: "#ffffff"
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            bgcolor: "#3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
            flexShrink: 0
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
            <path d="M4 11h3l2-4 3 8 2-5 2 3h4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.2 }}>
            CardioMind AI
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 500 }}>
            {mode === "login" && "Sign In to Access Clinical AI"}
            {mode === "register" && "Create Your Medical AI Account"}
            {mode === "forgot" && "Recover Account Access"}
            {mode === "reset" && "Set a New Secure Password"}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "#94a3b8",
            "&:hover": { color: "#ffffff", bgcolor: "rgba(255,255,255,0.1)" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3.5 }}>
        {/* Error and Success Alerts */}
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

        {/* ======================================================== */}
        {/* 1. SIGN IN / LOGIN FORM                                  */}
        {/* ======================================================== */}
        {mode === "login" && (
          <Box component="form" onSubmit={handleLogin} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                USERNAME OR EMAIL
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. doctor@hospital.org or dr_smith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    bgcolor: "#f8fafc"
                  }
                }}
              />
            </Box>

            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                  PASSWORD
                </Typography>
                <Typography
                  variant="caption"
                  onClick={() => switchMode("forgot")}
                  sx={{
                    color: "#3b82f6",
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" }
                  }}
                >
                  Forgot Password?
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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
                      <IconButton
                        size="small"
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
                    borderRadius: "10px",
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
                mt: 1,
                py: 1.2,
                borderRadius: "10px",
                bgcolor: "#3b82f6",
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                "&:hover": { bgcolor: "#2563eb" }
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
            </Button>

            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>OR</Typography>
            </Divider>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.88rem" }}>
                Don't have an account?{" "}
                <Box
                  component="span"
                  onClick={() => switchMode("register")}
                  sx={{
                    color: "#3b82f6",
                    fontWeight: 700,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" }
                  }}
                >
                  Create an Account
                </Box>
              </Typography>
            </Box>
          </Box>
        )}

        {/* ======================================================== */}
        {/* 2. SIGN UP / REGISTER FORM                               */}
        {/* ======================================================== */}
        {mode === "register" && (
          <Box component="form" onSubmit={handleRegister} sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                FULL NAME (OPTIONAL)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Dr. Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                USERNAME *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Choose a unique username"
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
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                PASSWORD (MIN 6 CHARS) *
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

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                CONFIRM PASSWORD *
              </Typography>
              <TextField
                fullWidth
                size="small"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: "#94a3b8" }}>
                        {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
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
                py: 1.2,
                borderRadius: "10px",
                bgcolor: "#3b82f6",
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                "&:hover": { bgcolor: "#2563eb" }
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Create Account"}
            </Button>

            <Box sx={{ textAlign: "center", mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.88rem" }}>
                Already have an account?{" "}
                <Box
                  component="span"
                  onClick={() => switchMode("login")}
                  sx={{
                    color: "#3b82f6",
                    fontWeight: 700,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" }
                  }}
                >
                  Sign In
                </Box>
              </Typography>
            </Box>
          </Box>
        )}

        {/* ======================================================== */}
        {/* 3. FORGOT PASSWORD (STEP 1: REQUEST OTP / EMAIL)        */}
        {/* ======================================================== */}
        {mode === "forgot" && (
          <Box component="form" onSubmit={handleForgotPassword} sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
            <Box sx={{ textAlign: "center", py: 1 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  bgcolor: "rgba(59, 130, 246, 0.1)",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 1.5
                }}
              >
                <KeyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "1.1rem" }}>
                Reset Your Password
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.85rem", mt: 0.5 }}>
                Enter your registered email address or username. We'll send you a 6-digit OTP verification code & direct reset link.
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                REGISTERED EMAIL OR USERNAME
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. user@hospital.org"
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

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.2,
                borderRadius: "10px",
                bgcolor: "#3b82f6",
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                "&:hover": { bgcolor: "#2563eb" }
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Send Verification Code"}
            </Button>

            <Box sx={{ textAlign: "center" }}>
              <Typography
                variant="body2"
                onClick={() => switchMode("login")}
                sx={{
                  color: "#64748b",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  "&:hover": { color: "#0f172a", textDecoration: "underline" }
                }}
              >
                &larr; Back to Sign In
              </Typography>
            </Box>
          </Box>
        )}

        {/* ======================================================== */}
        {/* 4. RESET PASSWORD (STEP 2: ENTER OTP & NEW PASSWORD)     */}
        {/* ======================================================== */}
        {mode === "reset" && (
          <Box component="form" onSubmit={handleResetPassword} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ textAlign: "center", py: 0.5 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  bgcolor: "rgba(16, 185, 129, 0.1)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 1
                }}
              >
                <MailSentIcon sx={{ fontSize: 26 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "1.05rem" }}>
                {resetToken ? "Set Your New Password" : "Enter Verification Code"}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.82rem", mt: 0.5 }}>
                {resetToken
                  ? "Your reset link was verified. Enter your new password below."
                  : `Enter the 6-digit code sent to ${maskedEmail || email || "your email"}.`}
              </Typography>
            </Box>

            {/* OTP Code Field (only if no direct URL token) */}
            {!resetToken && (
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                    6-DIGIT VERIFICATION CODE (OTP)
                  </Typography>
                  <Button
                    size="small"
                    disabled={resendCooldown > 0 || loading}
                    onClick={handleForgotPassword}
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
                  size="small"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputProps={{
                    maxLength: 6,
                    style: {
                      textAlign: "center",
                      letterSpacing: "6px",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      fontFamily: "monospace"
                    }
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "10px",
                      bgcolor: "#eff6ff",
                      border: "1px solid #bfdbfe"
                    }
                  }}
                />
              </Box>
            )}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                NEW PASSWORD (MIN 6 CHARS)
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

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", mb: 0.5, display: "block" }}>
                CONFIRM NEW PASSWORD
              </Typography>
              <TextField
                fullWidth
                size="small"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: "#94a3b8" }}>
                        {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
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
                py: 1.2,
                borderRadius: "10px",
                bgcolor: "#10b981",
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                "&:hover": { bgcolor: "#059669" }
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Save New Password"}
            </Button>

            <Box sx={{ textAlign: "center" }}>
              <Typography
                variant="body2"
                onClick={() => switchMode("login")}
                sx={{
                  color: "#64748b",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  "&:hover": { color: "#0f172a", textDecoration: "underline" }
                }}
              >
                &larr; Back to Sign In
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
