import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, CheckCircle2, Info, ExternalLink, ShieldAlert } from 'lucide-react';
import type { Biomarker } from '@/types/dashboard';
import { STATUS_COLORS, CATEGORY_ICONS } from './constants';
import { getEffectivePct } from './utils';

interface DetailDialogProps {
  biomarker: Biomarker;
  onClose: () => void;
}

interface BiomarkerDescription {
  what: string;
  why: string;
  understand: string;
  tips: string[];
  learnMore: { label: string; url: string }[];
}

// Rich clinical descriptions keyed by canonical name
const BIOMARKER_DESCRIPTIONS: Record<string, BiomarkerDescription> = {
  GLUCOSE: {
    what: 'Glucose is the primary sugar circulating in blood plasma. It is your body\'s main fuel source, derived from dietary carbohydrates and regulated by insulin.',
    why: 'Fasting glucose levels indicate metabolic health. Elevated levels are markers for impaired glucose tolerance or early insulin resistance, while low levels can lead to hypoglycemic symptoms.',
    understand: 'Fasting levels between 70-99 mg/dL are optimal. Borderline values (100-125 mg/dL) suggest prediabetes, and 126 mg/dL or higher on multiple checks may indicate diabetes.',
    tips: [
      'Limit refined sugars and processed carbohydrates',
      'Incorporate daily moderate cardiovascular exercise',
      'Prioritize fiber-rich whole foods like vegetables and legumes'
    ],
    learnMore: [
      { label: 'ADA: Understanding Blood Glucose', url: 'https://diabetes.org' },
      { label: 'Mayo Clinic: Blood Glucose Test', url: 'https://www.mayoclinic.org' }
    ]
  },
  CHOLESTEROL_TOTAL: {
    what: 'Total cholesterol measures the cumulative amount of cholesterol in your blood, including LDL ("bad"), HDL ("good"), and VLDL fractions.',
    why: 'It provides an overall snapshot of lipid volume. Elevated levels can contribute to atherosclerosis (hardening of the arteries), increasing cardiovascular disease risk.',
    understand: 'An optimal total cholesterol level is typically under 200 mg/dL. Levels from 200-239 mg/dL are borderline high, and 240 mg/dL or above are considered high.',
    tips: [
      'Focus on healthy unsaturated fats from olive oil and avocados',
      'Increase soluble fiber intake from oats and beans',
      'Participate in regular physical activity to improve lipid profiles'
    ],
    learnMore: [
      { label: 'AHA: Cholesterol Basics', url: 'https://www.heart.org' },
      { label: 'NIH: What is Cholesterol?', url: 'https://www.nhlbi.nih.gov' }
    ]
  },
  TOTAL_CHOLESTEROL: {
    what: 'Total cholesterol measures the cumulative amount of cholesterol in your blood, including LDL ("bad"), HDL ("good"), and VLDL fractions.',
    why: 'It provides an overall snapshot of lipid volume. Elevated levels can contribute to atherosclerosis (hardening of the arteries), increasing cardiovascular disease risk.',
    understand: 'An optimal total cholesterol level is typically under 200 mg/dL. Levels from 200-239 mg/dL are borderline high, and 240 mg/dL or above are considered high.',
    tips: [
      'Focus on healthy unsaturated fats from olive oil and avocados',
      'Increase soluble fiber intake from oats and beans',
      'Participate in regular physical activity to improve lipid profiles'
    ],
    learnMore: [
      { label: 'AHA: Cholesterol Basics', url: 'https://www.heart.org' },
      { label: 'NIH: What is Cholesterol?', url: 'https://www.nhlbi.nih.gov' }
    ]
  },
  LDL: {
    what: 'Low-Density Lipoprotein (LDL) is often called "bad" cholesterol because it carries cholesterol to your tissues and can accumulate in arterial walls.',
    why: 'High LDL levels contribute to plaque buildup (atherosclerosis), narrow your arteries, and elevate the risk of heart attacks and strokes.',
    understand: 'Optimal LDL is generally under 100 mg/dL (or under 70 mg/dL for individuals with high cardiovascular risk). Borderline is 130-159 mg/dL, and high is 160+ mg/dL.',
    tips: [
      'Avoid trans-fats and limit saturated fats from animal products',
      'Discuss with your physician if you have a family history of high lipids',
      'Ensure daily moderate exercise of 30+ minutes'
    ],
    learnMore: [
      { label: 'CDC: LDL & HDL Cholesterol', url: 'https://www.cdc.gov/cholesterol' },
      { label: 'MedlinePlus: LDL Cholesterol', url: 'https://medlineplus.gov' }
    ]
  },
  HDL: {
    what: 'High-Density Lipoprotein (HDL) is known as "good" cholesterol because it scavenges excess cholesterol from the bloodstream and brings it to the liver for disposal.',
    why: 'Higher HDL levels are associated with a lower risk of heart disease. Low levels leave arteries more vulnerable to plaque buildup.',
    understand: 'An optimal level is 60 mg/dL or higher. Levels below 40 mg/dL for men and 50 mg/dL for women increase cardiovascular risk.',
    tips: [
      'Add heart-healthy fats like salmon, nuts, and olive oil to your diet',
      'Quit smoking, as tobacco use directly lowers HDL levels',
      'Engage in regular aerobic and strength-training workouts'
    ],
    learnMore: [
      { label: 'Mayo Clinic: Raise Your HDL', url: 'https://www.mayoclinic.org' },
      { label: 'Cleveland Clinic: HDL Cholesterol', url: 'https://my.clevelandclinic.org' }
    ]
  },
  TRIGLYCERIDES: {
    what: 'Triglycerides are the most common type of fat in your body, storing excess calories from your diet to be used for energy between meals.',
    why: 'High triglycerides are a risk factor for heart disease and stroke, and extremely high levels (>500 mg/dL) can cause acute inflammation of the pancreas.',
    understand: 'A normal triglyceride level is under 150 mg/dL. Borderline high is 150-199 mg/dL, high is 200-499 mg/dL, and very high is 500+ mg/dL.',
    tips: [
      'Minimize alcohol intake, as it significantly raises triglycerides',
      'Reduce simple sugar and refined starch consumption',
      'Increase intake of omega-3 fatty acids from fish or supplements'
    ],
    learnMore: [
      { label: 'Cleveland Clinic: Triglycerides Overview', url: 'https://my.clevelandclinic.org' },
      { label: 'AHA: Triglycerides', url: 'https://www.heart.org' }
    ]
  },
  HEMOGLOBIN: {
    what: 'Hemoglobin is the iron-rich protein in red blood cells that binds oxygen in the lungs and carries it to the rest of the body.',
    why: 'Low hemoglobin indicates anemia, leading to fatigue and tissue oxygen deprivation. High hemoglobin can indicate dehydration or overproduction of red blood cells.',
    understand: 'Normal ranges vary by sex: typically 13.8-17.2 g/dL for men and 12.1-15.1 g/dL for women. Values below these indicate anemia.',
    tips: [
      'Consume iron-rich foods like spinach, lentils, and lean red meats',
      'Pair iron intake with Vitamin C to enhance absorption',
      'Ensure adequate daily hydration'
    ],
    learnMore: [
      { label: 'NIH: What is Anemia?', url: 'https://www.nhlbi.nih.gov' },
      { label: 'Mayo Clinic: Low Hemoglobin', url: 'https://www.mayoclinic.org' }
    ]
  },
  WBC: {
    what: 'White Blood Cells (WBCs), or leukocytes, are key components of the body\'s immune system, defending against infections and cellular damage.',
    why: 'Elevated WBC counts often signify an active infection, inflammation, or physical stress. Low counts can leave the body more vulnerable to pathogens.',
    understand: 'The typical reference range is 4.5-11.0 x10^3/uL. Mild elevations are common during minor viral or bacterial infections.',
    tips: [
      'Support immune function with balanced nutrition and adequate sleep',
      'Practice proper hand hygiene to avoid preventable infections',
      'Monitor trends to ensure levels return to normal post-recovery'
    ],
    learnMore: [
      { label: 'MedlinePlus: WBC Count', url: 'https://medlineplus.gov' },
      { label: 'Cleveland Clinic: WBCs', url: 'https://my.clevelandclinic.org' }
    ]
  },
  PLATELETS: {
    what: 'Platelets, or thrombocytes, are small blood cells responsible for forming clots to stop bleeding when blood vessels are damaged.',
    why: 'Low platelets (thrombocytopenia) increase risk of bruising and bleeding. High platelets (thrombocytosis) can lead to abnormal blood clotting.',
    understand: 'The normal range is 150-450 x10^3/uL. Temporary drops can happen during viral illnesses, while chronic alterations require hematological follow-up.',
    tips: [
      'Avoid excessive alcohol consumption, which can depress platelet production',
      'Discuss bruising or abnormal bleeding tendencies with your doctor',
      'Protect yourself from injury if platelet levels are significantly low'
    ],
    learnMore: [
      { label: 'NIH: Platelets Overview', url: 'https://www.nhlbi.nih.gov' },
      { label: 'Johns Hopkins: Thrombocytopenia', url: 'https://www.hopkinsmedicine.org' }
    ]
  },
  RBC: {
    what: 'Red Blood Cells (RBCs) are the cells that transport oxygen throughout your body using hemoglobin.',
    why: 'RBC count helps evaluate oxygen transport capacity. Anomalies can signal anemia, hydration status, bone marrow disorders, or chronic diseases.',
    understand: 'Typical ranges are 4.3-5.9 x10^6/uL for men and 3.5-5.5 x10^6/uL for women. Higher levels are sometimes seen in smokers or at high altitudes.',
    tips: [
      'Eat a diet rich in iron, B12, and folate to support RBC production',
      'Ensure adequate daily hydration',
      'Avoid smoking to optimize oxygen transport efficiency'
    ],
    learnMore: [
      { label: 'Cleveland Clinic: Red Blood Cells', url: 'https://my.clevelandclinic.org' },
      { label: 'MedlinePlus: RBC Count', url: 'https://medlineplus.gov' }
    ]
  },
  HEMATOCRIT: {
    what: 'Hematocrit measures the percentage of your total blood volume that is made up of red blood cells.',
    why: 'It is an index of blood thickness and oxygen capacity. Abnormally low hematocrit is seen in anemia, while high levels can indicate severe dehydration.',
    understand: 'Typical ranges are 38.3%-48.6% for men and 35.5%-44.9% for women. Dehydration is a very common cause of high hematocrit.',
    tips: [
      'Drink plenty of water throughout the day, especially during exercise',
      'Follow dietary guidelines for maintaining healthy iron levels',
      'Repeat testing if dehydration is suspected during the initial draw'
    ],
    learnMore: [
      { label: 'Mayo Clinic: Hematocrit Test', url: 'https://www.mayoclinic.org' },
      { label: 'Healthline: Hematocrit Levels', url: 'https://www.healthline.com' }
    ]
  },
  MCV: {
    what: 'Mean Corpuscular Volume (MCV) measures the average size of your red blood cells.',
    why: 'It helps classify types of anemia. Low MCV means cells are microcytic (small, often from iron deficiency), while high MCV means cells are macrocytic (large, often from B12 or folate deficiency).',
    understand: 'A normal MCV is typically between 80-100 fL. MCV is interpreted alongside total red blood cells and hemoglobin.',
    tips: [
      'Ensure sufficient intake of Vitamin B12 and Folate',
      'Consult your physician to determine if iron supplementation is appropriate',
      'Limit alcohol consumption, which can elevate MCV levels'
    ],
    learnMore: [
      { label: 'Testing.com: MCV Test Info', url: 'https://www.testing.com' },
      { label: 'WebMD: MCV Test', url: 'https://www.webmd.com' }
    ]
  },
  MCH: {
    what: 'Mean Corpuscular Hemoglobin (MCH) is the average amount of hemoglobin inside a single red blood cell.',
    why: 'MCH tracking assists in diagnosing the cause of anemia, closely mirroring MCV results since larger cells tend to contain more hemoglobin.',
    understand: 'The normal range is typically 27-33 pg. Low levels mean cells are hypochromic (pale), a classic sign of iron deficiency.',
    tips: [
      'Incorporate iron-rich whole foods into your daily meals',
      'Ensure adequate intake of B vitamins',
      'Track along with MCV to understand red blood cell health trends'
    ],
    learnMore: [
      { label: 'Healthline: MCH Levels', url: 'https://www.healthline.com' },
      { label: 'MedlinePlus: MCH Test', url: 'https://medlineplus.gov' }
    ]
  },
  MCHC: {
    what: 'Mean Corpuscular Hemoglobin Concentration (MCHC) measures the average concentration of hemoglobin inside a group of red blood cells.',
    why: 'It helps evaluate how packed red blood cells are with hemoglobin. Changes in MCHC point to specific types of iron disorders or hemolytic anemias.',
    understand: 'The normal range is 32-36 g/dL. Low MCHC indicates hypochromic red cells, commonly caused by iron deficiency anemia.',
    tips: [
      'Eat a nutrient-dense diet containing iron and Vitamin C',
      'Discuss persistent fatigue or paleness with your practitioner',
      'Ensure follow-up lab panels check for underlying iron storage (ferritin)'
    ],
    learnMore: [
      { label: 'WebMD: MCHC Test', url: 'https://www.webmd.com' },
      { label: 'Healthline: MCHC Levels', url: 'https://www.healthline.com' }
    ]
  },
  RDW: {
    what: 'Red Cell Distribution Width (RDW) measures the variation in size of your red blood cells.',
    why: 'A high RDW indicates anisocytosis (a wide range of cell sizes), which is often the earliest sign of nutritional deficiencies like iron, B12, or folate deficiency.',
    understand: 'The optimal range is typically 11.0%-15.0%. Elevated RDW with normal MCV can suggest early mixed nutritional deficiencies.',
    tips: [
      'Focus on nutritional variety, highlighting leafy greens, nuts, and clean proteins',
      'Track RDW alongside MCV and Hemoglobin for a complete picture',
      'Address any chronic inflammatory conditions with your doctor'
    ],
    learnMore: [
      { label: 'Lab Tests Online: RDW', url: 'https://labtestsonline.org' },
      { label: 'Testing.com: RDW Test', url: 'https://www.testing.com' }
    ]
  },
  NEUTROPHILS: {
    what: 'Neutrophils are the most abundant type of white blood cell, acting as the body\'s first responders to acute bacterial infections.',
    why: 'High neutrophil counts indicate active bacterial infection, physical trauma, or inflammation. Low levels (neutropenia) leave the body vulnerable to infections.',
    understand: 'Neutrophils normally make up 40%-70% of total white blood cells. Mild fluctuations during sickness are expected.',
    tips: [
      'Follow general infection-prevention measures (hand washing, food safety)',
      'Get restorative sleep to support natural immune cycles',
      'Notify your doctor if you experience fever while neutrophils are low'
    ],
    learnMore: [
      { label: 'Cleveland Clinic: Neutrophils', url: 'https://my.clevelandclinic.org' },
      { label: 'Mayo Clinic: Neutropenia', url: 'https://www.mayoclinic.org' }
    ]
  },
  LYMPHOCYTES: {
    what: 'Lymphocytes are white blood cells that specialize in adaptive immunity, fighting off viral infections and producing antibodies.',
    why: 'High levels suggest viral infections (like mononucleosis or flu) or chronic infection. Low levels can be caused by physical stress or immune system depletion.',
    understand: 'Lymphocytes typically make up 20%-45% of total white blood cells. Persistent variations should be evaluated by a healthcare professional.',
    tips: [
      'Manage chronic stress, which can suppress lymphocyte activity',
      'Support immune function through a antioxidant-rich diet',
      'Keep immunizations up to date to aid antibody production'
    ],
    learnMore: [
      { label: 'MedlinePlus: Lymphocytes Info', url: 'https://medlineplus.gov' },
      { label: 'WebMD: Lymphocytes', url: 'https://www.webmd.com' }
    ]
  },
  MONOCYTES: {
    what: 'Monocytes are large white blood cells that migrate into tissues to clean up dead cells and combat chronic bacterial and fungal infections.',
    why: 'Slight elevations are common during recovery from acute infections, while significant increases can point to chronic inflammatory diseases.',
    understand: 'Monocytes typically represent 2%-10% of total white blood cells. Mild elevations are generally benign and transient.',
    tips: [
      'Incorporate anti-inflammatory foods (berries, fatty fish, ginger)',
      'Maintain consistent hydration to assist lymphatic drainage',
      'Allow adequate recovery time after physical illness or injury'
    ],
    learnMore: [
      { label: 'Healthline: Monocytes', url: 'https://www.healthline.com' },
      { label: 'Cleveland Clinic: Monocytes', url: 'https://my.clevelandclinic.org' }
    ]
  },
  EOSINOPHILS: {
    what: 'Eosinophils are white blood cells that target parasitic infections and play a major role in allergic reactions and asthma.',
    why: 'Elevated eosinophils (eosinophilia) are most commonly caused by seasonal allergies, asthma, drug reactions, or eczema.',
    understand: 'Eosinophils typically make up 0%-6% of total white blood cells. Levels are highly responsive to allergen exposure.',
    tips: [
      'Identify and minimize exposure to known environmental allergens',
      'Work with your doctor to manage chronic allergic conditions or asthma',
      'Ensure testing is repeated when allergy symptoms are well-controlled'
    ],
    learnMore: [
      { label: 'Mayo Clinic: Eosinophilia', url: 'https://www.mayoclinic.org' },
      { label: 'AADA: Eosinophils', url: 'https://www.aad.org' }
    ]
  },
  BASOPHILS: {
    what: 'Basophils are the least common type of white blood cell, releasing histamines during allergic responses and inflammatory reactions.',
    why: 'They participate in allergic symptoms like hives and runny noses. Abnormal elevations can occasionally point to chronic inflammatory states.',
    understand: 'Basophils normally represent 0%-2% of total white blood cells. A value of zero is considered normal.',
    tips: [
      'Monitor allergic response triggers and manage histaminic inflammation',
      'Focus on a diet rich in vitamin-C and antioxidants',
      'Follow up if values are persistently elevated without an obvious allergy'
    ],
    learnMore: [
      { label: 'Cleveland Clinic: Basophils', url: 'https://my.clevelandclinic.org' },
      { label: 'Healthline: Basophils Count', url: 'https://www.healthline.com' }
    ]
  },
  ALBUMIN: {
    what: 'Albumin is the most abundant protein produced by the liver, essential for keeping fluid from leaking out of blood vessels and carrying hormones.',
    why: 'Low albumin can indicate malnutrition, liver disease, kidney stress (filtering out too much protein), or systemic inflammation.',
    understand: 'The typical normal range is 3.5-5.5 g/dL. Mild decreases can happen during acute inflammatory illnesses.',
    tips: [
      'Maintain adequate dietary protein intake from clean sources',
      'Limit alcohol to protect liver synthetic function',
      'Ensure regular hydration to avoid artificial elevations due to dehydration'
    ],
    learnMore: [
      { label: 'MedlinePlus: Albumin Blood Test', url: 'https://medlineplus.gov' },
      { label: 'Mayo Clinic: Liver Function', url: 'https://www.mayoclinic.org' }
    ]
  },
  TOTAL_PROTEIN: {
    what: 'Total Protein measures the combined amount of two major protein classes in the blood: albumin and globulin.',
    why: 'It helps screen for liver and kidney disorders, nutritional deficiencies, or immune system overactivity (which elevates globulins).',
    understand: 'A normal total protein range is typically 6.0-8.5 g/dL. The ratio of albumin to globulin (A/G ratio) provides additional diagnostic clues.',
    tips: [
      'Eat a balanced diet with high-quality proteins',
      'Maintain general liver and kidney health through active living',
      'Follow up with fractionated tests (albumin vs. globulin) if total protein is abnormal'
    ],
    learnMore: [
      { label: 'Mayo Clinic: Total Protein Test', url: 'https://www.mayoclinic.org' },
      { label: 'Cleveland Clinic: Proteins', url: 'https://my.clevelandclinic.org' }
    ]
  },
  TOTAL_BILIRUBIN: {
    what: 'Bilirubin is a yellow pigment formed during the normal breakdown of old red blood cells. The liver filters it from the blood.',
    why: 'Elevated bilirubin causes jaundice (yellowing of eyes and skin) and indicates liver dysfunction, gallbladder blockage, or accelerated red blood cell destruction.',
    understand: 'Normal levels are typically 0.2-1.2 mg/dL. Mild isolated elevations without symptoms may be due to a benign genetic variant called Gilbert\'s Syndrome.',
    tips: [
      'Limit alcohol consumption to reduce liver workload',
      'Stay well-hydrated to help clear bilirubin through bile channels',
      'Avoid high-dose supplements that can strain the liver'
    ],
    learnMore: [
      { label: 'Cleveland Clinic: Bilirubin', url: 'https://my.clevelandclinic.org' },
      { label: 'Mayo Clinic: Jaundice Info', url: 'https://www.mayoclinic.org' }
    ]
  },
  SODIUM: {
    what: 'Sodium is an essential electrolyte that regulates fluid balance, blood volume, blood pressure, and nerve/muscle function.',
    why: 'Abnormal sodium levels (hyponatremia or hypernatremia) can affect neurological function, causing confusion, muscle spasms, or lethargy.',
    understand: 'The optimal range is 135-145 mEq/L. Levels are heavily influenced by water intake and medication (e.g. diuretics).',
    tips: [
      'Align your water intake with your physical activity levels',
      'Consume a balanced amount of sodium, avoiding highly processed foods',
      'Discuss electrolyte monitoring with your doctor if taking blood pressure medications'
    ],
    learnMore: [
      { label: 'National Kidney Foundation: Hyponatremia', url: 'https://www.kidney.org' },
      { label: 'MedlinePlus: Sodium Blood Test', url: 'https://medlineplus.gov' }
    ]
  },
  ALT: {
    what: 'Alanine Aminotransferase (ALT) is an enzyme found primarily in the liver cells. Injury to liver cells causes ALT to spill into the blood.',
    why: 'It is a highly sensitive marker of liver stress. Elevated ALT indicates inflammation or damage from fat buildup, alcohol, viral hepatitis, or medications.',
    understand: 'Optimal levels are typically under 45 U/L. Mild elevations require monitoring and investigation of lifestyle causes like fatty liver.',
    tips: [
      'Maintain a healthy weight and engage in daily physical activity',
      'Limit alcohol consumption to protect hepatocyte health',
      'Avoid unnecessary over-the-counter medications that place stress on the liver'
    ],
    learnMore: [
      { label: 'American Liver Foundation: ALT', url: 'https://liverfoundation.org' },
      { label: 'Mayo Clinic: ALT Test', url: 'https://www.mayoclinic.org' }
    ]
  },
  AST: {
    what: 'Aspartate Aminotransferase (AST) is an enzyme present in the liver, heart, and skeletal muscle cells.',
    why: 'Elevations indicate tissue damage, most commonly in the liver. Comparing AST and ALT levels helps distinguish between liver injury and muscle stress.',
    understand: 'Optimal levels are typically under 40 U/L. If AST is elevated while ALT is normal, skeletal muscle strain is a possible cause.',
    tips: [
      'Avoid strenuous muscle-damaging exercise directly before blood draws',
      'Support liver health by limiting alcohol and toxic compounds',
      'Discuss fatty liver prevention strategies with your care team'
    ],
    learnMore: [
      { label: 'WebMD: AST Test Info', url: 'https://www.webmd.com' },
      { label: 'MedlinePlus: AST Test', url: 'https://medlineplus.gov' }
    ]
  },
  CREATININE: {
    what: 'Creatinine is a chemical waste product generated by muscle activity. Healthy kidneys filter it out of the blood and excrete it.',
    why: 'Kidney function directly impacts blood creatinine. Elevated levels indicate reduced kidney filtration efficiency.',
    understand: 'The normal range is typically 0.6-1.3 mg/dL, depending on muscle mass. Slight elevations can be caused by heavy protein meals or temporary dehydration.',
    tips: [
      'Ensure sufficient daily water intake',
      'Avoid overuse of NSAID pain relievers like ibuprofen',
      'Discuss with your doctor if you take creatine supplements'
    ],
    learnMore: [
      { label: 'National Kidney Foundation: Creatinine', url: 'https://www.kidney.org' },
      { label: 'Mayo Clinic: Kidney Test', url: 'https://www.mayoclinic.org' }
    ]
  },
  EGFR: {
    what: 'Estimated Glomerular Filtration Rate (eGFR) is a calculation that estimates how much blood passes through the kidney filters each minute.',
    why: 'It is the gold standard for measuring kidney performance and staging kidney disease. A declining eGFR indicates loss of renal capacity.',
    understand: 'An eGFR of 90 mL/min/1.73m² or above is normal. Values between 60-89 indicate mild impairment, and values below 60 indicate moderate kidney disease.',
    tips: [
      'Manage blood pressure and blood glucose strictly, as they are primary drivers of kidney damage',
      'Avoid dehydration and nephrotoxic medications',
      'Adopt a low-sodium, heart-healthy diet to support kidney blood flow'
    ],
    learnMore: [
      { label: 'NKF: About eGFR', url: 'https://www.kidney.org' },
      { label: 'Mayo Clinic: Kidney Function eGFR', url: 'https://www.mayoclinic.org' }
    ]
  },
  TESTOSTERONE: {
    what: 'Testosterone is a vital steroid hormone produced in the testes and ovaries, promoting muscle mass, bone strength, libido, and energy.',
    why: 'Imbalances affect metabolic, sexual, and mental health. Low levels in men cause fatigue and muscle loss, while high levels in women indicate PCOS.',
    understand: 'Reference ranges vary widely by sex and age. Male levels typically range between 300-1000 ng/dL, and female levels between 15-70 ng/dL.',
    tips: [
      'Prioritize quality sleep, which is essential for hormone synthesis',
      'Manage chronic stress to prevent high cortisol from lowering testosterone',
      'Maintain healthy weight through resistance training and balanced nutrition'
    ],
    learnMore: [
      { label: 'Endocrine Society: Testosterone', url: 'https://www.endocrine.org' },
      { label: 'WebMD: Testosterone Levels', url: 'https://www.webmd.com' }
    ]
  }
};

const STATUS_META: Record<string, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  NORMAL: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Within Normal Range',
    description: 'This biomarker value falls within the established optimal clinical reference interval.',
    color: '#1A9966',
  },
  HIGH: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Above Reference Range',
    description: 'This value exceeds the upper reference limit. Clinical evaluation is recommended.',
    color: '#F04E14',
  },
  LOW: {
    icon: <TrendingDown className="w-4 h-4" />,
    label: 'Below Reference Range',
    description: 'This value is below the lower reference limit. Clinical evaluation is recommended.',
    color: '#C97D0A',
  },
  CRITICAL: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Critical Value',
    description: 'This value is critically outside the reference range and may require urgent attention.',
    color: '#E53E3E',
  },
};

export function BiomarkerDetailDialog({ biomarker, onClose }: DetailDialogProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    // Trigger transition after render
    const frame = requestAnimationFrame(() => {
      setIsRendered(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Close on Escape key press
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsRendered(false);
    setTimeout(onClose, 300); // 300ms matches the transition duration
  };

  const colors = STATUS_COLORS[biomarker.status];
  const effectivePct = getEffectivePct(biomarker);
  const Icon = CATEGORY_ICONS[biomarker.category] || Activity;
  const statusMeta = STATUS_META[biomarker.status] || STATUS_META.NORMAL;

  // Get rich description or fallback
  const canonical = biomarker.canonicalName?.toUpperCase() || '';
  const matchKey = Object.keys(BIOMARKER_DESCRIPTIONS).find(k => canonical.includes(k));
  const richDesc = matchKey ? BIOMARKER_DESCRIPTIONS[matchKey] : null;

  const description = richDesc?.what || biomarker.description ||
    'A key biological compound monitored as part of a comprehensive laboratory diagnostic panel to evaluate systemic health and cellular function.';
  const analysis = richDesc?.why || biomarker.detailedAnalysis ||
    'This biomarker provides important information about your physiological status. Clinical significance depends on context and should be interpreted alongside other diagnostic results.';
  const understandText = richDesc?.understand ||
    'Biomarker values fluctuate based on diet, stress, hydration, and activity. Compare your results to the reference range listed above.';
  const tips = richDesc?.tips || [
    'Schedule a follow-up discussion with your physician',
    'Continue routine monitoring per your care plan',
    'Maintain healthy lifestyle practices'
  ];
  const learnMore = richDesc?.learnMore || [
    { label: 'MedlinePlus Medical Encyclopedia', url: 'https://medlineplus.gov' }
  ];

  return (
    <div className="fixed inset-0 z-[9990] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ${
          isRendered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={handleClose}
      />

      {/* Slide-over Sidebar Panel */}
      <div
        className={`relative w-full max-w-lg bg-card border-l border-border/40 shadow-2xl flex flex-col h-full z-[9991] transition-transform duration-300 ease-out ${
          isRendered ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'color-mix(in srgb, var(--card) 97%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Header gradient bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${statusMeta.color}, var(--primary))` }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/10">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: colors.bg }}
            >
              <Icon className="w-5 h-5" style={{ color: colors.text }} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground leading-tight">{biomarker.displayName}</h3>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{biomarker.category}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-border/30 transition-colors cursor-pointer border-0 bg-transparent flex-shrink-0"
          >
            <X className="w-4.5 h-4.5 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-6 flex flex-col gap-6 custom-scrollbar">
          {/* Value + Status Badge */}
          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: colors.bg, border: `1px solid ${statusMeta.color}30` }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Your Value</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold" style={{ color: colors.text }}>{biomarker.value}</span>
                <span className="text-sm font-semibold text-muted-foreground">{biomarker.unit}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Reference: {biomarker.referenceRange}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${statusMeta.color}20`, color: statusMeta.color }}
              >
                <span className="flex-shrink-0">{statusMeta.icon}</span>
                <span>{biomarker.status}</span>
              </div>
              <p className="text-[10px] text-right text-muted-foreground max-w-[140px] leading-tight">
                {statusMeta.label}
              </p>
            </div>
          </div>

          {/* Range Bar */}
          <div>
            <div className="flex justify-between text-[9px] mb-2 font-semibold text-muted-foreground">
              <span>Low {biomarker.referenceMin != null ? `(${biomarker.referenceMin})` : ''}</span>
              <span className="text-foreground font-bold">Optimal Range: {biomarker.referenceRange}</span>
              <span>High {biomarker.referenceMax != null ? `(${biomarker.referenceMax})` : ''}</span>
            </div>
            <div className="relative h-3.5 rounded-full overflow-visible bg-border/20 flex">
              {/* Zone segments */}
              <div className="h-full rounded-l-full w-[20%]" style={{ background: 'rgba(201,125,10,0.35)' }} />
              <div className="h-full w-[60%] border-x border-border/30" style={{ background: 'rgba(26,153,102,0.35)' }} />
              <div className="h-full rounded-r-full w-[20%]" style={{ background: 'rgba(240,78,20,0.35)' }} />
              {/* Needle */}
              <div
                className="absolute w-5 h-5 -top-[3px] rounded-full border-2 border-white shadow-lg transition-all duration-700"
                style={{ left: `calc(${effectivePct}% - 10px)`, background: statusMeta.color, boxShadow: `0 0 12px ${statusMeta.color}80` }}
              />
            </div>
            {/* Status description */}
            <div
              className="flex items-start gap-2 mt-3 p-2.5 rounded-lg"
              style={{ background: `${statusMeta.color}10`, border: `1px solid ${statusMeta.color}25` }}
            >
              <span style={{ color: statusMeta.color, flexShrink: 0, marginTop: '1px' }}>
                <Info className="w-3.5 h-3.5" />
              </span>
              <p className="text-[10px] leading-normal" style={{ color: statusMeta.color }}>{statusMeta.description}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/10" />

          {/* Question 1: What is...? */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Minus className="w-3 h-3 text-muted-foreground/80" />
              What is {biomarker.displayName}?
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>

          {/* Question 2: Why is...? */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground/80" />
              Why is {biomarker.displayName} important?
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{analysis}</p>
          </div>

          {/* Question 3: How can I better understand...? */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Info className="w-3 h-3 text-muted-foreground/80" />
              How can I better understand my {biomarker.displayName} levels?
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{understandText}</p>
          </div>

          {/* Question 4: How can I maintain optimal levels? */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--primary-glow)', border: '1px solid var(--border)' }}
          >
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--primary-text)' }}>
              <CheckCircle2 className="w-3 h-3" />
              How can I maintain optimal {biomarker.displayName} levels?
            </h4>
            <ul className="flex flex-col gap-2">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-extrabold mt-0.5"
                    style={{ background: 'var(--primary-text)', color: 'white' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-normal">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Question 5: Where can I learn more? */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/80" />
              Where can I learn more?
            </h4>
            <div className="flex flex-wrap gap-2">
              {learnMore.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-text hover:text-white border hover:bg-primary-text transition-all cursor-pointer bg-transparent"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                  }}
                >
                  {link.label}
                  <ExternalLink className="w-3 h-3 opacity-75" />
                </a>
              ))}
            </div>
          </div>

          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2.5 mt-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-extrabold tracking-wider leading-relaxed text-red-500 uppercase">
              DISCLAIMER: IF YOU ARE CONCERNED WITH ANY OF YOUR RESULTS, PLEASE CONSULT WITH YOUR PHYSICIAN.
            </p>
          </div>

          {/* Confidence score if available */}
          {biomarker.confidence != null && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground">Extraction Confidence</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(biomarker.confidence * 100)}%`, background: 'var(--primary-text)' }}
                  />
                </div>
                <span className="text-[10px] font-bold" style={{ color: 'var(--primary-text)' }}>
                  {Math.round(biomarker.confidence * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-border/10 flex gap-3 bg-muted/10">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border/50 hover:bg-border/20 transition-all cursor-pointer bg-transparent"
          >
            Close
          </button>
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer hover:opacity-90 shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--primary-text), var(--primary))' }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
