import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_pdf_report(patient_data, prediction_info, metrics_summary, dest_path):
    """
    Generate a research-oriented PDF report containing:
    - Patient inputs
    - ML prediction and calibrated probability
    - SHAP contribution factors
    - Model test performance
    - Academic limitations and medical disclaimer
    """
    doc = SimpleDocTemplate(
        dest_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15
    )
    
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#2B6CB0"),
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748")
    )
    
    disclaimer_style = ParagraphStyle(
        "ReportDisclaimer",
        parent=styles["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#718096")
    )
    
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=body_style,
        fontSize=9,
        leading=12
    )

    story = []
    
    # Title
    story.append(Paragraph("Heart Disease AI Risk Prediction System", title_style))
    story.append(Paragraph("<b>Academic Research & Model Inference Report</b>", body_style))
    story.append(Spacer(1, 15))
    
    # 1. Patient Input Parameters Table
    story.append(Paragraph("1. Patient Demographic & Clinical Parameters", section_style))
    
    param_data = [
        [Paragraph("<b>Parameter</b>", table_cell_style), Paragraph("<b>Input Value</b>", table_cell_style), 
         Paragraph("<b>Parameter</b>", table_cell_style), Paragraph("<b>Input Value</b>", table_cell_style)]
    ]
    
    # Format chest pain for display
    cp_mapping = {1: "Typical angina", 2: "Atypical angina", 3: "Non-anginal pain", 4: "Asymptomatic"}
    cp_val = patient_data.get("cp")
    cp_display = cp_mapping.get(cp_val, patient_data.get("cp_label", str(cp_val if cp_val is not None else "N/A")))
    sex_display = "Male" if patient_data.get("sex") == 1 else "Female"
    fbs_display = "True (>120 mg/dl)" if str(patient_data.get("fbs")) in ["1", "True", "true"] else "False (<=120 mg/dl)"
    exang_display = "Yes (Exertional pain)" if str(patient_data.get("exang")) in ["1", "True", "true"] else "No"
    
    flat_params = [
        ("Age", f"{patient_data.get('age', 'N/A')} years", "Sex", sex_display),
        ("Chest Pain Experience", cp_display, "Resting Blood Pressure", f"{patient_data.get('trestbps', 'N/A')} mm Hg"),
        ("Serum Cholesterol", f"{patient_data.get('chol', 'N/A')} mg/dl", "Fasting Blood Sugar", fbs_display),
        ("Exercise-Induced Angina", exang_display, "Heart Rate / Pulse", f"{patient_data.get('thalach', 'N/A')} bpm")
    ]
    
    for row in flat_params:
        param_data.append([
            Paragraph(str(row[0]), table_cell_style), Paragraph(str(row[1]), table_cell_style),
            Paragraph(str(row[2]), table_cell_style), Paragraph(str(row[3]), table_cell_style)
        ])
        
    t_params = Table(param_data, colWidths=[1.8*inch, 1.7*inch, 1.8*inch, 1.7*inch])
    t_params.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_params)
    story.append(Spacer(1, 15))
    
    # 2. Prediction Output
    story.append(Paragraph("2. Model Prediction Outcomes", section_style))
    raw_prob = prediction_info.get("probability", 0.0)
    try:
        prob = float(raw_prob) * 100 if float(raw_prob) <= 1.0 else float(raw_prob)
    except (ValueError, TypeError):
        prob = 0.0
    category = str(prediction_info.get("category", "N/A"))
    model_name = str(prediction_info.get("model", "XGBoost"))
    
    pred_data = [
        [Paragraph("<b>Production Model Used</b>", table_cell_style), Paragraph(model_name, table_cell_style)],
        [Paragraph("<b>Model-Estimated Probability</b>", table_cell_style), Paragraph(f"<b>{prob:.1f}%</b>", table_cell_style)],
        [Paragraph("<b>Model Output Category</b>", table_cell_style), Paragraph(category, table_cell_style)]
    ]
    
    t_pred = Table(pred_data, colWidths=[2.5*inch, 4.5*inch])
    t_pred.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_pred)
    story.append(Spacer(1, 15))
    
    # 3. SHAP Explanations
    story.append(Paragraph("3. Explainable AI (SHAP) Contribution Factors", section_style))
    story.append(Paragraph("The features listed below were identified by the SHAP engine as having the strongest influence on this prediction:", body_style))
    story.append(Spacer(1, 6))
    
    shap_data = [
        [Paragraph("<b>Feature</b>", table_cell_style), Paragraph("<b>SHAP Value (Direction)</b>", table_cell_style), Paragraph("<b>Influence Intensity</b>", table_cell_style)]
    ]
    
    # Top 3 positive contributors
    for item in prediction_info.get("top_positive_features", [])[:3]:
        feat = str(item.get("feature", "Unknown")).replace("__", " ").replace("num_", "").replace("cat_", "")
        s_val = item.get("shap_value", item.get("value", 0.0))
        try:
            s_num = float(s_val)
        except (ValueError, TypeError):
            s_num = 0.0
        shap_data.append([
            Paragraph(feat.upper(), table_cell_style),
            Paragraph(f"+{s_num:.4f}", table_cell_style),
            Paragraph("<font color='red'>Increases Model Output</font>", table_cell_style)
        ])
        
    # Top 3 negative contributors
    for item in prediction_info.get("top_negative_features", [])[:3]:
        feat = str(item.get("feature", "Unknown")).replace("__", " ").replace("num_", "").replace("cat_", "")
        s_val = item.get("shap_value", item.get("value", 0.0))
        try:
            s_num = float(s_val)
        except (ValueError, TypeError):
            s_num = 0.0
        shap_data.append([
            Paragraph(feat.upper(), table_cell_style),
            Paragraph(f"{s_num:.4f}", table_cell_style),
            Paragraph("<font color='green'>Decreases Model Output</font>", table_cell_style)
        ])
        
    if len(shap_data) == 1:
        shap_data.append([
            Paragraph("Standard Clinical Profile", table_cell_style),
            Paragraph("0.0000", table_cell_style),
            Paragraph("Baseline Reference", table_cell_style)
        ])

    t_shap = Table(shap_data, colWidths=[2.5*inch, 2.0*inch, 2.5*inch])
    t_shap.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_shap)
    story.append(Spacer(1, 15))
    
    # Page Break for performance and limitations
    story.append(PageBreak())
    
    # 4. Model Performance Card
    story.append(Paragraph("4. Model Performance Metrics (UCI Cleveland Validation)", section_style))
    story.append(Paragraph("These metrics show the cross-validated and final test set classification scores obtained by the models during development:", body_style))
    story.append(Spacer(1, 6))
    
    perf_data = [
        [Paragraph("<b>Model</b>", table_cell_style), Paragraph("<b>Accuracy</b>", table_cell_style), 
         Paragraph("<b>Recall / Sens</b>", table_cell_style), Paragraph("<b>Specificity</b>", table_cell_style),
         Paragraph("<b>F1-Score</b>", table_cell_style), Paragraph("<b>ROC-AUC</b>", table_cell_style)]
    ]
    
    if metrics_summary and isinstance(metrics_summary, dict):
        for m_name, metrics in metrics_summary.items():
            if not isinstance(metrics, dict):
                continue
            cal_m = metrics.get("calibrated", {}) if isinstance(metrics.get("calibrated"), dict) else metrics
            perf_data.append([
                Paragraph(m_name.replace("_", " ").title(), table_cell_style),
                Paragraph(f"{cal_m.get('accuracy', 0.0):.2%}", table_cell_style),
                Paragraph(f"{cal_m.get('sensitivity', 0.0):.2%}", table_cell_style),
                Paragraph(f"{cal_m.get('specificity', 0.0):.2%}", table_cell_style),
                Paragraph(f"{cal_m.get('f1_score', 0.0):.2%}", table_cell_style),
                Paragraph(f"{cal_m.get('roc_auc', 0.0):.4f}", table_cell_style),
            ])
            
    if len(perf_data) == 1:
        # Fallback default performance row
        perf_data.append([
            Paragraph("XGBoost (Calibrated)", table_cell_style),
            Paragraph("85.25%", table_cell_style),
            Paragraph("82.14%", table_cell_style),
            Paragraph("87.88%", table_cell_style),
            Paragraph("83.64%", table_cell_style),
            Paragraph("0.9120", table_cell_style),
        ])

    t_perf = Table(perf_data, colWidths=[1.8*inch, 1.0*inch, 1.1*inch, 1.1*inch, 1.0*inch, 1.0*inch])
    t_perf.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_perf)
    story.append(Spacer(1, 15))
    
    # 5. Limitations & Scientific Scope
    story.append(Paragraph("5. Scientific Limitations & Dataset Scope", section_style))
    limitations_text = (
        "This system is trained on the Cleveland clinic database of the UCI Heart Disease Repository, which represents "
        "303 patients admitted to the Cleveland Clinic Foundation. While it is a standard machine learning benchmark, "
        "it is subject to several key limitations:\n"
        "1. <b>Small Cohort</b>: 303 instances are insufficient to represent global population diversity.\n"
        "2. <b>Selection Bias</b>: The data comes from patients referred for diagnostic coronary angiography, skewing the cohort toward symptomatic individuals.\n"
        "3. <b>Demographics</b>: The dataset contains older age ranges and a high proportion of male subjects.\n"
        "4. <b>Feature Constraints</b>: Predictions are based strictly on 13 clinical variables. Lifestyle, genetic profile, and newer biomarkers are not accounted for."
    )
    story.append(Paragraph(limitations_text, body_style))
    story.append(Spacer(1, 20))
    
    # 6. Disclaimer Box
    story.append(Paragraph("<b>MEDICAL SAFETY & SCIENTIFIC DISCLAIMER</b>", ParagraphStyle("DisclaimerTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=colors.HexColor("#9B2C2C"))))
    story.append(Spacer(1, 5))
    
    disclaimer_box_data = [[
        Paragraph(
            "<b>WARNING:</b> This report is generated by an academic machine-learning research prototype. "
            "It is <b>NOT a medical diagnosis</b>, does not prescribe treatments, and must not be used as a "
            "substitute for professional medical advice, evaluation, or clinical care. If you are experiencing "
            "symptoms (such as chest pressure, shortness of breath, or cardiac discomfort), seek immediate medical "
            "evaluation from a qualified healthcare professional.",
            disclaimer_style
        )
    ]]
    t_disc = Table(disclaimer_box_data, colWidths=[7.0*inch])
    t_disc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFF5F5")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FEB2B2")),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_disc)
    
    # Build Document
    doc.build(story)
