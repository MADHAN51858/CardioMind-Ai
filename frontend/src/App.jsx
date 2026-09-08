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
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  FormHelperText,
  Chip,
  Tooltip
} from "@mui/material";
import {
  LocalActivity as PredictIcon,
  Timeline as PipelineIcon,
  Compare as CompareIcon,
  Chat as ChatIcon,
  Assessment as ReportIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  GetApp as DownloadIcon,
  Person as PersonIcon,
  Send as SendIcon,
  Help as HelpIcon,
  Logout as LogoutIcon,
  LocalHospital as HospitalIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  DeleteOutlineOutlined as DeleteIcon
} from "@mui/icons-material";
import AuthScreen from "./AuthScreen";
import HospitalLocator from "./HospitalLocator";
import ChatMessage from "./ChatMessage";

const API_BASE = "http://localhost:8000/api";

// Setup Axios Interceptor for auth
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Create gorgeous dark theme
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3b82f6" },
    secondary: { main: "#6366f1" },
    background: { default: "#0b111e", paper: "#131b2e" },
    text: { primary: "#f8fafc", secondary: "#94a3b8" },
    success: { main: "#10b981" },
    warning: { main: "#f59e0b" },
    error: { main: "#ef4444" }
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    h1: { fontFamily: "'Outfit', sans-serif" },
    h2: { fontFamily: "'Outfit', sans-serif" },
    h3: { fontFamily: "'Outfit', sans-serif" },
    h4: { fontFamily: "'Outfit', sans-serif" },
    h5: { fontFamily: "'Outfit', sans-serif" },
    h6: { fontFamily: "'Outfit', sans-serif" }
  },
  shape: { borderRadius: 12 }
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user);
    setIsAuthenticated(true);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setUsername('');
  };

  const [activeTab, setActiveTab] = useState("AI Prediction");
  const [patientData, setPatientData] = useState({
    age: 52, sex: 1, cp: 3, trestbps: 125, chol: 215, fbs: 0,
    thalach: 145, exang: 0
  });

  // Pipeline State
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineActive, setPipelineActive] = useState(false);
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

  // Map State
  const [userLocation, setUserLocation] = useState(null);

  // Chat State
  const [chatChannels, setChatChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
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
  }, [isAuthenticated, activeTab]);

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
    setPatientData(prev => ({ ...prev, [field]: sanitizedVal }));
  };

  // Run Pipeline SSE Stream
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
    setCurrentStage("validation");
    setPipelineStages({
      validation: "processing",
      preprocessing: "pending",
      model_prediction: "pending",
      probability_calibration: "pending",
      shap_explanation: "pending",
      prediction: "pending"
    });
    setActiveTab("Live Analysis");

    fetch(`${API_BASE}/predict-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData)
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
          // Normalize CRLF and CR to LF so SSE message delimiters split cleanly across environments
          buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || ""; // keep any incomplete trailing chunk in buffer

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

  // Chat Handler with Pure Stream Data Handling
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

    // Push a placeholder AI message that will receive the live stream
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

      // Check returned channel ID from header
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

      // Refresh channels so the sidebar updates with the conversation
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


  // Download PDF Report
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



  const getStageIcon = (status) => {
    switch (status) {
      case "completed": return <SuccessIcon color="success" />;
      case "failed": return <ErrorIcon color="error" />;
      case "processing": return <CircularProgress size={20} />;
      default: return <HelpIcon color="disabled" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthScreen onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100vh" }}>

        {/* Sidebar Nav */}
        <Drawer
          variant="permanent"
          sx={{
            width: 260,
            flexShrink: 0,
            "& .MuiDrawer-paper": { width: 260, boxSizing: "border-box", borderRight: "1px solid var(--border-card)", backgroundColor: "#0b111e" },
          }}
        >
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>

            <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main", fontFamily: "var(--font-heading)" }}>
              CardioMind AI
            </Typography>
          </Box>
          <Divider />
          <List>
            {[
              { text: "AI Prediction", icon: <PredictIcon /> },
              { text: "Live Analysis", icon: <PipelineIcon /> },
              { text: "CardioAI Chat", icon: <ChatIcon /> },
              { text: "Hospital Locator", icon: <HospitalIcon /> },
              { text: "Reports", icon: <ReportIcon /> },
            ].map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={activeTab === item.text}
                  onClick={() => setActiveTab(item.text)}
                  sx={{
                    my: 0.5,
                    mx: 1,
                    borderRadius: 2,
                    "&.Mui-selected": { bgcolor: "primary.glow", border: "1px solid rgba(59, 130, 246, 0.2)" }
                  }}
                >
                  <ListItemIcon sx={{ color: activeTab === item.text ? "primary.main" : "text.secondary" }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 500 }} />
                </ListItemButton>
              </ListItem>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  my: 0.5,
                  mx: 1,
                  borderRadius: 2,
                  "&:hover": { bgcolor: "rgba(239, 68, 68, 0.1)", color: "error.main" }
                }}
              >
                <ListItemIcon sx={{ color: "error.main" }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary={username ? `Logout (${username})` : "Logout"} primaryTypographyProps={{ fontWeight: 500, color: "error.main" }} />
              </ListItemButton>
            </ListItem>
          </List>

          <Box sx={{ mt: 'auto', p: 2 }}>
            <Alert severity={apiHealth ? "success" : "error"} variant="outlined" icon={false}>
              API Status: {apiHealth ? "Connected" : "Disconnected"}
            </Alert>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
          <Container maxWidth="xl">

            {/* TAB: AI PREDICTION FORM */}
            {/* TAB: AI PREDICTION FORM */}
            {activeTab === "AI Prediction" && (
              <Box className="animate-fade-in">
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>Cardiovascular Risk Prediction</Typography>
                  <Typography variant="body1" color="text.secondary">
                    Provide basic health indicators and self-reported symptoms — no invasive hospital instruments required
                  </Typography>
                </Box>

                <Card sx={{ bgcolor: "background.paper", p: 4, borderRadius: 3, border: "1px solid var(--border-card)" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, pb: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>Clinical Parameters Input Form</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Every parameter below is naturally available at home or from routine health checkups
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setPatientData({
                        age: 52, sex: 1, cp: 3, trestbps: 125, chol: 215, fbs: 0, thalach: 145, exang: 0
                      })}
                      sx={{ borderRadius: 2 }}
                    >
                      Reset to Default
                    </Button>
                  </Box>

                  {/* SECTION 1: Patient Information */}
                  <Box sx={{ mb: 4, p: 3, bgcolor: "rgba(255, 255, 255, 0.02)", borderRadius: 2.5, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonIcon fontSize="small" /> 1. Patient Demographics
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2.5 }}>
                      Basic personal characteristics naturally known by the individual
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                      <TextField
                        fullWidth
                        label="Age (Years)"
                        type="number"
                        value={patientData.age}
                        slotProps={{ htmlInput: { min: 0 } }}
                        inputProps={{ min: 0 }}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleInputChange("age", isNaN(val) ? "" : Math.max(0, val));
                        }}
                        helperText="Self-reported age in completed years (e.g. 52)"
                      />
                      <FormControl fullWidth>
                        <InputLabel>Biological Sex</InputLabel>
                        <Select
                          value={patientData.sex}
                          label="Biological Sex"
                          onChange={(e) => handleInputChange("sex", parseInt(e.target.value))}
                        >
                          <MenuItem value={1}>Male</MenuItem>
                          <MenuItem value={0}>Female</MenuItem>
                        </Select>
                        <FormHelperText>Biological sex assigned at birth</FormHelperText>
                      </FormControl>
                    </Box>
                  </Box>

                  {/* SECTION 2: Vitals & Health Checks */}
                  <Box sx={{ mb: 4, p: 3, bgcolor: "rgba(255, 255, 255, 0.02)", borderRadius: 2.5, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                      <PredictIcon fontSize="small" /> 2. Readily Available Vitals &amp; Measurements
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2.5 }}>
                      Measured with home digital monitors, smartwatch/fitness trackers, or standard checkup lab reports
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                      <TextField
                        fullWidth
                        label="Resting Blood Pressure (mm Hg)"
                        type="number"
                        value={patientData.trestbps}
                        slotProps={{ htmlInput: { min: 0 } }}
                        inputProps={{ min: 0 }}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleInputChange("trestbps", isNaN(val) ? "" : Math.max(0, val));
                        }}
                        helperText="Measured using a standard home BP cuff or pharmacy kiosk (e.g. 120)"
                      />
                      <TextField
                        fullWidth
                        label="Serum Cholesterol (mg/dl)"
                        type="number"
                        value={patientData.chol}
                        slotProps={{ htmlInput: { min: 0 } }}
                        inputProps={{ min: 0 }}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleInputChange("chol", isNaN(val) ? "" : Math.max(0, val));
                        }}
                        helperText="From standard routine checkup lipid panel (healthy: &lt; 200 mg/dl)"
                      />
                      <TextField
                        fullWidth
                        label="Heart Rate / Pulse (bpm)"
                        type="number"
                        value={patientData.thalach}
                        slotProps={{ htmlInput: { min: 0 } }}
                        inputProps={{ min: 0 }}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleInputChange("thalach", isNaN(val) ? "" : Math.max(0, val));
                        }}
                        helperText="Obtained via smartwatch, fitness tracker, or manual pulse count"
                      />
                      <FormControl fullWidth>
                        <InputLabel>Fasting Blood Sugar &gt; 120 mg/dl</InputLabel>
                        <Select
                          value={patientData.fbs}
                          label="Fasting Blood Sugar > 120 mg/dl"
                          onChange={(e) => handleInputChange("fbs", parseInt(e.target.value))}
                        >
                          <MenuItem value={0}>No (Normal: ≤ 120 mg/dl)</MenuItem>
                          <MenuItem value={1}>Yes (Elevated / Diabetic: &gt; 120 mg/dl)</MenuItem>
                        </Select>
                        <FormHelperText>Home finger-prick glucometer test or known diabetes condition</FormHelperText>
                      </FormControl>
                    </Box>
                  </Box>

                  {/* SECTION 3: Symptoms */}
                  <Box sx={{ mb: 4, p: 3, bgcolor: "rgba(255, 255, 255, 0.02)", borderRadius: 2.5, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                      <InfoIcon fontSize="small" /> 3. Self-Reported Symptoms
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2.5 }}>
                      Patient's description of chest discomfort during rest and physical activity
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                      <FormControl fullWidth>
                        <InputLabel>Chest Pain Experience</InputLabel>
                        <Select
                          value={patientData.cp}
                          label="Chest Pain Experience"
                          onChange={(e) => handleInputChange("cp", parseInt(e.target.value))}
                        >
                          <MenuItem value={1}>Typical Angina (pressure/squeezing discomfort with physical exertion)</MenuItem>
                          <MenuItem value={2}>Atypical Angina (unusual chest ache/discomfort)</MenuItem>
                          <MenuItem value={3}>Non-anginal Pain (sharp, fleeting, or musculoskeletal ache)</MenuItem>
                          <MenuItem value={4}>Asymptomatic (no chest pain or tightness experienced)</MenuItem>
                        </Select>
                        <FormHelperText>Describe any chest discomfort naturally experienced</FormHelperText>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel>Exercise-Induced Angina (Chest Pain)</InputLabel>
                        <Select
                          value={patientData.exang}
                          label="Exercise-Induced Angina (Chest Pain)"
                          onChange={(e) => handleInputChange("exang", parseInt(e.target.value))}
                        >
                          <MenuItem value={0}>No (No chest pain triggered by climbing stairs or exercise)</MenuItem>
                          <MenuItem value={1}>Yes (Chest discomfort brought on by physical exertion)</MenuItem>
                        </Select>
                        <FormHelperText>Does walking fast, climbing stairs, or exercise trigger chest pain?</FormHelperText>
                      </FormControl>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleAnalyze}
                      startIcon={<PipelineIcon />}
                      sx={{ px: 5, py: 1.6, fontWeight: 700, fontSize: "1rem", borderRadius: 2 }}
                    >
                      Run AI Live Analysis
                    </Button>
                  </Box>
                </Card>
              </Box>
            )}

            {/* TAB: LIVE ANALYSIS PIPELINE */}
            {activeTab === "Live Analysis" && (
              <Box className="animate-fade-in">
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>AI Inference Execution Pipeline</Typography>
                  <Typography variant="body1" color="text.secondary">Real-time tracking of intermediate machine learning operations</Typography>
                </Box>

                {/* Tracking Matrix & Activity Stream */}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mb: 4 }}>
                  {/* Pipeline Stage Tracker */}
                  <Card sx={{ bgcolor: "background.paper", p: 3, borderRadius: 3, border: "1px solid var(--border-card)" }}>
                    <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                      <PipelineIcon color="primary" /> Pipeline Tracking Matrix
                    </Typography>

                    <List sx={{ width: "100%", bgcolor: "transparent" }}>
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
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: status === "processing" ? "rgba(59, 130, 246, 0.08)" : status === "completed" ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 0.02)",
                              border: status === "processing" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid transparent"
                            }}
                            secondaryAction={getStageIcon(status)}
                          >
                            <ListItemText
                              primary={stage.label}
                              secondary={status.toUpperCase()}
                              primaryTypographyProps={{ fontWeight: currentStage === stage.key ? 700 : 500 }}
                              secondaryTypographyProps={{
                                color: status === "completed" ? "success.main" : status === "processing" ? "primary.main" : "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.75rem"
                              }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>

                    <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">Pipeline Total Progress</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>{pipelineProgress}%</Typography>
                      </Box>
                      <Box sx={{ position: "relative", width: "100%", bgcolor: "grey.800", height: 10, borderRadius: 5, overflow: "hidden" }}>
                        <Box sx={{ width: `${pipelineProgress}%`, bgcolor: "primary.main", height: "100%", borderRadius: 5, transition: "width 0.4s ease-in-out" }} />
                      </Box>
                    </Box>
                  </Card>

                  {/* Execution Activity Logs */}
                  <Card sx={{ bgcolor: "background.paper", p: 3, borderRadius: 3, border: "1px solid var(--border-card)", display: "flex", flexDirection: "column" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                        <CompareIcon color="primary" /> AI Activity Stream
                      </Typography>
                      {pipelineActive && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Streaming Operations...</Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ bgcolor: "#060a12", p: 2.5, borderRadius: 2, fontFamily: "monospace", fontSize: 13, flexGrow: 1, minHeight: 380, maxHeight: 420, overflowY: "auto", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      {pipelineLogs.length === 0 ? (
                        <Box sx={{ color: "text.secondary", fontStyle: "italic", p: 2, textAlign: "center" }}>
                          Waiting for pipeline initiation...
                        </Box>
                      ) : (
                        pipelineLogs.map((log, idx) => (
                          <Box key={idx} sx={{ mb: 1.5, color: log.stage === "error" ? "error.main" : "success.main" }}>
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
                        <Box sx={{ color: "primary.main", fontStyle: "italic", mt: 1 }}>
                          &gt; Processing stage [{currentStage.toUpperCase()}]...
                        </Box>
                      )}
                    </Box>
                  </Card>
                </Box>

                {/* Post-Prediction Results Dashboard */}
                {predictionResult && (
                  <Card sx={{ bgcolor: "background.paper", p: 4, borderRadius: 3, border: "1px solid var(--border-card)" }} className="animate-fade-in">
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 3, pb: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <Box>
                        <Typography variant="h5" color="success.main" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                          <SuccessIcon /> Prediction Analysis Completed
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Inference results generated by calibrated multi-model ML ensemble
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>
                          Download PDF Report
                        </Button>
                        <Button variant="outlined" startIcon={<ChatIcon />} onClick={() => setActiveTab("CardioAI Chat")}>
                          Ask CardioAI
                        </Button>
                        <Button variant="text" onClick={() => setActiveTab("Reports")}>
                          Session History
                        </Button>
                      </Box>
                    </Box>

                    {/* Result Metrics Grid */}
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" }, gap: 3, mb: 3 }}>
                      {/* Risk Gauge Card */}
                      <Card sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", p: 3, borderRadius: 2.5, border: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <Typography variant="subtitle2" color="text.secondary">Calibrated Risk Probability</Typography>
                        <Typography variant="h2" sx={{ fontWeight: 900, my: 1, color: predictionResult.probability > 0.5 ? "error.main" : "success.main" }}>
                          {(predictionResult.probability * 100).toFixed(1)}%
                        </Typography>
                        <Box sx={{ px: 2, py: 0.5, borderRadius: 2, bgcolor: predictionResult.probability > 0.5 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)", color: predictionResult.probability > 0.5 ? "error.main" : "success.main", fontWeight: 700, fontSize: "0.85rem" }}>
                          {predictionResult.category}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                          Evaluated by production XGBoost with Platt probability calibration
                        </Typography>
                      </Card>

                      {/* Multi-Model Comparative Predictions */}
                      <Card sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", p: 3, borderRadius: 2.5, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                          Multi-Model Probability Breakdown
                        </Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2 }}>
                          {predictionResult.model_outputs && Object.entries(predictionResult.model_outputs).map(([modelName, out]) => {
                            const prob = (out.calibrated_probability || out.raw_probability || 0) * 100;
                            return (
                              <Box key={modelName} sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textTransform: "capitalize", fontWeight: 600 }}>
                                  {modelName.replace("_", " ")}
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 800, my: 0.5, color: prob > 50 ? "error.main" : "primary.main" }}>
                                  {prob.toFixed(1)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
                                  Calibrated
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>

                        {/* Top SHAP Drivers */}
                        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.secondary" }}>
                            Key Patient-Specific Contributing Factors (SHAP Values)
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {predictionResult.top_positive_features && predictionResult.top_positive_features.slice(0, 3).map((f, i) => (
                              <Box key={i} sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "error.main", fontSize: "0.8rem", fontWeight: 600 }}>
                                ↑ {f.feature.replace("_", " ").toUpperCase()}: +{f.shap_value.toFixed(3)}
                              </Box>
                            ))}
                            {predictionResult.top_negative_features && predictionResult.top_negative_features.slice(0, 3).map((f, i) => (
                              <Box key={i} sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "success.main", fontSize: "0.8rem", fontWeight: 600 }}>
                                ↓ {f.feature.replace("_", " ").toUpperCase()}: {f.shap_value.toFixed(3)}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Card>
                    </Box>
                  </Card>
                )}
              </Box>
            )}



            {/* TAB: CARDIOAI CHAT */}
            {activeTab === "CardioAI Chat" && (
              <Box className="animate-fade-in">
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>CardioAI Educational Assistant</Typography>
                  <Typography variant="body1" color="text.secondary">Authority-grounded conversations about heart health, risk factors, and analysis methodologies</Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card
                      sx={{
                        bgcolor: "background.paper",
                        height: "82vh",
                        display: "flex",
                        flexDirection: "row",
                        overflow: "hidden",
                        borderRadius: 3,
                        border: "1px solid var(--border-card)",
                        width: "100%",
                        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)"
                      }}
                    >
                      {/* Channels Sidebar */}
                      <Box
                        sx={{
                          width: { xs: "240px", sm: "280px" },
                          minWidth: { xs: "240px", sm: "280px" },
                          maxWidth: { xs: "240px", sm: "280px" },
                          flexShrink: 0,
                          borderRight: "1px solid var(--border-card)",
                          display: "flex",
                          flexDirection: "column",
                          bgcolor: "rgba(15, 23, 42, 0.65)",
                          height: "100%",
                          overflow: "hidden"
                        }}
                      >
                        <Box sx={{ p: 2, borderBottom: "1px solid var(--border-card)", bgcolor: "rgba(15, 23, 42, 0.85)" }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <ChatIcon sx={{ fontSize: 18, color: "primary.main" }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "text.secondary" }}>
                                Conversations
                              </Typography>
                            </Box>
                            <Chip
                              label={chatChannels.length}
                              size="small"
                              sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}
                            />
                          </Box>

                          <Button
                            fullWidth
                            variant="contained"
                            onClick={handleNewChat}
                            startIcon={<RefreshIcon />}
                            sx={{
                              fontWeight: 700,
                              py: 1,
                              borderRadius: 2,
                              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                              "&:hover": {
                                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                              }
                            }}
                          >
                            + New Conversation
                          </Button>
                        </Box>

                        <List sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden", p: 1 }}>
                          {chatChannels.map(channel => {
                            const isSelected = activeChannelId === channel.id;
                            return (
                              <ListItem
                                key={channel.id}
                                disablePadding
                                secondaryAction={
                                  <Tooltip title="Delete conversation">
                                    <IconButton
                                      edge="end"
                                      aria-label="delete"
                                      size="small"
                                      onClick={(e) => handleDeleteChannel(e, channel.id)}
                                      sx={{
                                        opacity: isSelected ? 0.8 : 0.3,
                                        mr: 0.5,
                                        color: isSelected ? "#fff" : "text.secondary",
                                        "&:hover": { opacity: 1, color: "error.main" }
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                }
                                sx={{ mb: 0.8 }}
                              >
                                <ListItemButton
                                  selected={isSelected}
                                  onClick={() => fetchMessages(channel.id)}
                                  sx={{
                                    borderRadius: 2,
                                    pr: 5,
                                    py: 1.2,
                                    transition: "all 0.2s ease",
                                    border: isSelected ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid transparent",
                                    "&.Mui-selected": {
                                      bgcolor: "rgba(59, 130, 246, 0.15)",
                                      "&:hover": { bgcolor: "rgba(59, 130, 246, 0.22)" }
                                    },
                                    "&:hover": {
                                      bgcolor: "rgba(255, 255, 255, 0.04)"
                                    }
                                  }}
                                >
                                  <Box sx={{ width: "100%", overflow: "hidden" }}>
                                    <Typography
                                      variant="body2"
                                      noWrap
                                      sx={{
                                        fontWeight: isSelected ? 700 : 500,
                                        color: isSelected ? "#93c5fd" : "text.primary",
                                        fontSize: "0.85rem"
                                      }}
                                    >
                                      {channel.title || "New Chat"}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem", display: "block" }}>
                                      {new Date(channel.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </Typography>
                                  </Box>
                                </ListItemButton>
                              </ListItem>
                            );
                          })}
                          {chatChannels.length === 0 && (
                            <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                              <ChatIcon sx={{ fontSize: 32, opacity: 0.3, mb: 1 }} />
                              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>No saved conversations</Typography>
                              <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                                Start a new chat to explore cardiology concepts, risk biomarkers, and treatment guidelines.
                              </Typography>
                            </Box>
                          )}
                        </List>
                      </Box>

                      {/* Chat interface */}
                      <Box
                        sx={{
                          flexGrow: 1,
                          flexShrink: 1,
                          width: { xs: "calc(100% - 240px)", sm: "calc(100% - 280px)" },
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          height: "100%",
                          bgcolor: "rgba(10, 15, 30, 0.5)",
                          overflow: "hidden"
                        }}
                      >
                        {/* Chat Header */}
                        <Box
                          sx={{
                            p: 2,
                            px: 3,
                            borderBottom: "1px solid var(--border-card)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                            flexShrink: 0
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "success.main", boxShadow: "0 0 10px rgba(34, 197, 94, 0.6)", flexShrink: 0 }} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }} noWrap>
                                {chatChannels.find(c => c.id === activeChannelId)?.title || "CardioAI Clinical Assistant"}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                                {activeChannelId ? "Active Channel" : "New Conversation"} • Authority-grounded cardiology QA
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                            <Chip label="Stream Active" size="small" sx={{ height: 20, fontSize: "0.68rem", bgcolor: "rgba(34, 197, 94, 0.15)", color: "#86efac", border: "1px solid rgba(34, 197, 94, 0.3)" }} />
                            <Tooltip title="Start New Conversation">
                              <IconButton size="small" onClick={handleNewChat} sx={{ color: "text.secondary", "&:hover": { color: "primary.light" } }}>
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        {/* Chat messages */}
                        <Box
                          sx={{
                            flex: "1 1 0%",
                            p: { xs: 2, md: 3 },
                            overflowY: "auto",
                            overflowX: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            minWidth: 0,
                            width: "100%",
                            boxSizing: "border-box"
                          }}
                        >
                          {/* If new chat and no messages, show Concept Starter Cards */}
                          {!activeChannelId && chatMessages.length === 0 && (
                            <Box sx={{ my: "auto", py: 3, textAlign: "center", maxWidth: 650, mx: "auto", width: "100%" }}>
                              <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2, color: "primary.main" }}>
                                <ChatIcon sx={{ fontSize: 28 }} />
                              </Box>
                              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Explore Cardiology Concepts</Typography>
                        
                            </Box>
                          )}

                          {chatMessages.map((msg, idx) => (
                            <ChatMessage
                              key={idx}
                              message={msg}
                              isLast={idx === chatMessages.length - 1}
                              isStreaming={chatLoading}
                            />
                          ))}
                          <div ref={messagesEndRef} />
                        </Box>

                        {/* Interactive Suggestions Chips Bar */}
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            borderTop: "1px solid var(--border-card)",
                            bgcolor: "rgba(15, 23, 42, 0.5)",
                            display: "flex",
                            gap: 1,
                            overflowX: "auto",
                            alignItems: "center",
                            maxWidth: "100%",
                            minWidth: 0,
                            flexShrink: 0,
                            "&::-webkit-scrollbar": { height: 4 },
                            "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 }
                          }}
                        >
                          {predictionResult && (
                            <Chip
                              label="⚡ Explain My Patient Risk Score"
                              size="small"
                              color="primary"
                              clickable
                              disabled={chatLoading}
                              onClick={() => handleSendMessage("Can you explain my patient prediction risk score and key SHAP factors?")}
                              sx={{ fontWeight: 700, flexShrink: 0, boxShadow: "0 0 10px rgba(59, 130, 246, 0.4)" }}
                            />
                          )}
                 
                        </Box>

                        {/* Chat Input */}
                        <Box sx={{ p: 2, borderTop: "1px solid var(--border-card)", display: "flex", gap: 2, bgcolor: "rgba(15, 23, 42, 0.7)", flexShrink: 0 }}>
                          <TextField
                            fullWidth
                            placeholder="Ask CardioAI anything about heart health..."
                            value={chatInput}
                            disabled={chatLoading}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !chatLoading && chatInput.trim()) handleSendMessage(); }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: "rgba(30, 41, 59, 0.6)",
                                borderRadius: 2
                              }
                            }}
                          />
                          <IconButton
                            color="primary"
                            disabled={chatLoading || !chatInput.trim()}
                            onClick={() => handleSendMessage()}
                            sx={{
                              bgcolor: chatLoading || !chatInput.trim() ? "transparent" : "primary.main",
                              color: chatLoading || !chatInput.trim() ? "text.secondary" : "#fff",
                              borderRadius: 2,
                              px: 2,
                              "&:hover": { bgcolor: "primary.dark" }
                            }}
                          >
                            {chatLoading ? <CircularProgress size={22} color="inherit" /> : <SendIcon />}
                          </IconButton>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* TAB: REPORTS */}
            {activeTab === "Reports" && (
              <Box className="animate-fade-in">
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>Recent Patient Analysis Reports</Typography>
                  <Typography variant="body1" color="text.secondary">Download academic reports and review session history</Typography>
                </Box>

                <Card sx={{ bgcolor: "background.paper", p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Session History Log</Typography>
                  {historyList.length > 0 ? (
                    <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Timestamp</TableCell>
                            <TableCell align="right">Age</TableCell>
                            <TableCell align="right">Sex</TableCell>
                            <TableCell align="right">Model-Estimated Probability</TableCell>
                            <TableCell align="right">Model Output Category</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historyList.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.timestamp}</TableCell>
                              <TableCell align="right">{item.patient_input.age}</TableCell>
                              <TableCell align="right">{item.patient_input.sex === 1 ? "Male" : "Female"}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: item.result.probability > 0.5 ? "error.main" : "success.main" }}>
                                {(item.result.probability * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell align="right">{item.result.category}</TableCell>
                              <TableCell align="right">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={() => {
                                    // Set results context and fetch report
                                    axios.post(`${API_BASE}/predict`, item.patient_input)
                                      .then(res => {
                                        axios.post(`${API_BASE}/report`, { patient: item.patient_input, prediction: res.data }, { responseType: 'blob' })
                                          .then(response => {
                                            const file = new Blob([response.data], { type: 'application/pdf' });
                                            const fileURL = URL.createObjectURL(file);
                                            const link = document.createElement('a');
                                            link.href = fileURL;
                                            link.setAttribute('download', `cardio_report_${item.id.slice(0, 6)}.pdf`);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                          });
                                      });
                                  }}
                                >
                                  Download PDF
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info">No prediction records found in the current browser session.</Alert>
                  )}
                </Card>
              </Box>
            )}

            {/* TAB: HOSPITAL LOCATOR */}
            {activeTab === "Hospital Locator" && (
              <HospitalLocator />
            )}

            {/* TAB: ABOUT & METHODOLOGY */}
            {activeTab === "About & Methodology" && (
              <Box className="animate-fade-in">
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>Academic Research Specifications</Typography>
                  <Typography variant="body1" color="text.secondary">Background details, mathematical formulations, and datasets constraints</Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Card sx={{ bgcolor: "background.paper", p: 4, mb: 3 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Research Methodology</Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        This application demonstrates a complete clinical machine-learning lifecycle designed as an engineering thesis prototype.
                        It follows strict data leakage prevention protocols:
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph component="div">
                        <ul>
                          <li><b>Train/Test Isolation</b>: The raw UCI Cleveland dataset (303 records) is split into an 80% training set and a 20% validation test set. The test set is entirely excluded from parameter tuning.</li>
                          <li><b>Leakage-Safe Pipelines</b>: Column Transformations (imputing missing entries via median/mode and scaling numerical variables via StandardScaler) are fitted exclusively on the training folds and applied to test inputs during runtime.</li>
                          <li><b>Comparative Modeling</b>: Hyperparameters are cross-validated on 5 folds to select optimal configurations for Logistic Regression, Random Forest, XGBoost, and SVM.</li>
                          <li><b>Probability Calibration</b>: Because raw classifier outputs represent machine decision boundaries rather than physical probabilities, we apply Platt Scaling (calibrating outputs using a sigmoid log-odds fit).</li>
                        </ul>
                      </Typography>

                      <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Authority Sources & Grounding</Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        CardioAI Chat educational replies are anchored in medical research materials retrieved from:
                        <ul>
                          <li>American Heart Association (AHA) Prevention Guidelines</li>
                          <li>Centers for Disease Control and Prevention (CDC) Heart Health Reports</li>
                          <li>National Institutes of Health (NIH / NHLBI) Hypertension Standard Guidelines</li>
                        </ul>
                      </Typography>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card sx={{ bgcolor: "background.paper", p: 3, borderLeft: "4px solid #ef4444" }}>
                      <Typography variant="h6" color="error.main" sx={{ fontWeight: 700, mb: 1 }}>Academic Disclaimer</Typography>
                      <Typography variant="body2" color="text.secondary" align="justify">
                        <b>IMPORTANT</b>: This application is a scientific engineering prototype and is **NOT** a clinically validated medical device.
                        It cannot diagnose patients, prescribe medications, or replace human diagnostic judgment. All generated probabilities are
                        approximate mathematical associations derived from statistical learning on small benchmark data.
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
