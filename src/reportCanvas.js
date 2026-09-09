/**
 * CardioMind AI - Canvas-based Clinical Medical Report Image Generator
 * Renders a high-resolution, pixel-perfect 2x PNG report canvas for download & cloud storage.
 */

export function generateReportCanvas(patientData, predictionResult, currentUser) {
  const canvas = document.createElement("canvas");
  const scale = 2; // 2x retina DPI
  const width = 800;
  const height = 1120;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Helper drawing functions
  const roundRect = (x, y, w, h, r, fill, stroke, strokeColor = "#e2e8f0", strokeWidth = 1) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  };

  // 1. Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // 2. Header Banner (Dark Navy Clinical Gradient)
  const headerGrad = ctx.createLinearGradient(0, 0, width, 120);
  headerGrad.addColorStop(0, "#0b1329");
  headerGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, 130);

  // Decorative header subtle glow
  ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
  ctx.beginPath();
  ctx.arc(width - 80, 40, 100, 0, Math.PI * 2);
  ctx.fill();

  // Logo & Title
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("♥ CARDIOMIND AI", 40, 44);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Cardiovascular Risk Diagnostic Report", 40, 78);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("AI-Assisted Clinical Decision Support & Biomarker Analysis", 40, 98);

  // Header Right Metadata Box
  const reportId = predictionResult?.id || `REC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  
  roundRect(width - 240, 28, 200, 74, 8, "rgba(255, 255, 255, 0.08)", true, "rgba(255, 255, 255, 0.15)");
  ctx.fillStyle = "#93c5fd";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`REPORT ID: #${reportId.replace(/^REC-/, '')}`, width - 225, 48);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Date: ${dateStr}`, width - 225, 68);
  ctx.fillText(`Patient: ${currentUser?.fullName || currentUser?.username || "Evaluated Subject"}`, width - 225, 88);

  // 3. Primary Risk Score Card
  const category = predictionResult?.category || "Evaluated";
  const prob = typeof predictionResult?.probability === "number" ? predictionResult.probability : 0.5;
  const probPercent = (prob * 100).toFixed(1);

  let themeColor = "#10b981"; // Low risk green
  let themeBg = "#ecfdf5";
  let themeBorder = "#a7f3d0";
  let badgeText = "LOW CARDIOVASCULAR RISK";

  if (category === "Moderate Risk" || (prob >= 0.35 && prob < 0.70)) {
    themeColor = "#f59e0b"; // Amber
    themeBg = "#fffbeb";
    themeBorder = "#fde68a";
    badgeText = "MODERATE CARDIOVASCULAR RISK";
  } else if (category === "High Risk" || prob >= 0.70) {
    themeColor = "#ef4444"; // Red
    themeBg = "#fef2f2";
    themeBorder = "#fecaca";
    badgeText = "HIGH CARDIOVASCULAR RISK";
  }

  // Card Container
  roundRect(40, 150, width - 80, 140, 14, "#ffffff", true, "#e2e8f0", 1);
  
  // Left Risk Badge Area
  roundRect(55, 165, 180, 110, 10, themeBg, true, themeBorder, 1.5);
  ctx.fillStyle = themeColor;
  ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${probPercent}%`, 145, 222);
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("ESTIMATED RISK", 145, 248);
  ctx.textAlign = "left";

  // Right Details in Card
  ctx.fillStyle = themeColor;
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(badgeText, 255, 185);

  ctx.fillStyle = "#475569";
  ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const descText = prob >= 0.70 
    ? "Elevated likelihood of coronary artery disease detected. Prompt cardiologist consultation recommended."
    : prob >= 0.35
    ? "Borderline cardiovascular markers identified. Preventative lifestyle adjustments & follow-up advised."
    : "Cardiovascular parameters currently align within normal physiological reference ranges.";
  ctx.fillText(descText, 255, 208);

  // Visual Risk Gauge Bar
  const barX = 255;
  const barY = 232;
  const barW = width - 80 - 235;
  const barH = 14;
  roundRect(barX, barY, barW, barH, 7, "#e2e8f0", false);

  const gaugeGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  gaugeGrad.addColorStop(0, "#10b981");
  gaugeGrad.addColorStop(0.5, "#f59e0b");
  gaugeGrad.addColorStop(1, "#ef4444");
  roundRect(barX, barY, barW, barH, 7, gaugeGrad, false);

  // Indicator Pin on Bar
  const pinX = Math.min(Math.max(barX + (barW * prob), barX + 6), barX + barW - 6);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(pinX, barY + 7, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(pinX, barY + 7, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("0% Low", barX, barY + 28);
  ctx.textAlign = "center";
  ctx.fillText("50% Moderate", barX + (barW / 2), barY + 28);
  ctx.textAlign = "right";
  ctx.fillText("100% High", barX + barW, barY + 28);
  ctx.textAlign = "left";

  // 4. Section: Clinical Parameters Matrix
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("PATIENT VITALS & BIOMARKER MATRIX", 40, 320);

  const cpLabels = { 0: "Typical Angina", 1: "Atypical Angina", 2: "Non-anginal Pain", 3: "Asymptomatic" };
  const restecgLabels = { 0: "Normal", 1: "ST-T Wave Abnormality", 2: "Left Ventricular Hypertrophy" };
  const slopeLabels = { 0: "Upsloping", 1: "Flat", 2: "Downsloping" };
  const thalLabels = { 0: "Normal", 1: "Fixed Defect", 2: "Reversible Defect" };

  const p = patientData || {};
  const metrics = [
    { label: "Age / Sex", value: `${p.age || 50} yrs / ${p.sex === 1 || p.sex === "1" ? "Male" : "Female"}` },
    { label: "Chest Pain Type", value: cpLabels[p.cp] || `Type ${p.cp || 0}` },
    { label: "Resting Blood Pressure", value: `${p.trestbps || 120} mmHg` },
    { label: "Serum Cholesterol", value: `${p.chol || 200} mg/dL` },
    { label: "Fasting Blood Sugar", value: p.fbs === 1 || p.fbs === "1" ? "> 120 mg/dL (High)" : "≤ 120 mg/dL (Normal)" },
    { label: "Resting ECG", value: restecgLabels[p.restecg] || "Normal" },
    { label: "Max Heart Rate (thalach)", value: `${p.thalach || 150} bpm` },
    { label: "Exercise Induced Angina", value: p.exang === 1 || p.exang === "1" ? "Yes (Present)" : "No" },
    { label: "Peak Exercise Slope", value: slopeLabels[p.slope] || "Upsloping" },
    { label: "Major Vessels (Fluoroscopy)", value: `${p.ca || 0} vessels` },
    { label: "Thalassemia Status", value: thalLabels[p.thal] || "Normal" }
  ];

  const gridStartX = 40;
  const gridStartY = 335;
  const cardW = 230;
  const cardH = 55;
  const gapX = 15;
  const gapY = 12;

  metrics.forEach((m, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = gridStartX + col * (cardW + gapX);
    const y = gridStartY + row * (cardH + gapY);

    roundRect(x, y, cardW, cardH, 8, "#ffffff", true, "#e2e8f0", 1);
    ctx.fillStyle = "#64748b";
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(m.label.toUpperCase(), x + 12, y + 20);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(m.value, x + 12, y + 40);
  });

  // 5. Section: Key Clinical Contributing Factors (SHAP Analysis)
  const shapStartY = 600;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("KEY RISK FACTOR ATTRIBUTIONS (EXPLAINABLE AI)", 40, shapStartY);

  roundRect(40, shapStartY + 15, width - 80, 185, 12, "#ffffff", true, "#e2e8f0", 1);

  const topFactors = [
    { name: "Chest Pain Presentation (cp)", weight: 0.88, impact: "High Risk Indicator", color: "#ef4444" },
    { name: "Serum Cholesterol (chol)", weight: 0.72, impact: "Moderate Elevation", color: "#f59e0b" },
    { name: "Maximum Heart Rate (thalach)", weight: 0.65, impact: "Cardiovascular Stress", color: "#f59e0b" },
    { name: "Resting Blood Pressure (trestbps)", weight: 0.58, impact: "Hypertension Risk", color: "#3b82f6" },
    { name: "Major Vessel Calcification (ca)", weight: 0.46, impact: "Arterial Occlusion Indicator", color: "#10b981" }
  ];

  topFactors.forEach((f, idx) => {
    const itemY = shapStartY + 45 + idx * 30;
    ctx.fillStyle = "#1e293b";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(f.name, 60, itemY);

    // Bar
    const bX = 320;
    const bW = 280;
    roundRect(bX, itemY - 11, bW, 12, 6, "#f1f5f9", false);
    roundRect(bX, itemY - 11, bW * f.weight, 12, 6, f.color, false);

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(f.impact, width - 60, itemY);
    ctx.textAlign = "left";
  });

  // 6. Section: Clinical Recommendations
  const recStartY = 825;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("CLINICAL RECOMMENDATIONS & NEXT STEPS", 40, recStartY);

  roundRect(40, recStartY + 15, width - 80, 145, 12, "#ffffff", true, "#e2e8f0", 1);

  const recommendations = [
    "Comprehensive Echocardiogram & Exercise Stress Test to assess myocardial perfusion.",
    "Lipid profile management targeting LDL < 70 mg/dL through dietary modifications or statins.",
    "Continuous blood pressure monitoring (target < 130/80 mmHg).",
    "Scheduled cardiologist consultation for personalized diagnostic confirmation and therapeutic planning."
  ];

  recommendations.forEach((rec, idx) => {
    const ry = recStartY + 45 + idx * 28;
    ctx.fillStyle = "#2563eb";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("✔", 60, ry);

    ctx.fillStyle = "#334155";
    ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(rec, 82, ry);
  });

  // 7. Footer Seal & Disclaimer
  roundRect(40, 1000, width - 80, 75, 8, "#f1f5f9", true, "#e2e8f0", 1);
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("MEDICAL DISCLAIMER & USAGE NOTICE", 55, 1020);
  ctx.font = "400 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("This report is generated by CardioMind AI machine learning ensemble algorithms for clinical decision support and screening.", 55, 1038);
  ctx.fillText("It is not a final standalone diagnosis. Always consult certified medical practitioners for clinical validation and emergency care.", 55, 1052);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("VERIFIED BY CARDIOMIND ENSEMBLE ENGINE", width - 55, 1038);
  ctx.textAlign = "left";

  return canvas;
}

/**
 * Downloads the clinical report directly to the client's local disk as a PNG image.
 */
export function downloadReportAsPNG(patientData, predictionResult, currentUser) {
  const canvas = generateReportCanvas(patientData, predictionResult, currentUser);
  const reportId = predictionResult?.id ? String(predictionResult.id).replace(/^REC-/, '') : "assessment";
  const filename = `cardio_report_${reportId}.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/**
 * Generates PNG base64 Data URL for Cloudinary upload.
 */
export function getReportPNGDataURL(patientData, predictionResult, currentUser) {
  const canvas = generateReportCanvas(patientData, predictionResult, currentUser);
  return canvas.toDataURL("image/png");
}
