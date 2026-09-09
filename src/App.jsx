import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Drawer,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
  Grid,
  Card,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Avatar,
  Alert,
  Menu,
  Snackbar
} from "@mui/material";
import {
  Home as HomeIcon,
  Timeline as PipelineIcon,
  Compare as CompareIcon,
  Chat as ChatIcon,
  Assessment as ReportIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  GetApp as DownloadIcon,
  Person as PersonIcon,
  Send as SendIcon,
  Help as HelpIcon,
  LocalHospital as HospitalIcon,
  DeleteOutlineOutlined as DeleteIcon,
  WbSunnyOutlined as SunIcon,
  FavoriteBorder as HeartOutlineIcon,
  WaterDrop as DropIcon,
  Speed as PulseIcon,
  ShowChart as ChartIcon,
  DirectionsRun as RunIcon,
  Check as CheckIcon,
  ArrowForward as ArrowForwardIcon,
  InfoOutlined as InfoOutlinedIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Verified as VerifiedIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  OpenInNew as OpenInNewIcon,
  Logout as LogoutIcon,
  LockReset as LockResetIcon,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon
} from "@mui/icons-material";
import HospitalLocator from "./HospitalLocator";
import ChatMessage from "./ChatMessage";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

// Setup Axios Interceptor for auth
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Modern Clean Medical Light Theme (Exact Match with Target UI)
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb" },
    secondary: { main: "#6366f1" },
    background: { default: "#f3f6fc", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    success: { main: "#10b981", light: "#dcfce7" },
    warning: { main: "#f59e0b", light: "#fef3c7" },
    error: { main: "#ef4444", light: "#fee2e2" },
    divider: "#e2e8f0"
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    h1: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
    h3: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
    h4: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
    h5: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Outfit', sans-serif", fontWeight: 600 }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "12px"
        }
      }
    }
  }
});

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Current logged in user state
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (token && username) {
      return {
        username,
        email: localStorage.getItem("email") || "",
        fullName: localStorage.getItem("fullName") || username
      };
    }
    return null;
  });

  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // Toast / Snackbar Feedback
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const showToast = (message, severity = "success") => {
    setToast({ open: true, message, severity });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("fullName");
    setCurrentUser(null);
    setUserMenuAnchor(null);
    showToast("Signed out successfully.", "info");
    navigate("/login");
  };

  // Determine active tab from URL path
  const getActiveTabFromPath = (path) => {
    if (path.startsWith("/analysis")) return "Live Analysis";
    if (path.startsWith("/ai-chat")) return "CardioAI Chat";
    if (path.startsWith("/hospital-locator")) return "Hospital Locator";
    if (path.startsWith("/reports")) return "Reports";
    return "Heart Risk Prediction";
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  const [patientData, setPatientData] = useState({
    age: 52,
    sex: 1,
    cp: 1,
    trestbps: 125,
    chol: 215,
    fbs: 0,
    fbsVal: 120,
    thalach: 145,
    oldpeak: 0.0,
    exang: 0
  });

  // Pipeline State
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [liveViewMode, setLiveViewMode] = useState("auto");
  const [currentStage, setCurrentStage] = useState("");
  const [pipelineStages, setPipelineStages] = useState({
    validation: "pending",
    preprocessing: "pending",
    model_prediction: "pending",
    probability_calibration: "pending",
    shap_explanation: "pending",
    prediction: "pending"
  });

  const [predictionResult, setPredictionResult] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [apiHealth, setApiHealth] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportSuccessUrl, setReportSuccessUrl] = useState(null);
  const [reportError, setReportError] = useState(null);

  // Map State
  const [userLocation, setUserLocation] = useState(null);

  // Chat State
  const [chatChannels, setChatChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: "ai", text: "Hello! I am CardioAI Assistant. Ask me about heart health risk factors, clinical tests (ECG, angiography, stress testing), or your model prediction outcomes." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "CardioAI Chat") {
      scrollToBottom();
    }
  }, [chatMessages, activeTab]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchChannels = (selectChannelId = null, forceSelectFirst = false) => {
    axios.get(`${API_BASE}/chat/channels`, { headers: getAuthHeaders() })
      .then(res => {
        const channels = res.data || [];
        setChatChannels(channels);
        if (selectChannelId) {
          setActiveChannelId(selectChannelId);
          fetchMessages(selectChannelId);
        } else if (forceSelectFirst && channels.length > 0) {
          setActiveChannelId(channels[0].id);
          fetchMessages(channels[0].id);
        } else if (activeChannelId && !channels.some(c => c.id === activeChannelId)) {
          if (channels.length > 0) {
            setActiveChannelId(channels[0].id);
            fetchMessages(channels[0].id);
          } else {
            setActiveChannelId(null);
            setChatMessages([]);
          }
        }
      })
      .catch(err => console.error("fetchChannels error:", err));
  };

  const fetchMessages = (channelId) => {
    if (!channelId) return;
    setActiveChannelId(channelId);
    axios.get(`${API_BASE}/chat/channels/${channelId}/messages`, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.data || res.data.length === 0) {
          setChatMessages([{ sender: "ai", text: "Hello! I am CardioAI Assistant. Ask me about heart health risk factors, prevention guidelines, or your model prediction outcomes." }]);
        } else {
          setChatMessages(res.data);
        }
      })
      .catch(err => console.error("fetchMessages error:", err));
  };

  const handleNewChat = () => {
    setActiveChannelId(null);
    setChatMessages([]);
  };

  const handleDeleteChannel = async (e, channelId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_BASE}/chat/channels/${channelId}`, { headers: getAuthHeaders() });
      if (activeChannelId === channelId) {
        setActiveChannelId(null);
        setChatMessages([]);
      }
      fetchChannels(null, false);
    } catch (err) {
      console.error("Failed to delete channel:", err);
    }
  };

  const fetchMetadata = () => {
    axios.get(`${API_BASE}/health`)
      .then(res => setApiHealth(res.data?.status === "healthy"))
      .catch(() => setApiHealth(false));
  };

  const fetchHistory = () => {
    axios.get(`${API_BASE}/history`)
      .then(res => setHistoryList(res.data))
      .catch(() => {});
  };

  // Fetch health and history on mount
  useEffect(() => {
    fetchMetadata();
    fetchHistory();
    fetchChannels(null, true);
  }, []);

  useEffect(() => {
    if (activeTab === "CardioAI Chat") {
      fetchChannels();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Hospital Locator" && !userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error("Geolocation error:", error);
            // Default to NYC if denied
            setUserLocation({ lat: 40.7128, lng: -74.0060 });
          }
        );
      } else {
        setUserLocation({ lat: 40.7128, lng: -74.0060 });
      }
    }
  }, [activeTab, userLocation]);

  const handleInputChange = (field, val) => {
    let sanitizedVal = val;
    // Strict non-negative enforcement
    if (typeof val === "number") {
      sanitizedVal = Math.max(0, val);
    }
    setPatientData(prev => {
      const updated = { ...prev, [field]: sanitizedVal };
      if (field === "fbsVal") {
        updated.fbs = sanitizedVal > 120 ? 1 : 0;
      }
      return updated;
    });
  };

  // Run Pipeline SSE Stream & Predict
  const handleAnalyze = () => {
    // Client-side guard against negative inputs
    if (
      patientData.age < 0 ||
      patientData.trestbps < 0 ||
      patientData.chol < 0 ||
      patientData.thalach < 0
    ) {
      alert("Negative values are not permitted. Please enter non-negative clinical measurements.");
      return;
    }

    setPredictionResult(null);
    setPipelineLogs([]);
    setPipelineProgress(0);
    setPipelineActive(true);
    setLiveViewMode("auto");
    navigate("/analysis");
    setCurrentStage("validation");
    setPipelineStages({
      validation: "processing",
      preprocessing: "pending",
      model_prediction: "pending",
      probability_calibration: "pending",
      shap_explanation: "pending",
      prediction: "pending"
    });

    const payload = {
      age: Number(patientData.age),
      sex: Number(patientData.sex),
      cp: Number(patientData.cp || 1),
      trestbps: Number(patientData.trestbps),
      chol: Number(patientData.chol),
      fbs: Number(patientData.fbs !== undefined ? patientData.fbs : (patientData.fbsVal > 120 ? 1 : 0)),
      fbsVal: Number(patientData.fbsVal || 120),
      thalach: Number(patientData.thalach),
      exang: Number(patientData.exang || 0),
      oldpeak: Number(patientData.oldpeak || 0.0)
    };

    fetch(`${API_BASE}/predict-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function processChunk({ done, value }) {
          if (done) {
            setPipelineActive(false);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6).trim();
                try {
                  const data = JSON.parse(jsonStr);
                  setPipelineLogs(prev => [...prev, data]);
                  if (typeof data.progress === "number") {
                    setPipelineProgress(data.progress);
                  }
                  if (data.stage) {
                    setCurrentStage(data.stage);
                    setPipelineStages(prev => {
                      const next = { ...prev };
                      next[data.stage] = data.status || "completed";
                      if (data.stage === "validation" && data.status === "completed") next.preprocessing = "processing";
                      if (data.stage === "preprocessing" && data.status === "completed") next.model_prediction = "processing";
                      if (data.stage === "model_prediction" && data.status === "completed") next.probability_calibration = "processing";
                      if (data.stage === "probability_calibration" && data.status === "completed") next.shap_explanation = "processing";
                      if (data.stage === "shap_explanation" && data.status === "completed") next.prediction = "processing";
                      return next;
                    });
                  }

                  if (data.stage === "prediction" && data.status === "completed") {
                    setPipelineStages({
                      validation: "completed",
                      preprocessing: "completed",
                      model_prediction: "completed",
                      probability_calibration: "completed",
                      shap_explanation: "completed",
                      prediction: "completed"
                    });
                    setPredictionResult(data.result);
                    setPipelineActive(false);
                    fetchHistory();
                  }
                  if (data.stage === "error") {
                    setPipelineActive(false);
                  }
                } catch (e) {
                  console.error("Error parsing SSE data line:", e, trimmed);
                }
              }
            }
          }
          return reader.read().then(processChunk);
        }
        return reader.read().then(processChunk);
      })
      .catch((err) => {
        console.error("Stream connection failed:", err);
        setPipelineLogs(prev => [...prev, { stage: "error", message: "Inference stream error: " + err.message, progress: 0 }]);
        setPipelineActive(false);
      });
  };

  // Chat Handler
  const handleSendMessage = async (textToSend = null) => {
    const message = textToSend || chatInput;
    if (!message || !message.trim()) return;

    const newMsgs = [...chatMessages, { sender: "user", text: message }];
    setChatMessages(newMsgs);
    setChatInput("");
    setChatLoading(true);

    let currentChannelId = activeChannelId;

    const payload = {
      message: message,
      channel_id: currentChannelId,
      prediction_context: predictionResult ? {
        probability: predictionResult.probability,
        category: predictionResult.category,
        top_positive_features: predictionResult.top_positive_features,
        top_negative_features: predictionResult.top_negative_features
      } : null
    };

    setChatMessages(prev => [...prev, { sender: "ai", text: "" }]);

    const token = localStorage.getItem('token');
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const returnedChannelId = response.headers.get("X-Channel-Id") || response.headers.get("x-channel-id");
      if (returnedChannelId) {
        currentChannelId = returnedChannelId;
        setActiveChannelId(returnedChannelId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setChatMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: (updated[lastIdx].text || "") + chunk
              };
            }
            return updated;
          });
        }
      }

      fetchChannels(currentChannelId);
    } catch (err) {
      console.error("Stream data handling error:", err);
      setChatMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: updated[lastIdx].text
              ? updated[lastIdx].text + "\n\n⚠️ *Connection interrupted during streaming.*"
              : "⚠️ I encountered an issue connecting to the CardioAI server. Please check the backend connection."
          };
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Download PDF Report Directly
  const handleDownloadPDF = () => {
    if (!predictionResult) return;

    axios.post(`${API_BASE}/report`, {
      patient: patientData,
      prediction: predictionResult
    }, { responseType: 'blob' })
      .then(response => {
        const file = new Blob([response.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', `cardio_report_${predictionResult.id ? predictionResult.id.slice(0, 6) : 'latest'}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(err => {
        alert("Failed to download PDF report. Error: " + err.message);
      });
  };

  // Generate Complete Report & Upload to Cloudinary & Store in DB
  const handleGenerateAndUploadReport = async () => {
    if (!predictionResult) return;
    setGeneratingReport(true);
    setReportError(null);
    try {
      const response = await axios.post(`${API_BASE}/report/generate-and-upload`, {
        patient: patientData,
        prediction: predictionResult
      });
      if (response.data?.pdf_url) {
        setReportSuccessUrl(response.data.pdf_url);
        fetchHistory();
      }
    } catch (err) {
      console.error("Cloudinary report error:", err);
      const errMsg = err.response?.data?.detail || err.message || "Failed to generate and upload PDF report.";
      setReportError(errMsg);
    } finally {
      setGeneratingReport(false);
    }
  };

  const getStageIcon = (status) => {
    switch (status) {
      case "completed": return <SuccessIcon color="success" />;
      case "processing": return <CircularProgress size={20} color="primary" />;
      case "error": return <ErrorIcon color="error" />;
      default: return <HelpIcon color="disabled" />;
    }
  };

  // Nav menu item definitions with dedicated paths
  const navItems = [
    { text: "Heart Risk Prediction", path: "/heart-risk-prediction", icon: <HomeIcon /> },
    { text: "Live Analysis", path: "/analysis", icon: <PipelineIcon /> },
    { text: "CardioAI Chat", path: "/ai-chat", icon: <ChatIcon /> },
    { text: "Hospital Locator", path: "/hospital-locator", icon: <HospitalIcon /> },
    { text: "Reports", path: "/reports", icon: <ReportIcon /> }
  ];

  // Render standalone auth routes
  if (location.pathname === "/login") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            showToast(`Welcome back, ${user.full_name || user.username}!`, "success");
          }}
        />
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={toast.severity} variant="filled" sx={{ width: "100%", borderRadius: "10px", fontWeight: 600 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  if (location.pathname === "/register") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RegisterPage
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            showToast(`Welcome to CardioMind, ${user.full_name || user.username}!`, "success");
          }}
        />
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={toast.severity} variant="filled" sx={{ width: "100%", borderRadius: "10px", fontWeight: 600 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  if (location.pathname === "/forgot-password") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ForgotPasswordPage />
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={toast.severity} variant="filled" sx={{ width: "100%", borderRadius: "10px", fontWeight: 600 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  if (location.pathname === "/reset-password") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ResetPasswordPage />
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={toast.severity} variant="filled" sx={{ width: "100%", borderRadius: "10px", fontWeight: 600 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  if (location.pathname === "/") {
    return <Navigate to="/heart-risk-prediction" replace />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>

        {/* SIDEBAR NAVIGATION (Dark Navy as in Screenshot) */}
        <Drawer
          variant="permanent"
          sx={{
            width: 260,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: 260,
              boxSizing: "border-box",
              borderRight: "1px solid rgba(255, 255, 255, 0.06)",
              backgroundColor: "#0c1527",
              display: "flex",
              flexDirection: "column",
              color: "#94a3b8"
            }
          }}
        >
          {/* Brand Header */}
          <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                bgcolor: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.35)",
                flexShrink: 0
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
                <path d="M4 11h3l2-4 3 8 2-5 2 3h4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#ffffff", fontSize: "1.15rem", lineHeight: 1.2 }}>
                CardioMind AI
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 500 }}>
                Smarter Insights, Healthier Hearts.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.06)", mx: 2 }} />

          {/* Navigation Items */}
          <List sx={{ px: 1.5, py: 2 }}>
            {navItems.map((item) => {
              const isSelected = activeTab === item.text;
              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: "12px",
                      py: 1.2,
                      px: 2,
                      color: isSelected ? "#ffffff" : "#94a3b8",
                      bgcolor: isSelected ? "#3b82f6 !important" : "transparent",
                      boxShadow: isSelected ? "0 4px 14px rgba(59, 130, 246, 0.35)" : "none",
                      "&:hover": {
                        bgcolor: isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.05)",
                        color: "#ffffff"
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isSelected ? "#ffffff" : "#64748b",
                        minWidth: 38
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "0.9rem"
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          {/* Bottom Heartbeat Wave & Status Card */}
          <Box sx={{ mt: "auto", p: 2 }}>
            {/* Wave Vector SVG */}
            <Box sx={{ width: "100%", height: 36, opacity: 0.18, mb: 1.5, overflow: "hidden" }}>
              <svg width="100%" height="36" viewBox="0 0 200 36" fill="none" preserveAspectRatio="none">
                <path d="M0 18H50L58 4L66 32L74 12L82 24L90 18H200" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Box>

            <Box
              sx={{
                bgcolor: "#131d33",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "12px",
                p: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1.2
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: apiHealth ? "#10b981" : "#ef4444",
                  boxShadow: apiHealth ? "0 0 8px #10b981" : "0 0 8px #ef4444",
                  flexShrink: 0
                }}
              />
              <Box>
                <Typography variant="body2" sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.2 }}>
                  System Online
                </Typography>
             
              </Box>
            </Box>
          </Box>
        </Drawer>

        {/* MAIN BODY CONTAINER */}
        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>

          {/* TOP HEADER BAR (Crisp White with Search, Theme, User Profile) */}
          <Box
            sx={{
              height: 64,
              bgcolor: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              px: 3.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              position: "sticky",
              top: 0,
              zIndex: 100
            }}
          >
           

            {/* Header Right Actions */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <IconButton size="small" sx={{ color: "#64748b" }}>
                <SunIcon fontSize="small" />
              </IconButton>

              {currentUser ? (
                <>
                  {/* Logged-In User Profile Pill */}
                  <Box
                    onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      cursor: "pointer",
                      p: "4px 10px 4px 4px",
                      borderRadius: "20px",
                      bgcolor: "rgba(59, 130, 246, 0.06)",
                      border: "1px solid rgba(59, 130, 246, 0.15)",
                      transition: "all 0.2s ease",
                      "&:hover": { bgcolor: "rgba(59, 130, 246, 0.12)" }
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: "#3b82f6",
                        fontSize: "0.85rem",
                        fontWeight: 700
                      }}
                    >
                      {currentUser.fullName
                        ? currentUser.fullName.charAt(0).toUpperCase()
                        : currentUser.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ textAlign: "left", display: { xs: "none", sm: "block" } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.1 }}>
                        {currentUser.fullName || currentUser.username}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>
                        {currentUser.email || `@${currentUser.username}`}
                      </Typography>
                    </Box>
                    <ArrowDownIcon sx={{ fontSize: 16, color: "#64748b" }} />
                  </Box>

                  {/* Profile Menu */}
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={() => setUserMenuAnchor(null)}
                    PaperProps={{
                      sx: {
                        borderRadius: "14px",
                        boxShadow: "0 10px 30px -4px rgba(15, 23, 42, 0.12)",
                        border: "1px solid #e2e8f0",
                        minWidth: 220,
                        py: 0.5
                      }
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#0f172a" }}>
                        {currentUser.fullName || currentUser.username}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                        {currentUser.email || ""}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem
                      onClick={() => {
                        setUserMenuAnchor(null);
                        navigate("/reports");
                      }}
                      sx={{ fontSize: "0.88rem", py: 1 }}
                    >
                      <ListItemIcon>
                        <ReportIcon fontSize="small" sx={{ color: "#3b82f6" }} />
                      </ListItemIcon>
                      My Reports & History
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setUserMenuAnchor(null);
                        navigate("/forgot-password");
                      }}
                      sx={{ fontSize: "0.88rem", py: 1 }}
                    >
                      <ListItemIcon>
                        <LockResetIcon fontSize="small" sx={{ color: "#6366f1" }} />
                      </ListItemIcon>
                      Reset Password
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem
                      onClick={handleLogout}
                      sx={{ fontSize: "0.88rem", py: 1, color: "#ef4444" }}
                    >
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" sx={{ color: "#ef4444" }} />
                      </ListItemIcon>
                      Sign Out
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<LoginIcon sx={{ fontSize: 18 }} />}
                    onClick={() => navigate("/login")}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      color: "#475569",
                      borderRadius: "10px",
                      px: 1.8,
                      py: 0.6,
                      "&:hover": { bgcolor: "#f1f5f9", color: "#0f172a" }
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
                    onClick={() => navigate("/register")}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      bgcolor: "#3b82f6",
                      color: "#ffffff",
                      borderRadius: "10px",
                      px: 2,
                      py: 0.6,
                      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
                      "&:hover": { bgcolor: "#2563eb" }
                    }}
                  >
                    Register
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          {/* MAIN VIEW CONTENT AREA */}
          <Box component="main" sx={{ flexGrow: 1, p: 3.5, bgcolor: "#f3f6fc", overflowY: "auto" }}>
            <Container maxWidth="xl" disableGutters>

              {/* ======================================================== */}
              {/* TAB 1: HEART RISK PREDICTION (EXACT MATCH TO DESIGN)      */}
              {/* ======================================================== */}
              {activeTab === "Heart Risk Prediction" && (
                <Box className="animate-fade-in">
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: "flex-start",
                      gap: 3,
                      width: "100%"
                    }}
                  >

                    {/* LEFT COLUMN: Main Form Card (~67% width) */}
                    <Box
                      sx={{
                        flex: { xs: "1 1 100%", md: "1 1 64%", lg: "1 1 67%" },
                        minWidth: 0,
                        width: { xs: "100%", md: "auto" }
                      }}
                    >
                      <Card
                        sx={{
                          bgcolor: "#ffffff",
                          p: { xs: 2.5, sm: 3.5 },
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)"
                        }}
                      >
                        {/* Form Title & Banner */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3 }}>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: "14px",
                              bgcolor: "#eff6ff",
                              color: "#3b82f6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              border: "1px solid #dbeafe"
                            }}
                          >
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                              <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h4.78"/>
                            </svg>
                          </Box>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", fontSize: { xs: "1.25rem", sm: "1.45rem" } }}>
                              Heart Disease Risk Prediction
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5, lineHeight: 1.5 }}>
                              Enter the patient's health parameters below to get an AI-powered prediction of heart disease risk. This tool uses machine learning to analyze your inputs and provide a risk assessment.
                            </Typography>
                          </Box>
                        </Box>

                        {/* SECTION 1: Patient Information */}
                        <Box sx={{ mb: 3.5 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 700,
                              color: "#0f172a",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              pb: 1,
                              borderBottom: "1px solid #edf2f7"
                            }}
                          >
                            <PersonIcon sx={{ color: "#3b82f6", fontSize: 20 }} /> Patient Information
                          </Typography>

                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mt: 2 }}>
                            {/* Age */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <PersonIcon sx={{ fontSize: 16, color: "#64748b" }} /> Age (Years)
                              </Typography>
                              <TextField
                                fullWidth
                                placeholder="Enter age"
                                type="number"
                                value={patientData.age}
                                slotProps={{ htmlInput: { min: 0 } }}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleInputChange("age", isNaN(val) ? "" : Math.max(0, val));
                                }}
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }
                                }}
                              />
                       
                            </Box>

                            {/* Gender */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <span style={{ color: "#64748b", fontWeight: 700 }}>⚥</span> Gender
                              </Typography>
                              <FormControl fullWidth>
                                <Select
                                  value={patientData.sex}
                                  onChange={(e) => handleInputChange("sex", parseInt(e.target.value))}
                                  sx={{
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }}
                                >
                                  <MenuItem value={1}>Male</MenuItem>
                                  <MenuItem value={0}>Female</MenuItem>
                                </Select>
                              </FormControl>
                            </Box>
                          </Box>
                        </Box>

                        {/* SECTION 2: Health Parameters */}
                        <Box sx={{ mb: 3.5 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 700,
                              color: "#0f172a",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              pb: 1,
                              borderBottom: "1px solid #edf2f7"
                            }}
                          >
                            <PulseIcon sx={{ color: "#3b82f6", fontSize: 20 }} /> Health Parameters
                          </Typography>
                          {/* Row 1: Resting BP, Cholesterol, Fasting Blood Sugar */}
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2.5, mt: 2 }}>
                            {/* Resting Blood Pressure */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <HeartOutlineIcon sx={{ fontSize: 16, color: "#64748b" }} /> Blood Pressure (mm Hg)
                              </Typography>
                              <TextField
                                fullWidth
                                placeholder="Enter value"
                                type="number"
                                value={patientData.trestbps}
                                slotProps={{ htmlInput: { min: 0 } }}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleInputChange("trestbps", isNaN(val) ? "" : Math.max(0, val));
                                }}
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }
                                }}
                              />
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.2 }}>
                                Measured via home BP cuff or clinic reading.
                              </Typography>
                            </Box>

                            {/* Serum Cholesterol */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <DropIcon sx={{ fontSize: 16, color: "#64748b" }} /> Serum Cholesterol (mg/dl)
                              </Typography>
                              <TextField
                                fullWidth
                                placeholder="Enter value"
                                type="number"
                                value={patientData.chol}
                                slotProps={{ htmlInput: { min: 0 } }}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleInputChange("chol", isNaN(val) ? "" : Math.max(0, val));
                                }}
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }
                                }}
                              />
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.2 }}>
                                From standard lipid panel checkup.
                              </Typography>
                            </Box>

                            {/* Fasting Blood Sugar */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <DropIcon sx={{ fontSize: 16, color: "#64748b" }} /> Fasting Blood Sugar (mg/dl)
                              </Typography>
                              <TextField
                                fullWidth
                                placeholder="Enter value"
                                type="number"
                                value={patientData.fbsVal || 120}
                                slotProps={{ htmlInput: { min: 0 } }}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleInputChange("fbsVal", isNaN(val) ? "" : Math.max(0, val));
                                }}
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }
                                }}
                              />
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.2 }}>
                                Fasting blood glucose or finger-prick test.
                              </Typography>
                            </Box>
                          </Box>

                          {/* Row 2: Chest Pain Type, Exercise-Induced Angina, Heart Rate / Pulse */}
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2.5, mt: 2.5 }}>
                            {/* Chest Pain Type */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <PulseIcon sx={{ fontSize: 16, color: "#64748b" }} /> Chest Pain Type
                              </Typography>
                              <FormControl fullWidth>
                                <Select
                                  value={patientData.cp || 1}
                                  onChange={(e) => handleInputChange("cp", parseInt(e.target.value))}
                                  sx={{
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }}
                                >
                                  <MenuItem value={1}>Typical Angina (Pressure/Pain)</MenuItem>
                                  <MenuItem value={2}>Atypical Angina (Dyspnea/Atypical)</MenuItem>
                                  <MenuItem value={3}>Non-Anginal (Sharp/Musculoskeletal)</MenuItem>
                                  <MenuItem value={4}>Asymptomatic (Silent CAD/Checkup)</MenuItem>
                                </Select>
                              </FormControl>
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.8 }}>
                                Primary chest symptom classification.
                              </Typography>
                            </Box>

                            {/* Exercise-Induced Angina */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <RunIcon sx={{ fontSize: 16, color: "#64748b" }} /> Exercise-Induced Angina
                              </Typography>
                              <FormControl fullWidth>
                                <Select
                                  value={patientData.exang}
                                  onChange={(e) => handleInputChange("exang", parseInt(e.target.value))}
                                  sx={{
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }}
                                >
                                  <MenuItem value={0}>No (None during exertion)</MenuItem>
                                  <MenuItem value={1}>Yes (Chest pain on exertion)</MenuItem>
                                </Select>
                              </FormControl>
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.8 }}>
                                Discomfort or pressure during physical activity.
                              </Typography>
                            </Box>

                            {/* Heart Rate / Pulse */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <ChartIcon sx={{ fontSize: 16, color: "#64748b" }} /> Heart Rate / Pulse (bpm)
                              </Typography>
                              <TextField
                                fullWidth
                                placeholder="Enter value"
                                type="number"
                                value={patientData.thalach}
                                slotProps={{ htmlInput: { min: 0 } }}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleInputChange("thalach", isNaN(val) ? "" : Math.max(0, val));
                                }}
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }
                                }}
                              />
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.2 }}>
                                Resting pulse or peak stress heart rate.
                              </Typography>
                            </Box>
                          </Box>

                          {/* Row 3: ST Depression (ECG) */}
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr" }, gap: 2.5, mt: 2.5 }}>
                            {/* ST Depression */}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.8, display: "flex", alignItems: "center", gap: 0.8 }}>
                                <ChartIcon sx={{ fontSize: 16, color: "#64748b" }} /> ECG ST Depression (oldpeak)
                              </Typography>
                              <FormControl fullWidth>
                                <Select
                                  value={patientData.oldpeak || 0.0}
                                  onChange={(e) => handleInputChange("oldpeak", parseFloat(e.target.value))}
                                  sx={{
                                    bgcolor: "#ffffff",
                                    borderRadius: "10px",
                                    "& fieldset": { borderColor: "#e2e8f0" }
                                  }}
                                >
                                  <MenuItem value={0.0}>Normal ST Segment (0.0 mm)</MenuItem>
                                  <MenuItem value={1.0}>Mild ST Depression (1.0 mm)</MenuItem>
                                  <MenuItem value={2.0}>Significant ST Depression (2.0 mm)</MenuItem>
                                  <MenuItem value={3.0}>Severe ST Depression (≥ 3.0 mm)</MenuItem>
                                </Select>
                              </FormControl>
                              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem", display: "block", mt: 0.8 }}>
                                Exercise or resting ST segment depression relative to baseline (ischemia indicator).
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Submit Button */}
                        <Box sx={{ mt: 4 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleAnalyze}
                            endIcon={<ArrowForwardIcon />}
                            disabled={pipelineActive}
                            sx={{
                              py: 1.6,
                              borderRadius: "12px",
                              bgcolor: "#4361ee",
                              fontSize: "1.05rem",
                              fontWeight: 700,
                              textTransform: "none",
                              boxShadow: "0 6px 18px rgba(67, 97, 238, 0.35)",
                              "&:hover": { bgcolor: "#3451d1" }
                            }}
                          >
                            {pipelineActive ? "Analyzing Parameters..." : "Predict Risk"}
                          </Button>
                        </Box>
                      </Card>

                      {/* Instant Prediction Result Card if Available */}
                      {predictionResult && (
                        <Card
                          sx={{
                            mt: 3,
                            p: 3.5,
                            bgcolor: "#ffffff",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)"
                          }}
                          className="animate-fade-in"
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, pb: 1.5, borderBottom: "1px solid #edf2f7" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: "10px",
                                  bgcolor: (predictionResult.probability <= 0.35) ? "#dcfce7" : (predictionResult.probability <= 0.70) ? "#fef3c7" : "#fee2e2",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <VerifiedIcon sx={{ color: (predictionResult.probability <= 0.35) ? "#10b981" : (predictionResult.probability <= 0.70) ? "#f59e0b" : "#ef4444" }} />
                              </Box>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                                  AI Prediction Assessment
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>
                                  Calibrated Risk Classification & Key Factors
                                </Typography>
                              </Box>
                            </Box>

                            <Chip
                              label={predictionResult.category}
                              sx={{
                                fontWeight: 700,
                                px: 1,
                                bgcolor: (predictionResult.probability <= 0.35) ? "#dcfce7" : (predictionResult.probability <= 0.70) ? "#fef3c7" : "#fee2e2",
                                color: (predictionResult.probability <= 0.35) ? "#15803d" : (predictionResult.probability <= 0.70) ? "#b45309" : "#b91c1c"
                              }}
                            />
                          </Box>

                          <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ p: 2.5, bgcolor: "#f8fafc", borderRadius: 3, textAlign: "center", border: "1px solid #e2e8f0" }}>
                                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
                                  CALIBRATED RISK PROBABILITY
                                </Typography>
                                <Typography variant="h3" sx={{ fontWeight: 800, color: predictionResult.probability > 0.5 ? "#ef4444" : "#10b981", my: 0.5 }}>
                                  {(predictionResult.probability * 100).toFixed(1)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>
                                  Confidence: {predictionResult.confidence || "High"}
                                </Typography>
                              </Box>
                            </Grid>

                            <Grid item xs={12} sm={8}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 1 }}>
                                Key Risk Influences (SHAP Explainability):
                              </Typography>
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                  {predictionResult.top_positive_features?.map((f, i) => {
                                    const val = f.value ?? f.shap_value ?? f.transformed_value;
                                    const valStr = typeof val === 'number' ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : (val !== undefined ? String(val) : '');
                                    return (
                                      <Chip
                                        key={i}
                                        label={`+ ${f.feature}${valStr ? `: ${valStr}` : ''}`}
                                        size="small"
                                        sx={{ bgcolor: "#fee2e2", color: "#b91c1c", fontWeight: 600, fontSize: "0.75rem" }}
                                      />
                                    );
                                  })}
                                  {predictionResult.top_negative_features?.map((f, i) => {
                                    const val = f.value ?? f.shap_value ?? f.transformed_value;
                                    const valStr = typeof val === 'number' ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : (val !== undefined ? String(val) : '');
                                    return (
                                      <Chip
                                        key={i}
                                        label={`- ${f.feature}${valStr ? `: ${valStr}` : ''}`}
                                        size="small"
                                        sx={{ bgcolor: "#dcfce7", color: "#15803d", fontWeight: 600, fontSize: "0.75rem" }}
                                      />
                                    );
                                  })}
                                </Box>

                              <Box sx={{ display: "flex", gap: 1.5, mt: 2.5, flexWrap: "wrap", alignItems: "center" }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<PipelineIcon />}
                                  onClick={() => navigate("/analysis")}
                                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                                >
                                  View Live Analysis
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<ChatIcon />}
                                  onClick={() => navigate("/ai-chat")}
                                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                                >
                                  Consult CardioAI Chat
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="success"
                                  startIcon={generatingReport ? <CircularProgress size={16} color="inherit" /> : <ReportIcon />}
                                  onClick={handleGenerateAndUploadReport}
                                  disabled={generatingReport || !predictionResult}
                                  sx={{
                                    borderRadius: "8px",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    bgcolor: "#10b981",
                                    "&:hover": { bgcolor: "#059669" }
                                  }}
                                >
                                  {generatingReport ? "Generating & Uploading..." : "Generate Complete Report"}
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={handleDownloadPDF}
                                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                                >
                                  Download PDF
                                </Button>
                              </Box>

                              {/* Tab 1 Report Success Link Banner */}
                              {reportSuccessUrl && (
                                <Box sx={{ mt: 2, p: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <SuccessIcon color="success" fontSize="small" />
                                    <Typography variant="body2" sx={{ color: "#166534", fontWeight: 700, fontSize: "0.82rem" }}>
                                      PDF Report saved to Cloudinary & Database!
                                    </Typography>
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    href={reportSuccessUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    startIcon={<OpenInNewIcon fontSize="small" />}
                                    sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, fontSize: "0.78rem", py: 0.3 }}
                                  >
                                    Open PDF Report ↗
                                  </Button>
                                </Box>
                              )}
                            </Grid>
                          </Grid>
                        </Card>
                      )}
                    </Box>

                    {/* RIGHT COLUMN: Info Stack (~33% width, side-by-side on desktop) */}
                    <Box
                      sx={{
                        flex: { xs: "1 1 100%", md: "0 0 35%", lg: "0 0 32%" },
                        width: { xs: "100%", md: "35%", lg: "32%" },
                        minWidth: { md: 280, lg: 320 },
                        display: "flex",
                        flexDirection: "column",
                        gap: 2.5
                      }}
                    >

                      {/* CARD 1: Hero Banner Card (3D Heart Illustration + Early Detection) */}
                      <Card
                        sx={{
                          background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 100%)",
                          p: 2.5,
                          borderRadius: "12px",
                          border: "1px solid #bfdbfe",
                          boxShadow: "0 4px 15px rgba(59, 130, 246, 0.08)"
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                          <Box
                            component="img"
                            src="/heart_3d.jpg"
                            alt="Early Detection Saves Lives"
                            sx={{
                              width: "100%",
                              height: "30%",
                              objectFit: "cover",
                              borderRadius: "14px",
                              boxShadow: "0 4px 14px rgba(0,0,0,0.06)"
                            }}
                          />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", mt: 1.5, fontSize: "1.15rem" }}>
                          Early Detection Saves Lives
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#475569", mt: 0.5, fontSize: "0.85rem", lineHeight: 1.4 }}>
                          Know your heart health risk  </Typography>
                      </Card>

                      {/* CARD 2: About This Tool */}
                      <Card
                        sx={{
                          bgcolor: "#ffffff",
                          p: 2.5,
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                          <InfoOutlinedIcon sx={{ color: "#3b82f6", fontSize: 20 }} /> About This Tool
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5, mb: 2 }}>
                          This AI-powered system analyzes your health parameters using machine learning algorithms to predict the likelihood of heart disease.
                        </Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                          {[
                            "Uses real-world clinical parameters",
                            "Trained on medical datasets",
                            "Provides quick and accurate results",
                            "Not a substitute for professional medical advice"
                          ].map((item, idx) => (
                            <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1.2 }}>
                              <Box
                                sx={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  bgcolor: "#eff6ff",
                                  color: "#3b82f6",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  mt: 0.2
                                }}
                              >
                                <CheckIcon sx={{ fontSize: 13, stroke: "#3b82f6", strokeWidth: 1.5 }} />
                              </Box>
                              <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.82rem", fontWeight: 500 }}>
                                {item}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Card>


               

                    </Box>

                  </Box>
                </Box>
              )}

              {/* ======================================================== */}
              {/* TAB 2: LIVE ANALYSIS PIPELINE                            */}
              {/* ======================================================== */}
              {activeTab === "Live Analysis" && (
                <Box className="animate-fade-in">
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a" }}>AI Inference Execution Pipeline</Typography>
                 </Box>

                  {/* Live Analysis Pipeline Row (40% Left / 60% Right) */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: "stretch",
                      gap: 3,
                      width: "100%",
                      minHeight: 520
                    }}
                  >
                    {/* Left Column (40% width): Pipeline Tracking Matrix */}
                    <Box sx={{ width: { xs: "100%", md: "40%" }, flex: { xs: "1 1 100%", md: "0 0 40%" }, minWidth: 0, display: "flex" }}>
                      <Card
                        sx={{
                          bgcolor: "#ffffff",
                          p: 3,
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
                        }}
                      >
                        <Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                              <PipelineIcon color="primary" /> Pipeline Tracking Matrix
                            </Typography>
                           
                          </Box>

                          <List sx={{ width: "100%", p: 0 }}>
                            {[
                              { key: "validation", label: "Patient Data Validation" },
                              { key: "preprocessing", label: "Feature Preprocessing & Scaling" },
                              { key: "model_prediction", label: "Multi-Model Comparative Inference" },
                              { key: "probability_calibration", label: "Probability Calibration (Platt Scaling)" },
                              { key: "shap_explanation", label: "SHAP Explainability Calculation" },
                              { key: "prediction", label: "Final Prediction Compilation" }
                            ].map((stage) => {
                              const status = pipelineStages[stage.key] || "pending";
                              return (
                                <ListItem
                                  key={stage.key}
                                  sx={{
                                    mb: 1,
                                    p: 1.4,
                                    py:1,
                                    borderRadius: "10px",
                                    bgcolor: status === "processing" ? "#eff6ff" : status === "completed" ? "#f0fdf4" : "#f8fafc",
                                    border: status === "processing" ? "1px solid #bfdbfe" : "1px solid #e2e8f0"
                                  }}
                                  secondaryAction={getStageIcon(status)}
                                >
                                  <ListItemText
                                    primary={stage.label}
                                    secondary={status.toUpperCase()}
                                    primaryTypographyProps={{ fontWeight: currentStage === stage.key ? 700 : 500, color: "#0f172a", fontSize: "0.85rem" }}
                                    secondaryTypographyProps={{
                                      color: status === "completed" ? "success.main" : status === "processing" ? "primary.main" : "text.secondary",
                                      fontWeight: 700,
                                      fontSize: "0.70rem"
                                    }}
                                  />
                                </ListItem>
                              );
                            })}
                          </List>
                        </Box>

                        <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #edf2f7" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                            <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>Total Progress</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: "#3b82f6" }}>{pipelineProgress}%</Typography>
                          </Box>
                          <Box sx={{ position: "relative", width: "100%", bgcolor: "#e2e8f0", height: 8, borderRadius: 4, overflow: "hidden" }}>
                            <Box sx={{ width: `${pipelineProgress}%`, bgcolor: "#3b82f6", height: "100%", borderRadius: 4, transition: "width 0.4s ease-in-out" }} />
                          </Box>
                        </Box>
                      </Card>
                    </Box>

                    {/* Right Column (60% width): Swaps between AI Activity Stream and Multi-Model Decision Matrix */}
                    <Box sx={{ width: { xs: "100%", md: "calc(60% - 24px)" }, flex: { xs: "1 1 100%", md: "1 1 calc(60% - 24px)" }, minWidth: 0, display: "flex" }}>
                      {(!predictionResult || pipelineActive || liveViewMode === "logs") ? (
                        /* BEFORE / DURING ANALYSIS: AI Activity Stream */
                        <Card sx={{ bgcolor: "#ffffff", p: 3, borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", width: "100%", height: "100%", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                              <CompareIcon color="primary" /> AI Activity Stream
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              {predictionResult && !pipelineActive && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setLiveViewMode("matrix")}
                                  sx={{ textTransform: "none", fontSize: "0.75rem", borderRadius: "8px", py: 0.3 }}
                                >
                                  View Decision Matrix
                                </Button>
                              )}
                              {pipelineActive && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <CircularProgress size={16} color="primary" />
                                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>Processing...</Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>

                          <Box sx={{ bgcolor: "#0c1527", p: 2.5, borderRadius: "12px", fontFamily: "monospace", fontSize: 13, flexGrow: 1, minHeight: 380, maxHeight: 520, overflowY: "auto" }}>
                            {pipelineLogs.length === 0 ? (
                              <></>
                            ) : (
                              pipelineLogs.map((log, idx) => (
                                <Box key={idx} sx={{ mb: 1, color: log.stage === "error" ? "#ef4444" : "#10b981" }}>
                                  <Box sx={{ fontWeight: 600 }}>
                                    &gt; [{log.stage ? log.stage.toUpperCase() : "LOG"}] {log.message}
                                  </Box>
                                  {log.details && (
                                    <Box sx={{ pl: 2, mt: 0.5, color: "#94a3b8", fontSize: 12 }}>
                                      {Object.entries(log.details).map(([k, v]) => (
                                        <div key={k}>
                                          <span style={{ color: "#60a5fa" }}>{k}:</span> {Array.isArray(v) ? v.join(", ") : v}
                                        </div>
                                      ))}
                                    </Box>
                                  )}
                                </Box>
                              ))
                            )}
                            {pipelineActive && (
                              <Box sx={{ color: "#60a5fa", fontStyle: "italic", mt: 1 }}>
                                &gt; Processing stage [{currentStage.toUpperCase()}]...
                              </Box>
                            )}
                          </Box>
                        </Card>
                      ) : (
                        /* AFTER ANALYSIS COMPLETE: Multi-Model Decision Matrix & Feature Importance Card */
                        <Card sx={{ bgcolor: "#ffffff", p: 3, borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", width: "100%", height: "100%", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }} className="animate-fade-in">
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, pb: 1.5, borderBottom: "1px solid #edf2f7" }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                              <ChartIcon color="primary" /> Multi-Model Decision Matrix & Feature Importance
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setLiveViewMode("logs")}
                              sx={{ textTransform: "none", fontSize: "0.75rem", borderRadius: "8px", py: 0.3 }}
                            >
                              View Raw Logs
                            </Button>
                          </Box>

                          {/* Top Outcome Banner */}
                          <Box sx={{ p: 2.5, mb: 2, bgcolor: predictionResult.probability > 0.5 ? "#fef2f2" : "#f0fdf4", borderRadius: "12px", border: predictionResult.probability > 0.5 ? "1px solid #fecaca" : "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, letterSpacing: 0.5 }}>PREDICTION OUTCOME</Typography>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: predictionResult.probability > 0.5 ? "#dc2626" : "#16a34a", mt: 0.3 }}>
                                {predictionResult.category}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: "right" }}>
                              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>CALIBRATED PROBABILITY</Typography>
                              <Typography variant="h4" sx={{ fontWeight: 800, color: predictionResult.probability > 0.5 ? "#dc2626" : "#16a34a" }}>
                                {(predictionResult.probability * 100).toFixed(1)}%
                              </Typography>
                            </Box>
                          </Box>

                          {/* Multi-Model Comparative Grid */}
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 1 }}>
                            Multi-Model Ensemble Comparative Breakdown:
                          </Typography>
                          <Grid container spacing={1.5} sx={{ mb: 2 }}>
                            {[
                              { key: "logistic_regression", name: "Logistic Regression", raw: predictionResult.model_outputs?.logistic_regression?.raw_probability, cal: predictionResult.model_outputs?.logistic_regression?.calibrated_probability },
                              { key: "random_forest", name: "Random Forest", raw: predictionResult.model_outputs?.random_forest?.raw_probability, cal: predictionResult.model_outputs?.random_forest?.calibrated_probability },
                              { key: "svm", name: "SVM (Support Vector)", raw: predictionResult.model_outputs?.svm?.raw_probability, cal: predictionResult.model_outputs?.svm?.calibrated_probability },
                              { key: "xgboost", name: "XGBoost (Primary)", raw: predictionResult.model_outputs?.xgboost?.raw_probability, cal: predictionResult.model_outputs?.xgboost?.calibrated_probability ?? predictionResult.probability },
                            ].map((mItem) => (
                              <Grid item xs={6} sm={3} key={mItem.key}>
                                <Box sx={{ p: 1.2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                                  <Typography variant="caption" sx={{ color: "#475569", fontWeight: 700, display: "block", fontSize: "0.72rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {mItem.name}
                                  </Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 800, color: "#0f172a", my: 0.3 }}>
                                    {typeof mItem.cal === 'number' ? `${(mItem.cal * 100).toFixed(1)}%` : '--'}
                                  </Typography>
                                 
                                </Box>
                              </Grid>
                            ))}
                          </Grid>

                          {/* SHAP Feature Influences */}
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", mb: 0.8 }}>
                            Model Contributions (Positive vs Negative Influences):
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
                            {predictionResult.top_positive_features?.map((f, i) => {
                              const val = f.value ?? f.shap_value ?? f.transformed_value;
                              const valStr = typeof val === 'number' ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : (val !== undefined ? String(val) : '');
                              return (
                                <Chip
                                  key={i}
                                  label={`+ ${f.feature}${valStr ? `: ${valStr}` : ''}`}
                                  sx={{ bgcolor: "#fee2e2", color: "#b91c1c", fontWeight: 600, fontSize: "0.78rem" ,borderRadius:"8px"}}
                                />
                              );
                            })}
                            {predictionResult.top_negative_features?.map((f, i) => {
                              const val = f.value ?? f.shap_value ?? f.transformed_value;
                              const valStr = typeof val === 'number' ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : (val !== undefined ? String(val) : '');
                              return (
                                <Chip
                                  key={i}
                                  label={`- ${f.feature}${valStr ? `: ${valStr}` : ''}`}
                                  sx={{ bgcolor: "#dcfce7", color: "#15803d", fontWeight: 600, fontSize: "0.78rem" ,borderRadius:"8px"}}
                                />
                              );
                            })}
                          </Box>

                          {/* Actions */}
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: "auto", pt: 1.5, borderTop: "1px solid #edf2f7" }}>
                            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<ChatIcon />}
                                onClick={() => navigate("/ai-chat")}
                                sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" } }}
                              >
                                Consult CardioAI Assistant
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PipelineIcon />}
                                onClick={handleAnalyze}
                                sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600 }}
                              >
                                Re-run Analysis
                              </Button>
                              <Button
                                variant="contained"
                                size="small"
                                color="success"
                                startIcon={generatingReport ? <CircularProgress size={16} color="inherit" /> : <ReportIcon />}
                                onClick={handleGenerateAndUploadReport}
                                disabled={generatingReport || !predictionResult}
                                sx={{
                                  textTransform: "none",
                                  borderRadius: "10px",
                                  fontWeight: 700,
                                  bgcolor: "#10b981",
                                  "&:hover": { bgcolor: "#059669" }
                                }}
                              >
                                {generatingReport ? "Generating & Uploading..." : "Generate Complete Report"}
                              </Button>
                            </Box>

                            {/* Report Status Alert / Success Link */}
                            {reportError && (
                              <Alert severity="error" onClose={() => setReportError(null)} sx={{ borderRadius: "10px", py: 0.5, fontSize: "0.82rem" }}>
                                {reportError}
                              </Alert>
                            )}

                            {reportSuccessUrl && (
                              <Box sx={{ p: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <SuccessIcon color="success" fontSize="small" />
                                  <Typography variant="body2" sx={{ color: "#166534", fontWeight: 700, fontSize: "0.82rem" }}>
                                    PDF Report saved to Cloudinary & Database!
                                  </Typography>
                                </Box>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  href={reportSuccessUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<OpenInNewIcon fontSize="small" />}
                                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 700, fontSize: "0.78rem", py: 0.3 }}
                                >
                                  Open PDF Report ↗
                                </Button>
                              </Box>
                            )}
                          </Box>
                        </Card>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}

              {/* ======================================================== */}
              {/* TAB 3: CARDIOAI CHAT                                     */}
              {/* ======================================================== */}
              {activeTab === "CardioAI Chat" && (
                <Box className="animate-fade-in">
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: "stretch",
                      gap: channelsCollapsed ? 0 : 3,
                      height: { xs: "auto", md: "calc(100vh - 140px)" },
                      minHeight: { xs: "auto", md: 580 },
                      width: "100%",
                      transition: "gap 0.3s ease"
                    }}
                  >
                    {/* Collapsible Channel History Sidebar */}
                    {!channelsCollapsed && (
                      <Box
                        sx={{
                          flex: { xs: "1 1 100%", md: "0 0 280px", lg: "0 0 300px" },
                          width: { xs: "100%", md: "280px", lg: "300px" },
                          height: { xs: "240px", md: "100%" },
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        }}
                      >
                        <Card sx={{ bgcolor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", height: "100%", display: "flex", flexDirection: "column", p: 2, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, px: 0.5 }}>
                            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, letterSpacing: 0.5 }}>
                              CONVERSATION SESSIONS
                            </Typography>
                            <Tooltip title="Collapse Sessions Sidebar">
                              <IconButton
                                size="small"
                                onClick={() => setChannelsCollapsed(true)}
                                sx={{ color: "#94a3b8", "&:hover": { color: "#0f172a" }, p: 0.5 }}
                              >
                                <ChevronLeftIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <List sx={{ flexGrow: 1, overflowY: "auto", p: 0 }}>
                            {chatChannels.length === 0 ? (
                              <Typography variant="body2" sx={{ color: "#94a3b8", p: 2, textAlign: "center" }}>
                                No past chats. Start a new session!
                              </Typography>
                            ) : (
                              chatChannels.map((c) => (
                                <ListItem
                                  key={c.id}
                                  disablePadding
                                  sx={{ mb: 0.8 }}
                                  secondaryAction={
                                    <IconButton size="small" onClick={(e) => handleDeleteChannel(e, c.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#ef4444" } }}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  }
                                >
                                  <ListItemButton
                                    selected={activeChannelId === c.id}
                                    onClick={() => fetchMessages(c.id)}
                                    sx={{
                                      borderRadius: "10px",
                                      bgcolor: activeChannelId === c.id ? "#eff6ff !important" : "transparent",
                                      border: activeChannelId === c.id ? "1px solid #bfdbfe" : "1px solid transparent"
                                    }}
                                  >
                                    <ListItemText
                                      primary={c.title || "Cardio Consultation"}
                                      primaryTypographyProps={{
                                        noWrap: true,
                                        fontSize: "0.85rem",
                                        fontWeight: activeChannelId === c.id ? 700 : 500,
                                        color: activeChannelId === c.id ? "#2563eb" : "#0f172a"
                                      }}
                                    />
                                  </ListItemButton>
                                </ListItem>
                              ))
                            )}
                          </List>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={handleNewChat}
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "#ffffff",
                              borderRadius: "10px",
                              py: 1.2,
                              fontWeight: 700,
                              textTransform: "none",
                              mt: 1.5,
                              boxShadow: "0 2px 6px rgba(59, 130, 246, 0.25)",
                              "&:hover": { bgcolor: "#2563eb" }
                            }}
                          >
                            + New Conversation
                          </Button>
                        </Card>
                      </Box>
                    )}

                    {/* Chat Messages & Input Panel on Right */}
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        height: { xs: "520px", md: "100%" }
                      }}
                    >
                      <Card sx={{ bgcolor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", height: "100%", display: "flex", flexDirection: "column", p: 2.5, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                        {/* Chat Window Header with Expand Button when Collapsed */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1.5, mb: 1.5, borderBottom: "1px solid #edf2f7" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                            {channelsCollapsed && (
                              <Tooltip title="Expand Conversation Sessions">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => setChannelsCollapsed(false)}
                                  startIcon={<ChevronRightIcon />}
                                  sx={{
                                    borderRadius: "8px",
                                    borderColor: "#e2e8f0",
                                    color: "#3b82f6",
                                    fontSize: "0.8rem",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    py: 0.3,
                                    px: 1.2
                                  }}
                                >
                                  Sessions
                                </Button>
                              </Tooltip>
                            )}
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                              <ChatIcon sx={{ color: "#3b82f6", fontSize: 20 }} /> CardioAI Consultation
                            </Typography>
                          </Box>

                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleNewChat}
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "#ffffff",
                              borderRadius: "8px",
                              fontSize: "0.82rem",
                              textTransform: "none",
                              fontWeight: 700,
                              px: 1.8,
                              py: 0.6,
                              boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
                              "&:hover": { bgcolor: "#2563eb" }
                            }}
                          >
                            + New Conversation
                          </Button>
                        </Box>

                        {/* Messages Stream */}
                        <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 1, mb: 2 }}>
                          {chatMessages.map((msg, idx) => (
                            <ChatMessage
                              key={idx}
                              message={msg}
                              isLast={idx === chatMessages.length - 1}
                              isStreaming={chatLoading && idx === chatMessages.length - 1 && msg.sender === "ai"}
                            />
                          ))}
                          <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Box */}
                        <Box sx={{ display: "flex", gap: 1.5 }}>
                          <TextField
                            fullWidth
                            placeholder="Ask CardioAI about cholesterol, blood pressure, or ECG changes..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "#f8fafc",
                                borderRadius: "12px",
                                "& fieldset": { borderColor: "#e2e8f0" }
                              }
                            }}
                          />
                          <Button
                            variant="contained"
                            onClick={() => handleSendMessage()}
                            disabled={chatLoading || !chatInput.trim()}
                            sx={{ bgcolor: "#3b82f6", borderRadius: "12px", px: 3, fontWeight: 700 }}
                          >
                            <SendIcon />
                          </Button>
                        </Box>
                      </Card>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* ======================================================== */}
              {/* TAB 4: HOSPITAL LOCATOR                                  */}
              {/* ======================================================== */}
              {activeTab === "Hospital Locator" && (
                <Box className="animate-fade-in">
                  <HospitalLocator />
                </Box>
              )}

              {/* ======================================================== */}
              {/* TAB 5: REPORTS & AUDIT LOGS                              */}
              {/* ======================================================== */}
              {activeTab === "Reports" && (
                <Box className="animate-fade-in">
                  <Box sx={{ mb: 3.5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a" }}>Clinical Reports Archive</Typography>
                    <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>Historical heart risk assessments and downloadable medical summaries</Typography>
                  </Box>

                  <Card sx={{ bgcolor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", p: 3, boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)" }}>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: "#f8fafc" }}>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>Assessment ID</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>Timestamp</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>Risk Category</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>Probability</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>Age / Sex</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>BP / Chol</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>PDF Report</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historyList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>
                                No past assessments found. Run a prediction to see historical logs.
                              </TableCell>
                            </TableRow>
                          ) : (
                            historyList.map((item, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell sx={{ fontWeight: 600, color: "#2563eb" }}>#{item.id ? item.id.slice(0, 8) : `REC-${idx + 1}`}</TableCell>
                                <TableCell sx={{ color: "#64748b" }}>{item.created_at || "Recent"}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={item.category || "Evaluated"}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      bgcolor: item.category === "Low Risk" ? "#dcfce7" : item.category === "Moderate Risk" ? "#fef3c7" : "#fee2e2",
                                      color: item.category === "Low Risk" ? "#15803d" : item.category === "Moderate Risk" ? "#b45309" : "#b91c1c"
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                  {typeof item.probability === 'number' ? `${(item.probability * 100).toFixed(1)}%` : "N/A"}
                                </TableCell>
                                <TableCell sx={{ color: "#64748b" }}>{item.age || patientData.age}y / {item.sex === 1 ? "M" : "F"}</TableCell>
                                <TableCell sx={{ color: "#64748b" }}>{item.trestbps || patientData.trestbps} / {item.chol || patientData.chol}</TableCell>
                                <TableCell>
                                  {item.pdf_url ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      href={item.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<OpenInNewIcon sx={{ fontSize: "14px !important" }} />}
                                      sx={{
                                        borderRadius: "8px",
                                        textTransform: "none",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        py: 0.3,
                                        px: 1.2,
                                        borderColor: "#bfdbfe",
                                        bgcolor: "#eff6ff",
                                        "&:hover": { bgcolor: "#dbeafe" }
                                      }}
                                    >
                                      View PDF
                                    </Button>
                                  ) : (
                                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>—</Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                </Box>
              )}

            </Container>
          </Box>
        </Box>
      </Box>

      {/* Toast Notification Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{
            width: "100%",
            borderRadius: "10px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
