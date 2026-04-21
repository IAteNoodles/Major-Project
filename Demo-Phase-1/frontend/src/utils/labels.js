// Human-friendly labels for all modes
// Clinical = plain English, Research = plain + technical, Learning = annotated

export const NL_REL_LABELS = {
  HAS_ADMISSION: "admitted to hospital",
  HAS_ICUSTAY: "stayed in ICU",
  HAS_EVENT: "clinical event",
  HAS_ORDER: "doctor's order",
  HAS_PHARMACY_ORDER: "pharmacy order",
  ORDERED_EVENT: "ordered",
  RECORDED_EVENT: "recorded by",
  USES_ICD_DIAGNOSIS: "diagnosed with",
  USES_ICD_PROCEDURE: "underwent procedure",
  USES_HCPCS: "billed under",
  MEASURES_LAB_ITEM: "lab test for",
  HAS_SPECIMEN_ITEM: "sample from",
  HAS_TEST_ITEM: "tested for",
  FROM_POE_ORDER: "from doctor's order",
  FROM_PHARMACY_DISPENSE: "dispensed by pharmacy",
  DETAIL_OF: "details of",
  MEASURES_ICU_ITEM: "ICU measurement",
  USES_ICU_ITEM: "used in ICU",
  PLACED_ORDER: "placed order",
  DISPENSES_FOR_ORDER: "dispensed for order",
};

// Research mode: shows both human + technical
export const RESEARCH_REL_LABELS = {
  HAS_ADMISSION: "Admitted (HAS_ADMISSION)",
  HAS_ICUSTAY: "ICU Stay (HAS_ICUSTAY)",
  HAS_EVENT: "Event (HAS_EVENT)",
  HAS_ORDER: "Order (HAS_ORDER)",
  HAS_PHARMACY_ORDER: "Rx Order (HAS_PHARMACY_ORDER)",
  ORDERED_EVENT: "Ordered (ORDERED_EVENT)",
  RECORDED_EVENT: "Recorded (RECORDED_EVENT)",
  USES_ICD_DIAGNOSIS: "Diagnosis (USES_ICD_DIAGNOSIS)",
  USES_ICD_PROCEDURE: "Procedure (USES_ICD_PROCEDURE)",
  USES_HCPCS: "Billing (USES_HCPCS)",
  MEASURES_LAB_ITEM: "Lab Test (MEASURES_LAB_ITEM)",
  HAS_SPECIMEN_ITEM: "Specimen (HAS_SPECIMEN_ITEM)",
  HAS_TEST_ITEM: "Test (HAS_TEST_ITEM)",
  FROM_POE_ORDER: "From Order (FROM_POE_ORDER)",
  FROM_PHARMACY_DISPENSE: "Dispensed (FROM_PHARMACY_DISPENSE)",
  DETAIL_OF: "Detail (DETAIL_OF)",
  MEASURES_ICU_ITEM: "ICU Metric (MEASURES_ICU_ITEM)",
  USES_ICU_ITEM: "ICU Item (USES_ICU_ITEM)",
  PLACED_ORDER: "Placed (PLACED_ORDER)",
  DISPENSES_FOR_ORDER: "Dispensed (DISPENSES_FOR_ORDER)",
};

export const NL_NODE_LABELS = {
  Patient: "Patient",
  Admission: "Hospital Visit",
  ICUStay: "ICU Stay",
  ClinicalEvent: "Clinical Event",
  Provider: "Doctor / Provider",
  Caregiver: "Caregiver",
  POEOrder: "Doctor's Order",
  PharmacyDispense: "Pharmacy Record",
  ICDDiagnosisCode: "Diagnosis",
  ICDProcedureCode: "Procedure",
  HCPCSCode: "Billing Code",
  LabItem: "Lab Test",
  ICUItem: "ICU Measurement",
};

// Research mode: human name + internal type
export const RESEARCH_NODE_LABELS = {
  Patient: "Patient",
  Admission: "Hospital Visit (Admission)",
  ICUStay: "ICU Stay",
  ClinicalEvent: "Event (ClinicalEvent)",
  Provider: "Provider",
  Caregiver: "Caregiver",
  POEOrder: "Order (POEOrder)",
  PharmacyDispense: "Pharmacy (PharmacyDispense)",
  ICDDiagnosisCode: "Diagnosis (ICD)",
  ICDProcedureCode: "Procedure (ICD)",
  HCPCSCode: "Billing (HCPCS)",
  LabItem: "Lab Test (LabItem)",
  ICUItem: "ICU Item",
};

// Learning mode: annotated with explanation
export const LEARNING_NODE_LABELS = {
  Patient: "Patient — the person receiving care",
  Admission: "Hospital Visit — one trip to the hospital",
  ICUStay: "ICU Stay — time in intensive care",
  ClinicalEvent: "Clinical Event — something that happened (lab, note, etc.)",
  Provider: "Doctor / Provider — who gave care",
  Caregiver: "Caregiver — nurse or aide",
  POEOrder: "Doctor's Order — a medication or test request",
  PharmacyDispense: "Pharmacy Record — a drug that was given",
  ICDDiagnosisCode: "Diagnosis — what condition was found (ICD code)",
  ICDProcedureCode: "Procedure — what was done (ICD code)",
  HCPCSCode: "Billing Code — how it was billed (HCPCS)",
  LabItem: "Lab Test — a blood/urine/etc. test",
  ICUItem: "ICU Measurement — a vital sign or reading in ICU",
};

export const CATEGORY_COLORS = {
  diagnosis: "#c084fc",
  medication: "#4ade80",
  lab: "#fb7185",
  procedure: "#38bdf8",
  encounter: "#ff9f1c",
  icu: "#fde047",
  alert: "#f87171",
  patient: "#ff6b6b",
  other: "#94a3b8",
};

export const CATEGORY_ICONS = {
  diagnosis: "🏷️",
  medication: "💊",
  lab: "🧪",
  procedure: "🔧",
  encounter: "🏥",
  icu: "🫀",
  patient: "👤",
  other: "📋",
};

// Friendly category names for filter pills
export const CATEGORY_NAMES = {
  all: "All",
  diagnosis: "Diagnoses",
  medication: "Medications",
  lab: "Lab Results",
  procedure: "Procedures",
  icu: "ICU Events",
  encounter: "Hospital Visits",
};

export function getRelLabel(relType, mode) {
  if (mode === "research") {
    return RESEARCH_REL_LABELS[relType] || relType.replace(/_/g, " ").toLowerCase();
  }
  // clinical + learning both use natural language
  return NL_REL_LABELS[relType] || relType.toLowerCase().replace(/_/g, " ");
}

export function getNodeLabel(label, mode) {
  if (mode === "research") {
    return RESEARCH_NODE_LABELS[label] || label;
  }
  if (mode === "learning") {
    return LEARNING_NODE_LABELS[label] || label;
  }
  return NL_NODE_LABELS[label] || label;
}
