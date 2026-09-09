import os
import re
import glob
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
_SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SERVER_DIR)
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"), override=True)
load_dotenv(override=True)

try:
    # pyrefly: ignore [missing-import]
    from server import chat_db
except ImportError:
    import chat_db

SYSTEM_INSTRUCTION = """You are CardioAI, a specialized heart health clinical education assistant built into the CardioMind Heart Disease AI Prediction System.

Your role:
- Answer questions about cardiovascular terminology, risk factors, prevention guidelines, clinical tests (ECG, stress test, angiography), and the ML prediction models used in this system.
- Always provide structured, comprehensive, and tailored explanations with clean markdown formatting.
- If an active patient prediction context is provided, explain the specific factors that contributed to their risk score based on SHAP values.
- Remind users that model outputs are statistical research estimates, not medical diagnoses, and advise consulting a healthcare professional for clinical decisions."""

# Comprehensive clinical knowledge repository for instant, accurate answers
TOPIC_ANSWERS = {
    "chest_pain": """### Understanding Chest Pain (Angina) in Cardiology

Chest pain is one of the most critical clinical indicators of potential cardiovascular compromise. In clinical cardiology and the Cleveland dataset, chest pain is classified into **4 distinct types**:

1. **Type 1: Typical Angina**
   - **Characteristics**: Retrosternal chest pressure, squeezing, tightness, or heaviness.
   - **Triggers**: Precipitated by physical exertion, cold weather, or emotional stress.
   - **Relief**: Promptly relieved within 5 minutes by rest or sublingual nitroglycerin.
   - **Significance**: Highest correlation with significant coronary artery disease (CAD).

2. **Type 2: Atypical Angina**
   - Meets only 2 of the 3 classic criteria of typical angina (e.g. pain occurs at rest or lacks typical squeezing quality).
   - More frequently observed in women, elderly individuals, and diabetic patients.

3. **Type 3: Non-Anginal Pain**
   - Meets only 1 or none of the classic angina criteria.
   - Often musculoskeletal (costochondritis), gastroesophageal (GERD, esophageal spasm), or pleuritic in origin.

4. **Type 4: Asymptomatic / Silent Ischemia**
   - Absence of subjective chest discomfort despite objective evidence of myocardial ischemia (e.g. ST-segment depression on stress ECG).
   - Especially prevalent in diabetic patients due to autonomic cardiac neuropathy.

⚠️ **Emergency Note**: Any sudden, crushing chest pain radiating to the left arm, neck, or jaw accompanied by cold sweats or shortness of breath warrants immediate emergency medical care (call 911 / 112).""",

    "blood_pressure": """### Blood Pressure & Hypertension in Cardiovascular Health

Resting Blood Pressure (`trestbps`) measures the hydrostatic pressure exerted by circulating blood upon arterial walls during the cardiac cycle:

- **Systolic Pressure (Top Number)**: Peak arterial pressure during left ventricular contraction (systole).
- **Diastolic Pressure (Bottom Number)**: Minimum arterial pressure during ventricular relaxation and filling (diastole).

#### Clinical Classification (ACC/AHA Guidelines):
| Category | Systolic (mm Hg) | Diastolic (mm Hg) | Clinical Action |
|---|---|---|---|
| **Normal** | < 120 | and < 80 | Maintain heart-healthy lifestyle |
| **Elevated** | 120 – 129 | and < 80 | Lifestyle interventions, sodium reduction |
| **Stage 1 Hypertension** | 130 – 139 | or 80 – 89 | Lifestyle modification + pharmacotherapy if high ASCVD risk |
| **Stage 2 Hypertension** | ≥ 140 | or ≥ 90 | Prompt dual-agent medication and regular monitoring |
| **Hypertensive Crisis** | > 180 | and/or > 120 | Immediate emergency medical attention required |

#### Mechanism of Damage:
Chronic hypertension damages arterial endothelial linings, accelerates atherosclerotic plaque formation, increases cardiac afterload, and induces **Left Ventricular Hypertrophy (LVH)**.""",

    "cholesterol": """### Serum Cholesterol & Lipid Metabolism

Serum cholesterol (`chol`) is an essential lipid molecule carried through the bloodstream by specialized lipoproteins:

1. **LDL (Low-Density Lipoprotein) — "Atherogenic Cholesterol"**:
   - Transports cholesterol from the liver to peripheral arterial tissues.
   - Excess circulating LDL penetrates the vascular intima, undergoes oxidation, and is engulfed by macrophages to form **foam cells**, initiating atherosclerosis.
   - Optimal clinical target: **< 100 mg/dL** (or < 70 mg/dL in high-risk patients).

2. **HDL (High-Density Lipoprotein) — "Protective Cholesterol"**:
   - Facilitates **reverse cholesterol transport**, scavenging excess cholesterol from tissues and plaques and returning it to the liver for biliary excretion.
   - Protective levels: **≥ 40 mg/dL (men)** and **≥ 50 mg/dL (women)**.

3. **Triglycerides**:
   - The primary storage form of fatty acids. Elevated levels (> 150 mg/dL) synergize with high LDL to accelerate vascular inflammation.

4. **Total Cholesterol Targets**:
   - **Desirable**: < 200 mg/dL
   - **Borderline High**: 200 – 239 mg/dL
   - **High Risk**: ≥ 240 mg/dL (doubles coronary heart disease risk).""",

    "sugar": """### Fasting Blood Sugar (FBS) & Diabetic Cardiovascular Disease

In the CardioMind feature set, `fbs` indicates whether fasting blood glucose exceeds **120 mg/dL** (1 = True, 0 = False):

- **Mechanism**: Fasting blood sugar > 120 mg/dL is a hallmark of impaired fasting glucose, insulin resistance, or diabetes mellitus.
- **Cardiovascular Impact**:
  - **Endothelial Glycation**: Persistent hyperglycemia promotes Advanced Glycation End-products (AGEs), creating oxidative stress that stiffens blood vessels.
  - **Microvascular & Macrovascular Complications**: Accelerates coronary plaque vulnerability, promotes thrombosis, and impairs collateral blood flow.
  - **Silent Ischemia**: Diabetic autonomic neuropathy diminishes pain perception during ischemia, meaning heart attacks can occur with little to no chest pain.""",

    "ecg": """### Resting Electrocardiogram (`restecg`) & Cardiac Rhythm

The resting ECG measures the summation of cardiac electrical vectors across 12 standard leads:

1. **Category 0: Normal**
   - Normal sinus rhythm, intact P-QRS-T sequence, no pathological Q-waves or ischemic repolarization anomalies.

2. **Category 1: ST-T Wave Abnormality**
   - T-wave inversions (≥ 0.1 mV) or ST-segment elevation/depression without significant Q-waves.
   - Strong marker of subendocardial ischemia, electrolyte disturbance, or myocardial strain.

3. **Category 2: Left Ventricular Hypertrophy (LVH)**
   - Characterized by Estes criteria or Sokolow-Lyon voltage criteria (S in V1 + R in V5/V6 ≥ 35 mm).
   - Reflects myocardial wall thickening resulting from long-standing pressure overload (such as untreated hypertension or aortic stenosis).""",

    "stress_test": """### Exercise ST Depression (`oldpeak`), Slope & Thalium Scan

These features represent the clinical exercise stress test parameters:

1. **`oldpeak` (ST Depression Induced by Exercise)**:
   - Quantifies the vertical displacement of the ST segment at 80 ms past the J-point during peak exercise compared to resting baseline.
   - Values > 1.5–2.0 mm indicate significant myocardial ischemia caused by coronary artery obstruction.

2. **`slope` (ST Segment Slope at Peak Exercise)**:
   - **Upsloping (1)**: Rapidly ascending ST segment; generally non-ischemic or low risk.
   - **Flat (2)**: Horizontal ST depression; highly indicative of myocardial ischemia.
   - **Downsloping (3)**: Oblique downward ST depression; represents severe, multi-vessel CAD with high cardiac risk.

3. **`thal` (Thallium Myocardial Perfusion Scintigraphy)**:
   - **Normal (3)**: Uniform tracer distribution throughout the left ventricular myocardium.
   - **Fixed Defect (6)**: Region that does not take up tracer at rest or stress; indicates infarcted scar tissue from a prior heart attack.
   - **Reversible Defect (7)**: Region that shows low perfusion under exercise stress but fills in at rest; classic marker of inducible myocardial ischemia treatable by revascularization (stent or bypass).""",

    "risk_factors": """### Comprehensive Cardiovascular Risk Factors (AHA & ACC Guidelines)

Cardiovascular disease (CVD) develops from an interplay of modifiable lifestyle behaviors and non-modifiable biological factors:

#### 1. Major Modifiable Risk Factors
- **Hypertension (High Blood Pressure)**: The single greatest contributor to vascular damage, endothelial dysfunction, and left ventricular hypertrophy (LVH).
- **Dyslipidemia (Atherogenic Lipids)**: Elevated LDL particles penetrate arterial walls, oxidize, and trigger atherosclerotic plaque formation.
- **Diabetes Mellitus & Impaired Fasting Glucose (`fbs`)**: Hyperglycemia accelerates arterial stiffening and promotes silent myocardial ischemia.
- **Tobacco & Nicotine Use**: Promotes vasoconstriction, elevates carboxyhemoglobin, and doubles the risk of acute coronary syndromes.
- **Physical Inactivity & Sedentary Lifestyle**: Increases adiposity, worsens insulin sensitivity, and lowers protective HDL cholesterol.
- **Unhealthy Dietary Patterns**: High dietary sodium (> 2,300 mg/day), saturated/trans fatty acids, and ultra-processed foods.
- **Obesity (BMI ≥ 30 kg/m² or Central Adiposity)**: Exerts inflammatory and mechanical stress on the myocardium.

#### 2. Non-Modifiable Risk Factors
- **Age**: Risk increases progressively with vascular aging and arterial stiffening.
- **Biological Sex**: Men historically face earlier CVD onset; female risk accelerates rapidly post-menopause.
- **Family History & Genetics**: First-degree relative with premature CAD (< 55 years in men, < 65 in women) indicates genetic predisposition.

#### 3. Clinical Risk Scoring
In modern cardiology, risk is quantified via the **10-Year ASCVD Risk Score** (PCE), integrating these biomarkers to guide statin and antihypertensive therapy.""",

    "thalach": """### Maximum Heart Rate (`thalach`) & Chronotropic Response

In cardiovascular stress testing and the Cleveland dataset, `thalach` represents the **highest heart rate achieved** (in beats per minute) during standardized treadmill exercise (Bruce protocol):

#### Clinical Significance:
1. **Age-Predicted Maximum Heart Rate**:
   - Estimated clinically using the standard formula:
     $$\\text{Target Maximum HR} = 220 - \\text{Age}$$
   - A healthy diagnostic stress test typically aims to achieve **≥ 85% of age-predicted maximum HR**.

2. **Chronotropic Incompetence**:
   - Inability of the sinus node to increase heart rate adequately during peak physical exertion (< 80% of predicted reserve).
   - Serves as an independent predictor of severe coronary artery disease, autonomic dysfunction, and adverse cardiac events.

3. **Why Lower Peak Heart Rate Correlates with Risk**:
   - In the CardioMind dataset, patients with significant coronary stenosis often stop exercising early due to ischemic angina, shortness of breath, or fatigue before reaching high target heart rates.
   - Hence, a lower `thalach` is statistically associated with higher model-predicted risk.""",

    "vessels_ca": """### Major Vessels Colored by Fluoroscopy (`ca`)

In coronary angiography (cardiac catheterization), `ca` indicates the **number of major coronary arteries (0 to 3)** with significant luminal narrowing (typically ≥ 50% diameter stenosis) visualized using radiopaque contrast dye under X-ray fluoroscopy:

#### The Three Epicardial Vessels Examined:
1. **Left Anterior Descending (LAD)**:
   - "The Widowmaker" artery; supplies 45–55% of the left ventricle including the anterior wall, apex, and septum.
2. **Left Circumflex (LCx)**:
   - Courses along the atrioventricular groove to supply the lateral and posterior ventricular walls.
3. **Right Coronary Artery (RCA)**:
   - Supplies the right ventricle, inferior left ventricular wall, and the sinoatrial/atrioventricular (SA/AV) pacing nodes in 90% of individuals.

#### Risk Stratification:
- **`ca = 0`**: No significant multi-vessel obstructive lesions visualized (lowest anatomic CAD risk).
- **`ca = 1`**: Single-vessel coronary artery disease; often managed via targeted percutaneous coronary intervention (PCI / stenting) or intensive medical therapy.
- **`ca = 2 or 3`**: Multi-vessel coronary disease; indicates extensive systemic atherosclerosis and often warrants Coronary Artery Bypass Graft (CABG) surgery.""",

    "emergency": """### 🚨 Emergency Cardiovascular Protocols & Warning Signs

If you or someone around you experiences any of the following acute symptoms, **call local emergency services (911 / 112) immediately**. Do NOT drive yourself to the hospital.

#### 1. Acute Myocardial Infarction (Heart Attack) Red Flags:
- **Chest Discomfort**: Persistent pressure, fullness, squeezing, or crushing pain in the center of the chest lasting more than a few minutes.
- **Radiation**: Pain extending to one or both arms (especially the left), back, neck, jaw, or epigastrium.
- **Associated Symptoms**: Cold diaphoresis (sweating), unexplained dyspnea (shortness of breath), acute nausea, dizziness, or lightheadedness.
- *Note for Women & Diabetics*: Frequently present with atypical symptoms such as fatigue, back pain, or indigestion rather than classic substernal heaviness.

#### 2. Cardiac Arrest (Unresponsiveness & Apnea):
- **Recognition**: The person suddenly collapses, is unresponsive to shouting/shaking, and is not breathing or only gasping (agonal breathing).
- **Immediate Action**:
  1. Call emergency services immediately.
  2. Send someone to retrieve an Automated External Defibrillator (AED).
  3. **Hands-Only CPR**: Place hands in center of chest and push hard and fast at **100–120 compressions per minute** (to the beat of "Stayin' Alive") at least 2 inches deep.
  4. Power on the AED as soon as it arrives and follow the spoken voice prompts.""",

    "heart_attack": """### Heart Attack vs. Cardiac Arrest: Key Differences

Although often used interchangeably, they represent two distinct medical emergencies:

1. **Heart Attack (Myocardial Infarction) — A Circulation Problem**:
   - Occurs when blood flow to a section of the heart muscle is blocked (usually by a ruptured plaque and blood clot in a coronary artery).
   - The heart muscle begins dying from oxygen deprivation, but the heart usually continues beating.
   - **Symptoms**: Crushing chest heaviness, pain radiating to left arm/jaw, shortness of breath, nausea, cold sweats.

2. **Cardiac Arrest — An Electrical Malfunction**:
   - Occurs when an electrical disruption (often Ventricular Fibrillation) causes the heart to suddenly stop pumping blood to the brain and vital organs.
   - The patient collapses, loses consciousness within seconds, and stops breathing normally.
   - **Action Required**: Immediate bystander CPR and use of an Automated External Defibrillator (AED) are essential for survival.

*Note: A heart attack is a leading cause of sudden cardiac arrest.*""",

    "heart_failure": """### Heart Failure (HF): Pathophysiology & Clinical Stages

Heart failure is a chronic, progressive condition in which the heart muscle cannot pump blood efficiently to meet the metabolic demands of the body:

#### 1. Primary Classifications:
- **HFrEF (Heart Failure with Reduced Ejection Fraction)**:
  - Systolic dysfunction: Ejection Fraction (EF) **≤ 40%**.
  - The left ventricle is dilated and too weak to contract vigorously (often caused by prior myocardial infarction or dilated cardiomyopathy).
- **HFpEF (Heart Failure with Preserved Ejection Fraction)**:
  - Diastolic dysfunction: Ejection Fraction **≥ 50%**.
  - The left ventricle is stiff, thickened (LVH), and unable to relax and fill properly during diastole (frequently driven by chronic hypertension).

#### 2. Hallmarks & Clinical Signs:
- **Dyspnea on Exertion** and **Orthopnea** (shortness of breath when lying flat, relieved by propping up on pillows).
- **Paroxysmal Nocturnal Dyspnea (PND)**: Sudden awakening gasping for air.
- **Peripheral Edema**: Bilateral swelling in the ankles, lower legs, or abdomen due to venous fluid accumulation.
- **Fatigue & Reduced Exercise Tolerance**: Caused by poor systemic organ perfusion.""",

    "medications": """### Common Cardiovascular Medications & Mechanisms of Action

Cardiologists prescribe evidence-based guideline-directed medical therapies (GDMT) to reduce cardiovascular mortality and stabilize vascular plaques:

| Drug Class | Common Examples | Primary Mechanism of Action | Clinical Indication |
|---|---|---|---|
| **Statins (HMG-CoA Reductase Inhibitors)** | Atorvastatin, Rosuvastatin | Inhibits hepatic cholesterol synthesis, upregulates LDL receptors, stabilizes fibrous plaques | Primary & secondary prevention of CAD |
| **ACE Inhibitors / ARBs** | Lisinopril, Ramipril, Losartan | Blocks renin-angiotensin-aldosterone system; lowers arterial afterload and prevents cardiac remodeling | Hypertension, heart failure, post-MI |
| **Beta-Blockers** | Metoprolol, Carvedilol, Bisoprolol | Antagonizes adrenergic beta-1 receptors; reduces heart rate, contractility, and myocardial oxygen demand | Angina, arrhythmias, heart failure |
| **Antiplatelet Agents** | Aspirin (81mg), Clopidogrel | Irreversibly inhibits platelet cyclooxygenase (COX-1) and ADP receptors to prevent arterial thrombosis | Post-stent, secondary MI prevention |
| **Calcium Channel Blockers** | Amlodipine, Diltiazem | Inhibits calcium influx into vascular smooth muscle; induces systemic vasodilation | Hypertension, Prinzmetal angina |

⚠️ *Important: All pharmacotherapy must be prescribed and monitored by a qualified physician. Never adjust dosages without medical supervision.*""",

    "prevention": """### Evidence-Based Cardiovascular Prevention Strategies (AHA/ACC)

Cardiovascular disease is largely preventable through comprehensive lifestyle modification:

1. **Heart-Healthy Nutrition**:
   - **Mediterranean / DASH Diet Pattern**: High in vegetables, legumes, whole grains, nuts, and extra virgin olive oil.
   - **Sodium Restriction**: Keep sodium intake under **1,500 – 2,300 mg/day** to lower systolic blood pressure by 5–10 mm Hg.
   - **Eliminate Trans Fats**: Replace saturated fats with monounsaturated and polyunsaturated fats (omega-3 fatty acids).

2. **Structured Physical Activity**:
   - At least **150 minutes per week** of moderate-intensity aerobic exercise (e.g. brisk walking) or **75 minutes** of vigorous aerobic exercise.
   - Resistance training at least 2 days per week to optimize insulin sensitivity.

3. **Tobacco & Nicotine Cessation**:
   - Smoking cessation reduces myocardial infarction risk by **50% within just 1 year**.

4. **Weight & Metabolic Optimization**:
   - Maintain BMI between 18.5 – 24.9 kg/m² and waist circumference < 35 inches (women) or < 40 inches (men).""",

    "models": """### Machine Learning Methodology in CardioMind

CardioMind demonstrates an end-to-end clinical machine-learning pipeline:

1. **Algorithms Evaluated**:
   - **Logistic Regression**: Interpretable, calibrated baseline with linear log-odds formulation.
   - **Random Forest**: Ensemble of 100+ de-correlated decision trees modeling non-linear feature interactions.
   - **XGBoost (Extreme Gradient Boosting)**: State-of-the-art gradient boosted trees optimizing regularized loss.
   - **Support Vector Machine (SVM)**: Maximum-margin hyperplane with RBF kernel.

2. **Probability Calibration (Platt Scaling)**:
   - Raw tree ensembles output uncalibrated scores that do not reflect true statistical probabilities.
   - We apply **CalibratedClassifierCV** using sigmoid log-odds mapping fitted across out-of-fold cross-validation.

3. **Explainable AI (SHAP)**:
   - Utilizes **SHAP (SHapley Additive exPlanations)** based on cooperative game theory.
   - Computes exact marginal contributions of each clinical biomarker to the final risk probability for every patient."""
}


class ChatbotEngine:
    def __init__(self, knowledge_dir="knowledge"):
        self.knowledge_dir = knowledge_dir
        self.documents = []
        self.chat_session = None
        self.load_knowledge_base()
        self._init_chat_session()

    def load_knowledge_base(self):
        """Recursively load markdown files in the knowledge directory."""
        if not os.path.exists(self.knowledge_dir):
            return

        filepaths = glob.glob(os.path.join(self.knowledge_dir, "**", "*.md"), recursive=True)
        for filepath in filepaths:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                sections = re.split(r"\n{2,}", content)
                for sec in sections:
                    sec_clean = sec.strip()
                    if len(sec_clean) > 40:
                        self.documents.append({
                            "file": os.path.basename(filepath),
                            "category": os.path.basename(os.path.dirname(filepath)),
                            "text": sec_clean
                        })
            except Exception as e:
                print(f"[CHATBOT] Failed to read {filepath}: {e}")

    def _init_chat_session(self):
        """Initialize a Gemini chat session if API key is configured."""
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("[CHATBOT] No Gemini API key found. Chat will use intelligent local clinical QA engine.")
            self.chat_session = None
            return

        try:
            genai.configure(api_key=api_key)
            model = None
            for model_name in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]:
                try:
                    model = genai.GenerativeModel(model_name, system_instruction=SYSTEM_INSTRUCTION)
                    break
                except Exception:
                    continue

            if not model:
                model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=SYSTEM_INSTRUCTION)

            self.chat_session = model.start_chat(history=[
                {
                    "role": "user",
                    "parts": ["Initialize CardioMind heart health clinical assistant."]
                },
                {
                    "role": "model",
                    "parts": ["I am CardioAI, your cardiovascular health and prediction assistant. I am ready to help you explore heart disease risk factors, clinical tests, and model outcomes."]
                }
            ])
            print("[CHATBOT] Gemini AI chat session initialized successfully.")
        except Exception as e:
            print(f"[CHATBOT ERROR] Failed to initialize Gemini session: {e}")
            self.chat_session = None

    def generate_smart_response(self, query: str, prediction_context: Optional[dict] = None) -> str:
        """
        Intelligent cardiovascular question classifier that returns precise,
        tailored clinical answers across all cardiology domains.
        """
        q = query.lower().strip()
        
        # 1. Greetings
        if any(greet in q for greet in ["hi", "hello", "hey", "good morning", "good evening", "who are you"]):
            return (
                "### Welcome to CardioAI Assistant! ❤️\n\n"
                "I am your specialized cardiovascular health and predictive intelligence companion. I can help you explore:\n\n"
                "- **Clinical Biomarkers**: Blood pressure (`trestbps`), serum cholesterol (`chol`), fasting blood sugar (`fbs`), resting ECG (`restecg`).\n"
                "- **Diagnostic Tests**: Chest pain classification (angina types 1-4), max heart rate (`thalach`), fluoroscopy vessels (`ca`), exercise ST depression (`oldpeak`), and thallium scintigraphy (`thal`).\n"
                "- **Emergency Warning Signs**: Heart attack vs. cardiac arrest symptoms and immediate life-saving actions.\n"
                "- **CardioMind Machine Learning**: How calibrated XGBoost, Random Forest, Platt scaling, and SHAP explainability predict cardiovascular risk.\n"
                "- **Prevention & Diet**: Guidelines from the AHA and ACC for optimal heart health.\n\n"
                "How can I assist your cardiovascular inquiry today?"
            )

        # 2. Emergency & Warning Signs
        if any(term in q for term in ["emergency", "warning sign", "red flag", "call 911", "first aid", "cpr", "aed", "danger", "urgent"]):
            return TOPIC_ANSWERS["emergency"]

        # 3. Heart attack vs Cardiac arrest
        if "heart attack" in q or "cardiac arrest" in q or "myocardial infarction" in q:
            return TOPIC_ANSWERS["heart_attack"]

        # 4. Risk Factors & Causes
        if any(term in q for term in ["risk factor", "risk factors", "what causes", "causes of heart", "predispos", "why do people get"]):
            return TOPIC_ANSWERS["risk_factors"]

        # 5. Patient-specific context if available
        if prediction_context and any(term in q for term in ["my risk", "my result", "prediction", "my score", "why high", "why low", "why did", "patient", "explain my", "my outcome"]):
            prob = prediction_context.get("probability", 0.0) * 100
            category = prediction_context.get("category", "N/A")
            pos_features = ", ".join([f"**{x['feature']}** (+{x['shap_value']:.2f})" for x in prediction_context.get("top_positive_features", [])[:4]])
            neg_features = ", ".join([f"**{x['feature']}** ({x['shap_value']:.2f})" for x in prediction_context.get("top_negative_features", [])[:4]])
            
            return (
                f"### Analysis of Your Patient Risk Prediction Outcome\n\n"
                f"- **Model-Calibrated Risk Probability**: **{prob:.1f}%**\n"
                f"- **Model Risk Category**: **{category}**\n\n"
                f"#### Top Clinical Factors Increasing Risk (SHAP Accelerators):\n"
                f"{pos_features or '• None identified in positive direction'}\n\n"
                f"#### Top Protective Factors (SHAP Mitigators):\n"
                f"{neg_features or '• None identified in negative direction'}\n\n"
                f"#### Clinical Context & Recommendation:\n"
                f"The probability was generated using **Platt-calibrated XGBoost** with game-theoretic SHAP feature attribution. "
                f"Features with positive attribution scores elevated the statistical risk estimate, while negative scores acted protectively. "
                f"Please note that this is an academic research demonstration and not a clinical diagnosis. Consult a cardiologist for clinical diagnostic evaluation."
            )

        # 6. Chest pain & Angina
        if any(term in q for term in ["chest pain", "angina", "cp", "chest discomfort", "pain type", "typical angina", "atypical angina"]):
            return TOPIC_ANSWERS["chest_pain"]

        # 7. Blood pressure & Hypertension
        if any(term in q for term in ["blood pressure", "trestbps", "hypertension", "high bp", "systolic", "diastolic", "normal bp"]):
            return TOPIC_ANSWERS["blood_pressure"]

        # 8. Cholesterol & Lipids
        if any(term in q for term in ["cholesterol", "chol", "ldl", "hdl", "triglyceride", "lipid", "atheroma"]):
            return TOPIC_ANSWERS["cholesterol"]

        # 9. Fasting Blood Sugar & Diabetes
        if any(term in q for term in ["blood sugar", "sugar", "glucose", "fbs", "diabetes", "diabetic", "a1c", "glycat"]):
            return TOPIC_ANSWERS["sugar"]

        # 10. Resting ECG & Rhythm
        if any(term in q for term in ["ecg", "ekg", "restecg", "electrocardiogram", "lvh", "t wave", "st-t", "hypertrophy", "rhythm"]):
            return TOPIC_ANSWERS["ecg"]

        # 11. Maximum Heart Rate (thalach)
        if any(term in q for term in ["thalach", "max heart rate", "maximum heart rate", "peak heart rate", "chronotropic"]):
            return TOPIC_ANSWERS["thalach"]

        # 12. Major Vessels (ca) & Fluoroscopy
        if any(term in q for term in ["ca", "vessel", "vessels", "fluoroscopy", "angiography", "angiogram", "coronary arter", "lad", "rca"]):
            return TOPIC_ANSWERS["vessels_ca"]

        # 13. Stress test, ST depression, slope, thallium scan
        if any(term in q for term in ["stress test", "oldpeak", "st depression", "slope", "thal", "thallium", "scintigraphy", "exang", "exercise angina"]):
            return TOPIC_ANSWERS["stress_test"]

        # 14. Heart Failure
        if any(term in q for term in ["heart failure", "hfref", "hfpef", "ejection fraction", "fluid retention", "shortness of breath", "dyspnea"]):
            return TOPIC_ANSWERS["heart_failure"]

        # 15. Medications
        if any(term in q for term in ["medicine", "medication", "drug", "statin", "aspirin", "beta blocker", "ace inhibitor", "losartan", "metoprolol"]):
            return TOPIC_ANSWERS["medications"]

        # 16. Diet, Lifestyle & Prevention
        if any(term in q for term in ["diet", "food", "prevention", "prevent", "exercise", "smoking", "weight", "lifestyle", "habit", "dash", "mediterranean", "salt", "nutrition"]):
            return TOPIC_ANSWERS["prevention"]

        # 17. ML Models, Accuracy, XGBoost, SHAP, Calibration
        if any(term in q for term in ["model", "algorithm", "xgboost", "random forest", "logistic regression", "svm", "shap", "calibration", "dataset", "platt", "accuracy", "brier", "auc", "roc"]):
            return TOPIC_ANSWERS["models"]

        # 18. Fallback: Search knowledge documents for semantic match
        matching_docs = []
        q_words = set(re.findall(r"\w+", q)) - {"what", "is", "a", "the", "and", "or", "how", "why", "in", "to", "for", "tell", "me", "about"}
        for doc in self.documents:
            doc_words = set(re.findall(r"\w+", doc["text"].lower()))
            overlap = len(q_words.intersection(doc_words))
            if overlap > 0:
                matching_docs.append((doc, overlap))

        matching_docs.sort(key=lambda x: x[1], reverse=True)
        if matching_docs:
            top_doc = matching_docs[0][0]
            clean_title = top_doc['file'].replace(".md", "").replace("_", " ").title()
            return f"### Cardiovascular Guidance on: {clean_title}\n\n{top_doc['text']}\n\n---\n*Grounded in CardioMind clinical research guidelines (AHA/CDC/NHLBI).*"

        # Default helpful guidance
        return (
            f"### CardioAI Clinical Assistant\n\n"
            f"Regarding **\"{query}\"**:\n\n"
            f"In cardiovascular medicine, health outcomes depend on managing modifiable risk factors (blood pressure, LDL cholesterol, blood sugar, and smoking) "
            f"and evaluating diagnostic indicators (resting ECG, exercise stress oldpeak, and thallium scan perfusion).\n\n"
            f"You can ask me for detailed explanations on:\n"
            f"- **Cardiovascular Risk Factors** (hypertension, lipids, diabetes, smoking)\n"
            f"- **Chest pain classification** (angina types 1 through 4)\n"
            f"- **Target blood pressure & cholesterol standards** (AHA/ACC)\n"
            f"- **ECG abnormalities and stress test results** (oldpeak, slope, thalach, thal)\n"
            f"- **CardioMind ML Models** (XGBoost, Platt calibration, and SHAP explainability)\n\n"
            f"How can I assist your heart health inquiry further?"
        )

    async def generate_text_stream(self, query: str, prediction_context: Optional[dict] = None, channel_id: Optional[str] = None, user_id: str = "default_user"):
        """
        Generate a direct text stream (UTF-8 plain text / markdown chunks)
        without JSON packaging, supporting pure stream-of-data handling.
        """
        sources = ["American Heart Association (AHA) Guidelines", "CDC Cardiovascular Health Standards", "Cleveland Clinical Dataset"]

        # Re-check API key in case user added it to .env
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key and not self.chat_session:
            self._init_chat_session()

        # 1. If Gemini session is active, stream live LLM tokens
        if self.chat_session:
            try:
                user_msg = query
                if prediction_context:
                    prob = prediction_context.get("probability", 0.0) * 100
                    cat = prediction_context.get("category", "N/A")
                    user_msg += f"\n[Active Patient Context: Model-Estimated Risk Probability={prob:.1f}%, Output Category={cat}]"

                response = self.chat_session.send_message(user_msg, stream=True)
                full_text = ""
                for chunk in response:
                    text_piece = chunk.text
                    full_text += text_piece
                    yield text_piece
                    await asyncio.sleep(0.01)

                target_channel = channel_id
                if not target_channel:
                    try:
                        target_channel = await chat_db.create_channel(user_id, query[:30].strip() or "New Chat")
                    except Exception as ce:
                        print(f"[CHATBOT] Auto-channel creation error: {ce}")

                if target_channel:
                    try:
                        await chat_db.save_message(target_channel, "user", query)
                        await chat_db.save_message(target_channel, "ai", full_text, sources=sources)
                    except Exception as e:
                        print(f"[CHATBOT] DB save error: {e}")
                return
            except Exception as e:
                print(f"[CHATBOT ERROR] Gemini streaming failed: {e}. Switching to smart clinical engine.")
                self.chat_session = None

        # 2. Smart Clinical QA Engine: Generates tailored, question-specific response
        response_text = self.generate_smart_response(query, prediction_context)

        # Stream with realistic token/word cadence for smooth stream handling
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield chunk
            await asyncio.sleep(0.016)

        # Save to database upon completion
        target_channel = channel_id
        if not target_channel:
            try:
                target_channel = await chat_db.create_channel(user_id, query[:30].strip() or "New Chat")
            except Exception as ce:
                print(f"[CHATBOT] Auto-channel creation error: {ce}")

        if target_channel:
            try:
                await chat_db.save_message(target_channel, "user", query)
                await chat_db.save_message(target_channel, "ai", response_text, sources=sources)
            except Exception as e:
                print(f"[CHATBOT] DB save error: {e}")

    async def generate_response_stream(self, query: str, prediction_context: Optional[dict] = None, channel_id: Optional[str] = None):
        """Legacy SSE generator maintained for backward compatibility."""
        sources = ["AHA Prevention Guidelines", "CDC Cardiovascular Standards", "Cleveland Clinical Dataset"]
        yield {"event": "sources", "data": json.dumps({"sources": sources})}

        async for chunk in self.generate_text_stream(query, prediction_context, channel_id):
            yield {"event": "text", "data": json.dumps(chunk)}

        yield {"event": "done", "data": "done"}
