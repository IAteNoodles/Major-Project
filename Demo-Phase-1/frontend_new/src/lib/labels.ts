// Human-friendly labels for all UI elements

// --- Node type labels ---
export const NODE_LABELS: Record<string, string> = {
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
  ICUItem: "ICU Reading",
  DiagnosisEvent: "Diagnosis Event",
  ProcedureCodeEvent: "Procedure Event",
  LabEvent: "Lab Event",
  MicrobiologyEvent: "Microbiology",
  PrescriptionEvent: "Prescription",
  EMAREvent: "Medication Given",
};

export const NODE_DESCRIPTIONS: Record<string, string> = {
  Patient: "The person receiving care",
  Admission: "One trip to the hospital",
  ICUStay: "Time spent in intensive care",
  ClinicalEvent: "Something that happened (lab, note, order, etc.)",
  Provider: "Doctor or clinician who provided care",
  Caregiver: "Nurse or aide who helped",
  POEOrder: "A test or medication order from a doctor",
  PharmacyDispense: "A drug that was dispensed",
  ICDDiagnosisCode: "A condition that was identified (ICD code)",
  ICDProcedureCode: "A surgery or treatment performed (ICD code)",
  HCPCSCode: "A billing/insurance code (HCPCS)",
  LabItem: "A blood, urine, or other lab test",
  ICUItem: "A vital sign or measurement in ICU",
  DiagnosisEvent: "A diagnosis recorded during a visit",
  ProcedureCodeEvent: "A procedure performed during a visit",
  LabEvent: "A lab test result",
  MicrobiologyEvent: "A microbiology culture or test",
  PrescriptionEvent: "A prescription written for a medication",
  EMAREvent: "A medication administration event",
};

// --- Relationship labels ---
export const REL_LABELS: Record<string, string> = {
  HAS_ADMISSION: "Admitted to Hospital",
  HAS_ICUSTAY: "Stayed in ICU",
  HAS_EVENT: "Had Clinical Event",
  HAS_ORDER: "Doctor Ordered",
  HAS_PHARMACY_ORDER: "Pharmacy Ordered",
  ORDERED_EVENT: "Ordered",
  RECORDED_EVENT: "Recorded By",
  USES_ICD_DIAGNOSIS: "Diagnosed With",
  USES_ICD_PROCEDURE: "Had Procedure",
  USES_HCPCS: "Billed Under",
  MEASURES_LAB_ITEM: "Lab Test For",
  HAS_SPECIMEN_ITEM: "Sample From",
  HAS_TEST_ITEM: "Tested For",
  FROM_POE_ORDER: "From Doctor's Order",
  FROM_PHARMACY_DISPENSE: "Dispensed By Pharmacy",
  DETAIL_OF: "Details Of",
  MEASURES_ICU_ITEM: "ICU Measurement",
  USES_ICU_ITEM: "Used In ICU",
  PLACED_ORDER: "Placed Order",
  DISPENSES_FOR_ORDER: "Dispensed For",
};

// --- Category system ---
export const CATEGORY_COLORS: Record<string, string> = {
  diagnosis: "#a78bfa",
  medication: "#34d399",
  lab: "#fbbf24",
  procedure: "#22d3ee",
  encounter: "#94a3b8",
  icu: "#f472b6",
  patient: "#f87171",
  other: "#64748b",
};

export const CATEGORY_ICONS: Record<string, string> = {
  diagnosis: "🏷️",
  medication: "💊",
  lab: "🧪",
  procedure: "🔧",
  encounter: "🏥",
  icu: "🫀",
  patient: "👤",
  other: "📋",
};

export const CATEGORY_NAMES: Record<string, string> = {
  all: "All",
  diagnosis: "Diagnoses",
  medication: "Medications",
  lab: "Lab Results",
  procedure: "Procedures",
  icu: "ICU Events",
  encounter: "Hospital Visits",
  patient: "Patients",
  other: "Other",
};

// --- Node type colors for graph ---
export const NODE_COLORS: Record<string, string> = {
  Patient: "#f87171",
  Admission: "#fb923c",
  ICUStay: "#fbbf24",
  ClinicalEvent: "#38bdf8",
  Provider: "#22d3ee",
  Caregiver: "#2dd4bf",
  POEOrder: "#86efac",
  PharmacyDispense: "#34d399",
  ICDDiagnosisCode: "#a78bfa",
  ICDProcedureCode: "#818cf8",
  HCPCSCode: "#f472b6",
  LabItem: "#fbbf24",
  ICUItem: "#f472b6",
  DiagnosisEvent: "#c4b5fd",
  ProcedureCodeEvent: "#93c5fd",
  LabEvent: "#fde68a",
  MicrobiologyEvent: "#d9f99d",
  PrescriptionEvent: "#6ee7b7",
  EMAREvent: "#5eead4",
};

// --- Property name mapping ---
export const PROP_NAMES: Record<string, string> = {
  subject_id: "Patient ID",
  hadm_id: "Visit ID",
  stay_id: "ICU Stay ID",
  row_uid: "Record ID",
  admittime: "Admitted",
  dischtime: "Discharged",
  deathtime: "Time of Death",
  admission_type: "Visit Type",
  admission_location: "Arrived From",
  discharge_location: "Discharged To",
  insurance: "Insurance",
  language: "Language",
  marital_status: "Marital Status",
  race: "Ethnicity",
  gender: "Sex",
  anchor_age: "Age (approx.)",
  anchor_year: "Year",
  dod: "Date of Death",
  icd_code: "Diagnosis Code",
  icd_version: "Code Version",
  long_title: "Description",
  short_title: "Short Name",
  source_table: "Data Source",
  drug: "Drug Name",
  medication: "Medication",
  itemid: "Item ID",
  label: "Name",
  category: "Category",
  provider_id: "Provider ID",
  caregiver_id: "Caregiver ID",
  code: "Code",
  seq_num: "Sequence #",
  first_careunit: "First ICU Unit",
  last_careunit: "Last ICU Unit",
  intime: "Start Time",
  outtime: "End Time",
  los: "Length of Stay",
  result_name: "Result",
  test_name: "Test",
  spec_type_desc: "Specimen Type",
  curr_service: "Service",
  event_txt: "Event Text",
  order_type: "Order Type",
  order_subtype: "Order Subtype",
};

// --- Helpers ---
export function getNodeLabel(rawLabel: string): string {
  return NODE_LABELS[rawLabel] || rawLabel;
}

export function getRelLabel(rawType: string): string {
  return REL_LABELS[rawType] || rawType.replace(/_/g, " ").toLowerCase();
}

export function getPropName(rawKey: string): string {
  return (
    PROP_NAMES[rawKey] ||
    rawKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function mainLabel(labels: string[]): string {
  if (!labels?.length) return "Node";
  // Priority order: specific types first, then generic
  const prio = [
    "ICDDiagnosisCode",
    "ICDProcedureCode",
    "HCPCSCode",
    "LabItem",
    "ICUItem",
    "POEOrder",
    "PharmacyDispense",
    "ICUStay",
    "Admission",
    "Patient",
    "Provider",
    "Caregiver",
    "DiagnosisEvent",
    "ProcedureCodeEvent",
    "LabEvent",
    "MicrobiologyEvent",
    "PrescriptionEvent",
    "EMAREvent",
    "ClinicalEvent",
  ];
  for (const p of prio) {
    if (labels.includes(p)) return p;
  }
  return labels[0];
}

/**
 * Generates a meaningful human-readable display name for a graph node.
 * Uses the node's labels and properties to pick the best available name.
 * This mirrors the backend's `_event_description()` logic.
 */
export function nodeDisplayName(
  props: Record<string, unknown>,
  labels?: string[]
): string {
  // 1. Named clinical entities — always have a clear title
  if (props.long_title) return String(props.long_title);
  if (props.short_title) return String(props.short_title);
  if (props.drug) return String(props.drug);
  if (props.medication) return String(props.medication);

  // 2. Lab / test results
  if (props.result_name) return String(props.result_name);
  if (props.test_name) return String(props.test_name);
  if (props.spec_type_desc) return `${String(props.spec_type_desc)} culture`;
  if (props.label && String(props.label).length > 2) return String(props.label);

  // 3. Order / event text
  if (props.event_txt) return String(props.event_txt);
  if (props.order_type) {
    const sub = props.order_subtype ? `: ${String(props.order_subtype)}` : "";
    return `${String(props.order_type)}${sub}`;
  }
  if (props.curr_service) return `${String(props.curr_service)} service`;

  // 4. Code-based fallbacks
  if (props.icd_code) return `ICD ${String(props.icd_code)}`;
  if (props.code) return `Code ${String(props.code)}`;
  if (props.itemid) return `Item #${String(props.itemid)}`;

  // 5. Structural entities — use their identity
  if (labels?.includes("Patient") && props.subject_id) return `Patient ${String(props.subject_id)}`;
  if (labels?.includes("Admission") && props.hadm_id) return `Visit ${String(props.hadm_id)}`;
  if (labels?.includes("ICUStay") && props.stay_id) return `ICU Stay ${String(props.stay_id)}`;
  if (labels?.includes("Provider") && props.provider_id) return `Provider ${String(props.provider_id)}`;
  if (labels?.includes("Caregiver") && props.caregiver_id) return `Caregiver ${String(props.caregiver_id)}`;

  // 6. Source table fallback
  if (props.source_table) return `${String(props.source_table)} record`;

  // 7. Label-based fallback
  if (labels?.length) return getNodeLabel(mainLabel(labels));

  return "Unknown";
}

/**
 * Determines the clinical category from a node's Neo4j labels.
 */
export function categoryFromLabels(labels: string[]): string {
  const set = new Set(labels);
  if (set.has("Patient")) return "patient";
  if (set.has("Admission")) return "encounter";
  if (set.has("ICDDiagnosisCode") || set.has("DiagnosisEvent")) return "diagnosis";
  if (set.has("ICDProcedureCode") || set.has("ProcedureCodeEvent")) return "procedure";
  if (set.has("LabItem") || set.has("LabEvent") || set.has("MicrobiologyEvent")) return "lab";
  if (set.has("ICUStay") || set.has("ICUItem")) return "icu";
  if (
    set.has("POEOrder") ||
    set.has("PharmacyDispense") ||
    set.has("PrescriptionEvent") ||
    set.has("EMAREvent")
  )
    return "medication";
  return "other";
}
