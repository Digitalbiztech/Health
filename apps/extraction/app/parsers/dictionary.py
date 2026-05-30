"""
Biomarker dictionary.

Canonical definitions for common medical biomarkers — aliases, preferred unit,
unit conversions (callable), reference ranges, and category.

ALIAS_INDEX is a flat alias → canonical_name reverse lookup built at import time.
"""

BIOMARKER_DICTIONARY: dict[str, dict] = {
    # ── DIABETES / METABOLIC ──
    "hba1c": {
        "display_name": "HbA1c",
        "category": "Diabetes",
        "aliases": ["hemoglobin a1c", "hba1c", "a1c", "glycated hemoglobin", "glycosylated hemoglobin", "hb a1c"],
        "preferred_unit": "%",
        "unit_conversions": {"mmol/mol": lambda v: (v * 0.0915) + 2.15},
        "reference": {"min": 4.0, "max": 5.6, "range_str": "4.0 - 5.6 %"},
        "critical": {"low": None, "high": 9.0},
    },
    "fasting_glucose": {
        "display_name": "Fasting Glucose",
        "category": "Diabetes",
        "aliases": ["fasting glucose", "fasting blood sugar", "fbs", "fasting blood glucose", "fbg", "glucose fasting"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 18.0182},
        "reference": {"min": 70, "max": 100, "range_str": "70 - 100 mg/dL"},
        "critical": {"low": 50, "high": 400},
    },
    "random_glucose": {
        "display_name": "Random Glucose",
        "category": "Diabetes",
        "aliases": ["random glucose", "random blood sugar", "rbs", "blood sugar random", "glucose random"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 18.0182},
        "reference": {"min": 70, "max": 140, "range_str": "70 - 140 mg/dL"},
        "critical": {"low": 50, "high": 500},
    },

    # ── LIPID PANEL ──
    "total_cholesterol": {
        "display_name": "Total Cholesterol",
        "category": "Lipid Panel",
        "aliases": ["total cholesterol", "cholesterol total", "cholesterol", "tc", "serum cholesterol"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 38.67},
        "reference": {"min": 0, "max": 200, "range_str": "< 200 mg/dL"},
        "critical": {"low": None, "high": 300},
    },
    "ldl": {
        "display_name": "LDL Cholesterol",
        "category": "Lipid Panel",
        "aliases": ["ldl", "ldl cholesterol", "ldl-c", "low density lipoprotein", "bad cholesterol"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 38.67},
        "reference": {"min": 0, "max": 100, "range_str": "< 100 mg/dL"},
        "critical": {"low": None, "high": 190},
    },
    "hdl": {
        "display_name": "HDL Cholesterol",
        "category": "Lipid Panel",
        "aliases": ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein", "good cholesterol"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 38.67},
        "reference": {"min": 40, "max": 999, "range_str": "> 40 mg/dL"},
        "critical": {"low": 20, "high": None},
    },
    "triglycerides": {
        "display_name": "Triglycerides",
        "category": "Lipid Panel",
        "aliases": ["triglycerides", "tg", "trigs", "triglyceride", "serum triglycerides"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 88.57},
        "reference": {"min": 0, "max": 150, "range_str": "< 150 mg/dL"},
        "critical": {"low": None, "high": 500},
    },

    # ── COMPLETE BLOOD COUNT (CBC) ──
    "hemoglobin": {
        "display_name": "Hemoglobin",
        "category": "CBC",
        "aliases": ["hemoglobin", "hgb", "hb", "haemoglobin"],
        "preferred_unit": "g/dL",
        "unit_conversions": {"g/L": lambda v: v / 10},
        "reference": {"min": 12.0, "max": 17.5, "range_str": "12.0 - 17.5 g/dL"},
        "critical": {"low": 7.0, "high": 20.0},
    },
    "wbc": {
        "display_name": "White Blood Cells",
        "category": "CBC",
        "aliases": ["wbc", "white blood cells", "white blood cell count", "leukocytes", "leukocyte count", "total wbc"],
        "preferred_unit": "x10³/µL",
        "unit_conversions": {"cells/µL": lambda v: v / 1000, "/µL": lambda v: v / 1000},
        "reference": {"min": 4.5, "max": 11.0, "range_str": "4.5 - 11.0 x10³/µL"},
        "critical": {"low": 2.0, "high": 30.0},
    },
    "rbc": {
        "display_name": "Red Blood Cells",
        "category": "CBC",
        "aliases": ["rbc", "red blood cells", "red blood cell count", "erythrocytes", "erythrocyte count"],
        "preferred_unit": "x10⁶/µL",
        "unit_conversions": {},
        "reference": {"min": 4.0, "max": 5.5, "range_str": "4.0 - 5.5 x10⁶/µL"},
        "critical": {"low": 2.5, "high": 7.0},
    },
    "platelets": {
        "display_name": "Platelets",
        "category": "CBC",
        "aliases": ["platelets", "platelet count", "plt", "thrombocytes"],
        "preferred_unit": "x10³/µL",
        "unit_conversions": {},
        "reference": {"min": 150, "max": 400, "range_str": "150 - 400 x10³/µL"},
        "critical": {"low": 50, "high": 1000},
    },
    "hematocrit": {
        "display_name": "Hematocrit",
        "category": "CBC",
        "aliases": ["hematocrit", "hct", "packed cell volume", "pcv"],
        "preferred_unit": "%",
        "unit_conversions": {"L/L": lambda v: v * 100, "ratio": lambda v: v * 100},
        "reference": {"min": 36.0, "max": 50.0, "range_str": "36.0 - 50.0 %"},
        "critical": {"low": 20.0, "high": 60.0},
    },

    # ── LIVER FUNCTION ──
    "alt": {
        "display_name": "ALT (SGPT)",
        "category": "Liver",
        "aliases": ["alt", "sgpt", "alanine aminotransferase", "alanine transaminase", "alt/sgpt"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 7, "max": 56, "range_str": "7 - 56 U/L"},
        "critical": {"low": None, "high": 1000},
    },
    "ast": {
        "display_name": "AST (SGOT)",
        "category": "Liver",
        "aliases": ["ast", "sgot", "aspartate aminotransferase", "aspartate transaminase", "ast/sgot"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 10, "max": 40, "range_str": "10 - 40 U/L"},
        "critical": {"low": None, "high": 1000},
    },
    "bilirubin_total": {
        "display_name": "Total Bilirubin",
        "category": "Liver",
        "aliases": ["bilirubin total", "total bilirubin", "bilirubin", "tbil", "t.bil", "t. bilirubin"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"µmol/L": lambda v: v / 17.1},
        "reference": {"min": 0.1, "max": 1.2, "range_str": "0.1 - 1.2 mg/dL"},
        "critical": {"low": None, "high": 12.0},
    },
    "albumin": {
        "display_name": "Albumin",
        "category": "Liver",
        "aliases": ["albumin", "serum albumin", "alb"],
        "preferred_unit": "g/dL",
        "unit_conversions": {"g/L": lambda v: v / 10},
        "reference": {"min": 3.5, "max": 5.5, "range_str": "3.5 - 5.5 g/dL"},
        "critical": {"low": 1.5, "high": None},
    },
    "alp": {
        "display_name": "Alkaline Phosphatase",
        "category": "Liver",
        "aliases": ["alp", "alkaline phosphatase", "alk phos", "alkp"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 44, "max": 147, "range_str": "44 - 147 U/L"},
        "critical": {"low": None, "high": 1000},
    },

    # ── KIDNEY FUNCTION ──
    "creatinine": {
        "display_name": "Creatinine",
        "category": "Kidney",
        "aliases": ["creatinine", "serum creatinine", "creat", "s. creatinine", "s.creatinine"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"µmol/L": lambda v: v / 88.42},
        "reference": {"min": 0.6, "max": 1.2, "range_str": "0.6 - 1.2 mg/dL"},
        "critical": {"low": None, "high": 10.0},
    },
    "bun": {
        "display_name": "Blood Urea Nitrogen",
        "category": "Kidney",
        "aliases": ["bun", "blood urea nitrogen", "urea nitrogen", "urea"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 2.8},
        "reference": {"min": 7, "max": 20, "range_str": "7 - 20 mg/dL"},
        "critical": {"low": None, "high": 100},
    },
    "egfr": {
        "display_name": "eGFR",
        "category": "Kidney",
        "aliases": ["egfr", "estimated gfr", "glomerular filtration rate", "estimated glomerular filtration rate", "gfr"],
        "preferred_unit": "mL/min/1.73m²",
        "unit_conversions": {},
        "reference": {"min": 90, "max": 999, "range_str": "> 90 mL/min/1.73m²"},
        "critical": {"low": 15, "high": None},
    },
    "uric_acid": {
        "display_name": "Uric Acid",
        "category": "Kidney",
        "aliases": ["uric acid", "serum uric acid", "urate"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"µmol/L": lambda v: v / 59.48},
        "reference": {"min": 3.0, "max": 7.0, "range_str": "3.0 - 7.0 mg/dL"},
        "critical": {"low": None, "high": 12.0},
    },

    # ── THYROID ──
    "tsh": {
        "display_name": "TSH",
        "category": "Thyroid",
        "aliases": ["tsh", "thyroid stimulating hormone", "thyrotropin"],
        "preferred_unit": "mIU/L",
        "unit_conversions": {"µIU/mL": lambda v: v},
        "reference": {"min": 0.4, "max": 4.0, "range_str": "0.4 - 4.0 mIU/L"},
        "critical": {"low": 0.01, "high": 50.0},
    },
    "t3": {
        "display_name": "T3 (Triiodothyronine)",
        "category": "Thyroid",
        "aliases": ["t3", "triiodothyronine", "total t3", "serum t3"],
        "preferred_unit": "ng/dL",
        "unit_conversions": {"nmol/L": lambda v: v / 0.01536},
        "reference": {"min": 80, "max": 200, "range_str": "80 - 200 ng/dL"},
        "critical": {"low": 40, "high": 400},
    },
    "t4": {
        "display_name": "T4 (Thyroxine)",
        "category": "Thyroid",
        "aliases": ["t4", "thyroxine", "total t4", "serum t4"],
        "preferred_unit": "µg/dL",
        "unit_conversions": {"nmol/L": lambda v: v / 12.87},
        "reference": {"min": 5.0, "max": 12.0, "range_str": "5.0 - 12.0 µg/dL"},
        "critical": {"low": 2.0, "high": 20.0},
    },
    "free_t4": {
        "display_name": "Free T4",
        "category": "Thyroid",
        "aliases": ["free t4", "ft4", "free thyroxine"],
        "preferred_unit": "ng/dL",
        "unit_conversions": {"pmol/L": lambda v: v / 12.87},
        "reference": {"min": 0.8, "max": 1.8, "range_str": "0.8 - 1.8 ng/dL"},
        "critical": {"low": 0.4, "high": 5.0},
    },

    # ── ELECTROLYTES ──
    "sodium": {
        "display_name": "Sodium",
        "category": "Electrolytes",
        "aliases": ["sodium", "na", "na+", "serum sodium"],
        "preferred_unit": "mEq/L",
        "unit_conversions": {"mmol/L": lambda v: v},
        "reference": {"min": 136, "max": 145, "range_str": "136 - 145 mEq/L"},
        "critical": {"low": 120, "high": 160},
    },
    "potassium": {
        "display_name": "Potassium",
        "category": "Electrolytes",
        "aliases": ["potassium", "k", "k+", "serum potassium"],
        "preferred_unit": "mEq/L",
        "unit_conversions": {"mmol/L": lambda v: v},
        "reference": {"min": 3.5, "max": 5.0, "range_str": "3.5 - 5.0 mEq/L"},
        "critical": {"low": 2.5, "high": 6.5},
    },
    "calcium": {
        "display_name": "Calcium",
        "category": "Electrolytes",
        "aliases": ["calcium", "ca", "ca2+", "serum calcium", "total calcium"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 4.0},
        "reference": {"min": 8.5, "max": 10.5, "range_str": "8.5 - 10.5 mg/dL"},
        "critical": {"low": 6.0, "high": 14.0},
    },

    # ── IRON STUDIES ──
    "iron": {
        "display_name": "Iron",
        "category": "Iron Studies",
        "aliases": ["iron", "serum iron", "fe", "iron level"],
        "preferred_unit": "µg/dL",
        "unit_conversions": {"µmol/L": lambda v: v * 5.585},
        "reference": {"min": 60, "max": 170, "range_str": "60 - 170 µg/dL"},
        "critical": {"low": 30, "high": 300},
    },
    "ferritin": {
        "display_name": "Ferritin",
        "category": "Iron Studies",
        "aliases": ["ferritin", "serum ferritin"],
        "preferred_unit": "ng/mL",
        "unit_conversions": {"µg/L": lambda v: v, "pmol/L": lambda v: v * 0.4484},
        "reference": {"min": 20, "max": 250, "range_str": "20 - 250 ng/mL"},
        "critical": {"low": 10, "high": 1000},
    },

    # ── VITAMINS ──
    "vitamin_d": {
        "display_name": "Vitamin D (25-OH)",
        "category": "Vitamins",
        "aliases": ["vitamin d", "25-oh vitamin d", "25-hydroxyvitamin d", "vit d", "25 oh d", "calcidiol", "vitamin d3"],
        "preferred_unit": "ng/mL",
        "unit_conversions": {"nmol/L": lambda v: v / 2.496},
        "reference": {"min": 30, "max": 100, "range_str": "30 - 100 ng/mL"},
        "critical": {"low": 10, "high": 150},
    },
    "vitamin_b12": {
        "display_name": "Vitamin B12",
        "category": "Vitamins",
        "aliases": ["vitamin b12", "b12", "cobalamin", "vit b12", "cyanocobalamin"],
        "preferred_unit": "pg/mL",
        "unit_conversions": {"pmol/L": lambda v: v * 1.355},
        "reference": {"min": 200, "max": 900, "range_str": "200 - 900 pg/mL"},
        "critical": {"low": 150, "high": None},
    },

    # ── INFLAMMATION ──
    "crp": {
        "display_name": "C-Reactive Protein",
        "category": "Inflammation",
        "aliases": ["crp", "c-reactive protein", "c reactive protein", "hs-crp", "high sensitivity crp"],
        "preferred_unit": "mg/L",
        "unit_conversions": {"mg/dL": lambda v: v * 10},
        "reference": {"min": 0, "max": 3.0, "range_str": "< 3.0 mg/L"},
        "critical": {"low": None, "high": 100},
    },
    "esr": {
        "display_name": "ESR",
        "category": "Inflammation",
        "aliases": ["esr", "erythrocyte sedimentation rate", "sed rate"],
        "preferred_unit": "mm/hr",
        "unit_conversions": {},
        "reference": {"min": 0, "max": 20, "range_str": "0 - 20 mm/hr"},
        "critical": {"low": None, "high": 100},
    },

    # ── PANCREATIC ──
    "amylase": {
        "display_name": "Amylase",
        "category": "Pancreatic",
        "aliases": ["amylase", "serum amylase", "s. amylase"],
        "abbreviations": [],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 28, "max": 100, "range_str": "28 - 100 U/L"},
        "critical": {"low": None, "high": 500},
    },
    "lipase": {
        "display_name": "Lipase",
        "category": "Pancreatic",
        "aliases": ["lipase", "serum lipase"],
        "abbreviations": [],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 0, "max": 60, "range_str": "0 - 60 U/L"},
        "critical": {"low": None, "high": 300},
    },

    # ── CBC EXTENDED ──
    "mcv": {
        "display_name": "MCV",
        "category": "CBC",
        "aliases": ["mcv", "mean corpuscular volume", "mean cell volume"],
        "abbreviations": ["MCV"],
        "preferred_unit": "fL",
        "unit_conversions": {},
        "reference": {"min": 80, "max": 100, "range_str": "80 - 100 fL"},
        "critical": {"low": 60, "high": 120},
    },
    "mch": {
        "display_name": "MCH",
        "category": "CBC",
        "aliases": ["mch", "mean corpuscular hemoglobin", "mean cell hemoglobin"],
        "abbreviations": ["MCH"],
        "preferred_unit": "pg",
        "unit_conversions": {},
        "reference": {"min": 27, "max": 33, "range_str": "27 - 33 pg"},
        "critical": {"low": 20, "high": 40},
    },
    "mchc": {
        "display_name": "MCHC",
        "category": "CBC",
        "aliases": ["mchc", "mean corpuscular hemoglobin concentration"],
        "abbreviations": ["MCHC"],
        "preferred_unit": "g/dL",
        "unit_conversions": {},
        "reference": {"min": 32, "max": 36, "range_str": "32 - 36 g/dL"},
        "critical": {"low": 28, "high": 40},
    },
    "rdw": {
        "display_name": "RDW",
        "category": "CBC",
        "aliases": ["rdw", "red cell distribution width", "rdw-cv"],
        "abbreviations": ["RDW"],
        "preferred_unit": "%",
        "unit_conversions": {},
        "reference": {"min": 11.5, "max": 14.5, "range_str": "11.5 - 14.5 %"},
        "critical": {"low": None, "high": 20.0},
    },
    "mpv": {
        "display_name": "MPV",
        "category": "CBC",
        "aliases": ["mpv", "mean platelet volume"],
        "abbreviations": ["MPV"],
        "preferred_unit": "fL",
        "unit_conversions": {},
        "reference": {"min": 7.5, "max": 11.5, "range_str": "7.5 - 11.5 fL"},
        "critical": {"low": None, "high": None},
    },

    # ── LIVER EXTENDED ──
    "ggt": {
        "display_name": "GGT",
        "category": "Liver",
        "aliases": ["ggt", "gamma-glutamyl transferase", "gamma glutamyl transpeptidase", "ggtp"],
        "abbreviations": ["GGT", "GGTP"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 0, "max": 61, "range_str": "0 - 61 U/L"},
        "critical": {"low": None, "high": 500},
    },
    "ldh": {
        "display_name": "LDH",
        "category": "Liver",
        "aliases": ["ldh", "lactate dehydrogenase", "lactic dehydrogenase"],
        "abbreviations": ["LDH"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 140, "max": 280, "range_str": "140 - 280 U/L"},
        "critical": {"low": None, "high": 1000},
    },
    "total_protein": {
        "display_name": "Total Protein",
        "category": "Liver",
        "aliases": ["total protein", "serum total protein", "tp", "s. protein"],
        "abbreviations": ["TP"],
        "preferred_unit": "g/dL",
        "unit_conversions": {"g/L": lambda v: v / 10},
        "reference": {"min": 6.0, "max": 8.3, "range_str": "6.0 - 8.3 g/dL"},
        "critical": {"low": 4.0, "high": 10.0},
    },
    "globulin": {
        "display_name": "Globulin",
        "category": "Liver",
        "aliases": ["globulin", "serum globulin"],
        "abbreviations": [],
        "preferred_unit": "g/dL",
        "unit_conversions": {"g/L": lambda v: v / 10},
        "reference": {"min": 2.0, "max": 3.5, "range_str": "2.0 - 3.5 g/dL"},
        "critical": {"low": 1.0, "high": 5.0},
    },
    "ag_ratio": {
        "display_name": "A/G Ratio",
        "category": "Liver",
        "aliases": ["a/g ratio", "albumin globulin ratio", "ag ratio", "a:g ratio"],
        "abbreviations": ["A/G"],
        "preferred_unit": "ratio",
        "unit_conversions": {},
        "reference": {"min": 1.1, "max": 2.5, "range_str": "1.1 - 2.5"},
        "critical": {"low": 0.5, "high": None},
    },
    "direct_bilirubin": {
        "display_name": "Direct Bilirubin",
        "category": "Liver",
        "aliases": ["direct bilirubin", "conjugated bilirubin", "dbil", "d.bil", "d. bilirubin"],
        "abbreviations": ["DBIL"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"µmol/L": lambda v: v / 17.1},
        "reference": {"min": 0.0, "max": 0.3, "range_str": "0.0 - 0.3 mg/dL"},
        "critical": {"low": None, "high": 5.0},
    },

    # ── ELECTROLYTES EXTENDED ──
    "chloride": {
        "display_name": "Chloride",
        "category": "Electrolytes",
        "aliases": ["chloride", "cl", "cl-", "serum chloride"],
        "abbreviations": ["Cl"],
        "preferred_unit": "mEq/L",
        "unit_conversions": {"mmol/L": lambda v: v},
        "reference": {"min": 96, "max": 106, "range_str": "96 - 106 mEq/L"},
        "critical": {"low": 80, "high": 120},
    },
    "magnesium": {
        "display_name": "Magnesium",
        "category": "Electrolytes",
        "aliases": ["magnesium", "mg", "mg2+", "serum magnesium"],
        "abbreviations": ["Mg"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 2.43},
        "reference": {"min": 1.7, "max": 2.2, "range_str": "1.7 - 2.2 mg/dL"},
        "critical": {"low": 1.0, "high": 4.0},
    },
    "phosphorus": {
        "display_name": "Phosphorus",
        "category": "Electrolytes",
        "aliases": ["phosphorus", "phosphate", "serum phosphorus", "inorganic phosphate"],
        "abbreviations": [],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 3.1},
        "reference": {"min": 2.5, "max": 4.5, "range_str": "2.5 - 4.5 mg/dL"},
        "critical": {"low": 1.0, "high": 8.0},
    },

    # ── VITAMINS EXTENDED ──
    "folate": {
        "display_name": "Folate",
        "category": "Vitamins",
        "aliases": ["folate", "folic acid", "serum folate", "vitamin b9", "vit b9"],
        "abbreviations": [],
        "preferred_unit": "ng/mL",
        "unit_conversions": {"nmol/L": lambda v: v / 2.266},
        "reference": {"min": 3.0, "max": 20.0, "range_str": "3.0 - 20.0 ng/mL"},
        "critical": {"low": 2.0, "high": None},
    },

    # ── METABOLIC EXTENDED ──
    "insulin_fasting": {
        "display_name": "Fasting Insulin",
        "category": "Diabetes",
        "aliases": ["fasting insulin", "insulin fasting", "serum insulin", "insulin"],
        "abbreviations": [],
        "preferred_unit": "µIU/mL",
        "unit_conversions": {"pmol/L": lambda v: v / 6.945},
        "reference": {"min": 2.6, "max": 24.9, "range_str": "2.6 - 24.9 µIU/mL"},
        "critical": {"low": None, "high": 100},
    },

    # ── CARDIAC ──
    "ck": {
        "display_name": "Creatine Kinase",
        "category": "Cardiac",
        "aliases": ["ck", "cpk", "creatine kinase", "creatine phosphokinase"],
        "abbreviations": ["CK", "CPK"],
        "preferred_unit": "U/L",
        "unit_conversions": {},
        "reference": {"min": 22, "max": 198, "range_str": "22 - 198 U/L"},
        "critical": {"low": None, "high": 1000},
    },

    # ── LIPID EXTENDED ──
    "vldl": {
        "display_name": "VLDL Cholesterol",
        "category": "Lipid Panel",
        "aliases": ["vldl", "vldl cholesterol", "vldl-c", "very low density lipoprotein"],
        "abbreviations": ["VLDL"],
        "preferred_unit": "mg/dL",
        "unit_conversions": {"mmol/L": lambda v: v * 38.67},
        "reference": {"min": 2, "max": 30, "range_str": "2 - 30 mg/dL"},
        "critical": {"low": None, "high": 50},
    },

    # ── THYROID EXTENDED ──
    "free_t3": {
        "display_name": "Free T3",
        "category": "Thyroid",
        "aliases": ["free t3", "ft3", "free triiodothyronine"],
        "abbreviations": ["FT3"],
        "preferred_unit": "pg/mL",
        "unit_conversions": {"pmol/L": lambda v: v * 0.651},
        "reference": {"min": 2.0, "max": 4.4, "range_str": "2.0 - 4.4 pg/mL"},
        "critical": {"low": 1.0, "high": 10.0},
    },

    # ── KIDNEY EXTENDED ──
    "bun_creatinine_ratio": {
        "display_name": "BUN/Creatinine Ratio",
        "category": "Kidney",
        "aliases": ["bun/creatinine ratio", "bun creatinine ratio", "b/c ratio"],
        "abbreviations": ["BUN/Cr"],
        "preferred_unit": "ratio",
        "unit_conversions": {},
        "reference": {"min": 10, "max": 20, "range_str": "10 - 20"},
        "critical": {"low": None, "high": 40},
    },
}


# ── Index builders ────────────────────────────────────────────


def build_alias_index() -> dict[str, str]:
    """Build a flat alias → canonical_name lookup."""
    index: dict[str, str] = {}
    for canonical, entry in BIOMARKER_DICTIONARY.items():
        index[canonical] = canonical
        for alias in entry["aliases"]:
            index[alias.lower().strip()] = canonical
    return index


def build_abbreviation_index() -> dict[str, str]:
    """Build an uppercase abbreviation → canonical_name lookup."""
    index: dict[str, str] = {}
    for canonical, entry in BIOMARKER_DICTIONARY.items():
        for abbr in entry.get("abbreviations", []):
            index[abbr.upper().strip()] = canonical
    return index


def build_alias_candidates() -> dict[str, list[str]]:
    """Build canonical_name → [aliases] map for fuzzy matching."""
    return {
        canonical: entry["aliases"]
        for canonical, entry in BIOMARKER_DICTIONARY.items()
    }


ALIAS_INDEX = build_alias_index()
ABBREVIATION_INDEX = build_abbreviation_index()
ALIAS_CANDIDATES = build_alias_candidates()

