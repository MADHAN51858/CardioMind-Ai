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
  Avatar,
  Chip
} from "@mui/material";
import {
  Close as CloseIcon,
  PersonOutlined as PersonIcon,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  BadgeOutlined as BadgeIcon,
  SaveOutlined as SaveIcon
} from "@mui/icons-material";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function ProfileModal({
  open,
  onClose,
  currentUser,
  onProfileUpdated,
  showToast
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync state with currentUser whenever modal opens
  useEffect(() => {
    if (open && currentUser) {
      setFullName(currentUser.fullName || "");
      setEmail(currentUser.email || "");
      setErrorMsg("");
    }
  }, [open, currentUser]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg("");

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${API_BASE}/auth/profile`,
        {
          full_name: cleanFullName,
          email: cleanEmail
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      const updatedUser = {
        username: currentUser.username,
        fullName: res.data?.user?.full_name || cleanFullName,
        email: res.data?.user?.email || cleanEmail
      };

      // Update localStorage
      localStorage.setItem("fullName", updatedUser.fullName);
      localStorage.setItem("email", updatedUser.email);

      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }

      if (showToast) {
        showToast("Profile updated successfully!", "success");
      }

      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to update profile. Please try again.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const initialLetter = (fullName || currentUser.username || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden"
        }
      }}
    >
      {/* Top Banner Header */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
          pt: 3.5,
          pb: 3,
          px: 3,
          position: "relative",
          color: "#ffffff",
          textAlign: "center"
        }}
      >
        <IconButton
          onClick={onClose}
          disabled={loading}
          size="small"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            color: "rgba(255,255,255,0.8)",
            bgcolor: "rgba(255,255,255,0.1)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.2)", color: "#ffffff" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* User Avatar */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: "#ffffff",
              color: "#2563eb",
              fontWeight: 800,
              fontSize: "1.75rem",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
              border: "3px solid rgba(255,255,255,0.8)"
            }}
          >
            {initialLetter}
          </Avatar>
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
          Edit Profile
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
          <Chip
            size="small"
            label={`@${currentUser.username}`}
            sx={{
              bgcolor: "rgba(255,255,255,0.2)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.75rem"
            }}
          />
        </Box>
      </Box>

      {/* Form Content */}
      <DialogContent sx={{ p: 3, bgcolor: "#ffffff" }}>
        {errorMsg && (
          <Alert
            severity="error"
            onClose={() => setErrorMsg("")}
            sx={{
              mb: 2.5,
              borderRadius: "10px",
              fontSize: "0.85rem",
              "& .MuiAlert-message": { width: "100%" }
            }}
          >
            {errorMsg}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}
        >
          {/* Username Field (Read Only) */}
          <TextField
            label="Username"
            value={currentUser.username}
            disabled
            fullWidth
            size="small"
            helperText="Username is unique and cannot be modified"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                </InputAdornment>
              )
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "#f8fafc",
                borderRadius: "10px"
              }
            }}
          />

          {/* Full Name Field */}
          <TextField
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            required
            size="small"
            placeholder="e.g. Dr. Alex Morgan"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeIcon fontSize="small" sx={{ color: "#3b82f6" }} />
                </InputAdornment>
              )
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                "&:hover fieldset": { borderColor: "#3b82f6" },
                "&.Mui-focused fieldset": { borderColor: "#2563eb" }
              }
            }}
          />

          {/* Email Address Field */}
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            size="small"
            placeholder="e.g. alex.morgan@cardio.org"
            helperText="Used for security notifications & password resets"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon fontSize="small" sx={{ color: "#3b82f6" }} />
                </InputAdornment>
              )
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                "&:hover fieldset": { borderColor: "#3b82f6" },
                "&.Mui-focused fieldset": { borderColor: "#2563eb" }
              }
            }}
          />

          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={loading}
              fullWidth
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "10px",
                color: "#64748b",
                borderColor: "#cbd5e1",
                py: 1,
                "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon fontSize="small" />
                )
              }
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "10px",
                bgcolor: "#2563eb",
                py: 1,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                "&:hover": { bgcolor: "#1d4ed8" }
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
