import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  Paper,
  Tooltip,
  InputAdornment,
  Grid
} from "@mui/material";
import {
  Search as SearchIcon,
  MyLocation as MyLocationIcon,
  LocalHospital as HospitalIcon,
  DirectionsCar as CarIcon,
  DirectionsTransit as TransitIcon,
  DirectionsWalk as WalkIcon,
  School as EducationIcon,
  MedicalServices as StethoscopeIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  OpenInNew as OpenInNewIcon,
  Star as StarIcon,
  Navigation as NavigationIcon,
  InfoOutlined as InfoIcon
} from "@mui/icons-material";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:8000/api";

// Custom Leaflet Icons using SVG DivIcons to ensure reliable rendering
const createUserIcon = () =>
  L.divIcon({
    className: "custom-user-marker",
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="position: absolute; width: 28px; height: 28px; background: rgba(59, 130, 246, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; background: #3b82f6; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const createHospitalIcon = (isSelected = false) =>
  L.divIcon({
    className: "custom-hospital-marker",
    html: `
      <div style="
        background: ${isSelected ? "#f59e0b" : "#ef4444"};
        color: white;
        width: ${isSelected ? "38px" : "32px"};
        height: ${isSelected ? "38px" : "32px"};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        cursor: pointer;
        transition: transform 0.2s ease;
        transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
      ">
        <svg width="${isSelected ? "20" : "16"}" height="${isSelected ? "20" : "16"}" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5h-4.5V6a1.5 1.5 0 0 0-3 0v4.5H7a1.5 1.5 0 0 0 0 3h4.5V18a1.5 1.5 0 0 0 3 0v-4.5H19a1.5 1.5 0 0 0 0-3z"/>
        </svg>
      </div>
    `,
    iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
    iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16],
  });

export default function HospitalLocator() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [locationStatus, setLocationStatus] = useState("prompting"); // 'prompting' | 'granted' | 'denied' | 'manual'
  const [isLocating, setIsLocating] = useState(false);
  
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  
  const [routesData, setRoutesData] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeMode, setRouteMode] = useState(0); // 0: driving, 1: transit, 2: walking
  
  const [doctorsData, setDoctorsData] = useState(null);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Initialize and request user location on mount
  useEffect(() => {
    requestLiveLocation();
  }, []);

  // Request browser geolocation
  const requestLiveLocation = () => {
    setIsLocating(true);
    setLocationStatus("prompting");
    setErrorMsg("");

    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setIsLocating(false);
      fallbackToDefaultLocation("Geolocation is not supported by your browser. Please enter your location manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocationName("Your Current GPS Location");
        setLocationStatus("granted");
        setIsLocating(false);
        fetchNearbyHospitals(coords.lat, coords.lng);
      },
      (error) => {
        console.warn("Geolocation permission error:", error);
        setLocationStatus("denied");
        setIsLocating(false);
        fallbackToDefaultLocation(
          "Location permission was not granted. Please enter your city, address, or zip code manually below."
        );
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  const fallbackToDefaultLocation = (message) => {
    setErrorMsg(message);
    // Fallback default coordinates (e.g. Bangalore, India or New York)
    const fallbackCoords = { lat: 12.9716, lng: 77.5946 };
    setUserLocation(fallbackCoords);
    setLocationName("Bengaluru, India (Default - Enter your city above)");
    fetchNearbyHospitals(fallbackCoords.lat, fallbackCoords.lng);
  };

  // Manual search using backend multi-provider geocode endpoint
  const handleManualSearch = async (e) => {
    if (e) e.preventDefault();
    const query = manualQuery.trim();
    if (!query) return;

    setIsLocating(true);
    setErrorMsg("");
    try {
      const res = await axios.get(`${API_BASE}/hospitals/geocode`, {
        params: { q: query },
      });
      if (res.data && res.data.length > 0) {
        const first = res.data[0];
        const newCoords = { lat: Number(first.lat), lng: Number(first.lng) };
        setUserLocation(newCoords);
        setLocationName(first.display_name || query);
        setLocationStatus("manual");
        setSelectedHospital(null);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newCoords.lat, newCoords.lng], 12);
        }
        fetchNearbyHospitals(newCoords.lat, newCoords.lng);
      } else {
        setErrorMsg(`Could not locate "${query}". Please check the spelling or try entering a nearby city.`);
      }
    } catch (err) {
      console.error("Geocoding lookup failed:", err);
      setErrorMsg("Failed to search location. Please check your connection.");
    } finally {
      setIsLocating(false);
    }
  };

  // Quick preset selector
  const selectPresetCity = async (cityName) => {
    setManualQuery(cityName);
    setIsLocating(true);
    setErrorMsg("");
    try {
      const res = await axios.get(`${API_BASE}/hospitals/geocode`, { params: { q: cityName } });
      if (res.data && res.data.length > 0) {
        const loc = res.data[0];
        const newCoords = { lat: Number(loc.lat), lng: Number(loc.lng) };
        setUserLocation(newCoords);
        setLocationName(loc.display_name || cityName);
        setLocationStatus("manual");
        setSelectedHospital(null);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newCoords.lat, newCoords.lng], 12);
        }
        fetchNearbyHospitals(newCoords.lat, newCoords.lng);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLocating(false);
    }
  };

  // Fetch nearby hospitals from backend
  const fetchNearbyHospitals = async (lat, lng) => {
    setLoadingHospitals(true);
    try {
      const res = await axios.get(`${API_BASE}/hospitals/nearby`, {
        params: { lat, lng, radius_km: 30 },
      });
      setHospitals(res.data || []);
    } catch (err) {
      console.error("Error fetching nearby hospitals:", err);
    } finally {
      setLoadingHospitals(false);
    }
  };

  // Initialize / update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || !userLocation) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 12,
        zoomControl: true,
      });

      // STANDARD OPENSTREETMAP TILES: Completely free, NO API key watermark, global coverage
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    } else {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 12);
    }

    renderMarkers();
  }, [userLocation, hospitals, selectedHospital]);

  // Handle map resize when transitioning to 50% width
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        if (selectedHospital) {
          mapInstanceRef.current.panTo([selectedHospital.lat, selectedHospital.lng], {
            animate: true,
            duration: 0.5,
          });
        }
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedHospital]);

  const renderMarkers = () => {
    if (!markersGroupRef.current || !mapInstanceRef.current || !userLocation) return;

    markersGroupRef.current.clearLayers();

    // 1. User location marker
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: createUserIcon(),
    }).bindPopup(`<b>Your Location</b><br/>${locationName}`);
    markersGroupRef.current.addLayer(userMarker);

    // 2. Hospital markers
    hospitals.forEach((h) => {
      const isSelected = selectedHospital && selectedHospital.id === h.id;
      const marker = L.marker([h.lat, h.lng], {
        icon: createHospitalIcon(isSelected),
      });

      marker.on("click", () => {
        handleSelectHospital(h);
      });

      marker.bindTooltip(
        `<b>${h.name}</b><br/>Distance: ${h.distance_km} km<br/><span style="color:#ef4444;font-weight:600;">Click to view routes & doctors</span>`,
        { direction: "top", offset: [0, -15] }
      );

      markersGroupRef.current.addLayer(marker);
    });
  };

  // When a hospital is clicked
  const handleSelectHospital = (hospital) => {
    setSelectedHospital(hospital);
    fetchRoutes(userLocation.lat, userLocation.lng, hospital.lat, hospital.lng);
    fetchDoctors(hospital.name, hospital.website);
  };

  // Fetch routes
  const fetchRoutes = async (fromLat, fromLng, toLat, toLng) => {
    setLoadingRoutes(true);
    setRoutesData(null);
    try {
      const res = await axios.get(`${API_BASE}/hospitals/routes`, {
        params: {
          from_lat: fromLat,
          from_lng: fromLng,
          to_lat: toLat,
          to_lng: toLng,
        },
      });
      setRoutesData(res.data);
    } catch (err) {
      console.error("Error fetching routes:", err);
    } finally {
      setLoadingRoutes(false);
    }
  };

  // Fetch and scrape doctors (ZERO DUMMY DATA)
  const fetchDoctors = async (hospitalName, websiteUrl) => {
    setLoadingDoctors(true);
    setDoctorsData(null);
    try {
      const res = await axios.post(`${API_BASE}/hospitals/doctors`, {
        hospital_name: hospitalName,
        website_url: websiteUrl,
      });
      setDoctorsData(res.data);
    } catch (err) {
      console.error("Error fetching hospital doctors:", err);
      setDoctorsData({ total_doctors: 0, doctors: [] });
    } finally {
      setLoadingDoctors(false);
    }
  };

  return (
    <Box className="animate-fade-in" sx={{ width: "100%", pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <HospitalIcon color="error" sx={{ fontSize: 36 }} />
          Cardiology Hospital Locator & Specialist Directory
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Find nearby specialized heart care centers, calculate emergency travel routes, and explore verified cardiology faculty.
        </Typography>
      </Box>

      {/* Location Search Bar & Controls */}
      <Card sx={{ p: 2, mb: 2.5, bgcolor: "background.paper", borderRadius: 2, boxShadow: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Manual Input Field */}
          <Grid item xs={12} md={7}>
            <form onSubmit={handleManualSearch} style={{ display: "flex", gap: "8px", width: "100%" }}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder="Enter city, town, address, or zip code (e.g. Bangalore, Delhi, Mumbai, New York)..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={isLocating || !manualQuery.trim()}
                startIcon={isLocating ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                sx={{ px: 3, whiteSpace: "nowrap" }}
              >
                Search
              </Button>
            </form>
          </Grid>

          {/* Live GPS Button & Current Location */}
          <Grid item xs={12} md={5} sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
            <Button
              variant={locationStatus === "granted" ? "outlined" : "contained"}
              color="secondary"
              onClick={requestLiveLocation}
              disabled={isLocating}
              startIcon={isLocating ? <CircularProgress size={16} color="inherit" /> : <MyLocationIcon />}
            >
              Use Live GPS
            </Button>

            {userLocation && (
              <Chip
                icon={<LocationIcon sx={{ fontSize: 16 }} />}
                label={locationName || "Current Location"}
                color="primary"
                variant="outlined"
                sx={{ maxWidth: 220, textOverflow: "ellipsis" }}
              />
            )}
          </Grid>
        </Grid>

        {/* Permission / Status Alert */}
        {errorMsg && (
          <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Quick Location Suggestion Pills */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 600 }}>
            Quick Locations:
          </Typography>
          {["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Cleveland", "Boston", "New York"].map((city) => (
            <Chip
              key={city}
              label={city}
              size="small"
              clickable
              onClick={() => selectPresetCity(city)}
              sx={{ fontSize: "0.75rem" }}
            />
          ))}
        </Box>
      </Card>

      {/* Main Interactive Map & Details Split Container */}
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: "74vh",
          gap: selectedHospital ? 2.5 : 0,
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
        }}
      >
        {/* Left Side: Leaflet Map (Shrinks to 50% on hospital click) */}
        <Card
          sx={{
            width: selectedHospital ? "50%" : "100%",
            height: "100%",
            position: "relative",
            transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top Indicator */}
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 1000,
              bgcolor: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(8px)",
              px: 2,
              py: 0.8,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            {loadingHospitals ? (
              <CircularProgress size={16} sx={{ color: "#ef4444" }} />
            ) : (
              <HospitalIcon sx={{ color: "#ef4444", fontSize: 18 }} />
            )}
            <Typography variant="body2" sx={{ color: "white", fontWeight: 600 }}>
              {loadingHospitals
                ? "Locating nearby cardiac centers..."
                : `${hospitals.length} Cardiology Hospitals Found`}
            </Typography>
          </Box>

          {/* Leaflet Map Box */}
          <Box ref={mapContainerRef} sx={{ width: "100%", height: "100%" }} />
        </Card>

        {/* Right Side: 50% Details Panel (Available Routes & Doctors Scraper) */}
        {selectedHospital && (
          <Card
            sx={{
              width: "50%",
              height: "100%",
              bgcolor: "background.paper",
              borderRadius: 3,
              boxShadow: 4,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 0.3s ease",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2.5,
                bgcolor: "rgba(239, 68, 68, 0.08)",
                borderBottom: "1px solid rgba(239, 68, 68, 0.15)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {selectedHospital.name}
                  </Typography>
                  <Chip
                    icon={<StarIcon sx={{ fontSize: "14px !important", color: "#f59e0b" }} />}
                    label={selectedHospital.rating || "4.8"}
                    size="small"
                    sx={{ bgcolor: "rgba(245, 158, 11, 0.15)", fontWeight: 700, height: 22 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  📍 {selectedHospital.address}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  {selectedHospital.has_emergency && (
                    <Chip label="24/7 Emergency Care" color="error" size="small" sx={{ fontWeight: 600 }} />
                  )}
                  <Chip
                    label={`Direct: ${selectedHospital.distance_km} km (${(selectedHospital.distance_km * 0.62).toFixed(1)} mi)`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
              <Tooltip title="Close and return map to full width">
                <IconButton onClick={() => setSelectedHospital(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Content */}
            <Box sx={{ p: 2.5, flex: 1 }}>
              {/* SECTION 1: DISTANCE & AVAILABLE ROUTES */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <NavigationIcon color="primary" fontSize="small" />
                  Available Travel Routes & Navigation
                </Typography>

                {loadingRoutes ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 3, justifyContent: "center" }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary">
                      Calculating driving, transit, and walking route options...
                    </Typography>
                  </Box>
                ) : routesData ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Tabs
                      value={routeMode}
                      onChange={(e, val) => setRouteMode(val)}
                      variant="fullWidth"
                      sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
                    >
                      <Tab icon={<CarIcon />} label={`Drive (~${routesData.options[0]?.duration_minutes}m)`} />
                      <Tab icon={<TransitIcon />} label={`Transit (~${routesData.options[1]?.duration_minutes}m)`} />
                      <Tab icon={<WalkIcon />} label={`Walk (~${routesData.options[2]?.duration_minutes}m)`} />
                    </Tabs>

                    {routesData.options[routeMode] && (
                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                            {routesData.options[routeMode].label}
                          </Typography>
                          <Chip
                            label={`${routesData.options[routeMode].distance_km} km (${routesData.options[routeMode].distance_miles} mi)`}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        </Box>

                        <Box sx={{ pl: 2, borderLeft: "2px solid", borderColor: "primary.light", my: 1.5 }}>
                          {routesData.options[routeMode].steps.map((step, idx) => (
                            <Typography key={idx} variant="body2" color="text.secondary" sx={{ mb: 0.8, fontSize: "0.85rem" }}>
                              • {step}
                            </Typography>
                          ))}
                        </Box>

                        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            href={
                              userLocation
                                ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                                    selectedHospital.name + (selectedHospital.address ? ", " + selectedHospital.address : "")
                                  )}&travelmode=${routeMode === 1 ? "transit" : routeMode === 2 ? "walking" : "driving"}`
                                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                    selectedHospital.name + (selectedHospital.address ? ", " + selectedHospital.address : "")
                                  )}&travelmode=${routeMode === 1 ? "transit" : routeMode === 2 ? "walking" : "driving"}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<OpenInNewIcon />}
                          >
                            Open Directions in Google Maps
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Paper>
                ) : (
                  <Alert severity="info">Calculating routes...</Alert>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* SECTION 2: HEART RELATED DOCTORS (ZERO DUMMY DATA) */}
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                      <StethoscopeIcon color="error" fontSize="small" />
                      Cardiology Specialists & Faculty
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Extracted for {selectedHospital.name}
                    </Typography>
                  </Box>
          
                </Box>

                {loadingDoctors ? (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, p: 4 }}>
                    <CircularProgress size={28} color="error" />
                    <Typography variant="body2" color="text.secondary">
                      Scraping hospital website for cardiology specialists, education credentials, and clinical focus...
                    </Typography>
                  </Box>
                ) : doctorsData && doctorsData.doctors && doctorsData.doctors.length > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {doctorsData.doctors.map((doc, idx) => (
                      <Paper
                        key={idx}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "rgba(255,255,255,0.02)",
                          borderColor: "rgba(255,255,255,0.08)",
                          transition: "border-color 0.2s",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
                              {doc.name}
                            </Typography>
                            <Typography variant="caption" color="error.main" sx={{ fontWeight: 600, display: "block" }}>
                              {doc.title}
                            </Typography>
                          </Box>
                          {doc.experience && (
                            <Chip label={doc.experience} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                          )}
                        </Box>

                        {/* Education */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1, mt: 1 }}>
                          <EducationIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.2, flexShrink: 0 }} />
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block" }}>
                              EDUCATION & QUALIFICATIONS:
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                              {doc.education}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Current Specialization */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                          <StethoscopeIcon sx={{ fontSize: 18, color: "error.main", mt: 0.2, flexShrink: 0 }} />
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block" }}>
                              CURRENT SPECIALIZATION IN WORK:
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.primary", fontWeight: 500 }}>
                              {doc.specialization}
                            </Typography>
                          </Box>
                        </Box>

                  
                      </Paper>
                    ))}

                    {selectedHospital.website && (
                      <Button
                        variant="text"
                        size="small"
                        href={selectedHospital.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        sx={{ alignSelf: "flex-start", mt: 1 }}
                      >
                        Visit Official Hospital Department Website
                      </Button>
                    )}
                  </Box>
                ) : (
                  /* ZERO DUMMY DATA: When not available, clearly display Not Available */
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: "rgba(255,255,255,0.02)",
                      textAlign: "center",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <InfoIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1, opacity: 0.6 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Cardiology Doctors List Not Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto", mb: 2 }}>
                      {doctorsData?.message ||
                        "This hospital does not publish a publicly accessible structured doctor directory on its website, or access is protected by security controls."}
                    </Typography>

                    {selectedHospital.website ? (
                      <Button
                        variant="outlined"
                        size="small"
                        color="primary"
                        href={selectedHospital.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<OpenInNewIcon />}
                      >
                        Open Hospital Official Website
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        href={`https://www.google.com/search?q=${encodeURIComponent(selectedHospital.name + " cardiology doctors")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<OpenInNewIcon />}
                      >
                        Search Doctors on Google
                      </Button>
                    )}
                  </Paper>
                )}
              </Box>
            </Box>
          </Card>
        )}
      </Box>
    </Box>
  );
}
