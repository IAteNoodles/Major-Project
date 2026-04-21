// Next-step recommendation engine
// Based on current selection, suggests relevant explorations

const RULES = [
  {
    match: (labels) => labels.includes("Patient"),
    suggestions: [
      { text: "See medical history over time", action: "view", target: "timeline" },
      { text: "Look at diagnoses", action: "filter", target: "diagnosis" },
      { text: "Check medications", action: "filter", target: "medication" },
    ],
  },
  {
    match: (labels) => labels.includes("Admission"),
    suggestions: [
      { text: "See what happened during this visit", action: "expand", target: "events" },
      { text: "Look at diagnoses for this visit", action: "filter", target: "diagnosis" },
      { text: "Compare with other hospital visits", action: "compare", target: "admissions" },
    ],
  },
  {
    match: (labels) =>
      labels.includes("ICDDiagnosisCode") || labels.some((l) => l.includes("Diagnosis")),
    suggestions: [
      { text: "Find supporting lab results", action: "expand", target: "labs" },
      { text: "See related medications", action: "expand", target: "medications" },
      { text: "View treatment timeline", action: "view", target: "timeline" },
    ],
  },
  {
    match: (labels) =>
      labels.some((l) => l.includes("Prescription") || l.includes("EMAR") || l.includes("Pharmacy")),
    suggestions: [
      { text: "See why this was prescribed", action: "expand", target: "diagnosis" },
      { text: "View pharmacy details", action: "expand", target: "pharmacy" },
      { text: "Check for other medications", action: "expand", target: "medications" },
    ],
  },
  {
    match: (labels) =>
      labels.includes("LabItem") || labels.some((l) => l.includes("Lab")),
    suggestions: [
      { text: "Show abnormal results", action: "filter", target: "abnormal" },
      { text: "See related diagnoses", action: "expand", target: "diagnosis" },
      { text: "Compare across hospital visits", action: "compare", target: "labs" },
    ],
  },
  {
    match: (labels) => labels.includes("ICUStay"),
    suggestions: [
      { text: "See what happened in ICU", action: "expand", target: "icu_events" },
      { text: "View vital sign readings", action: "filter", target: "vitals" },
      { text: "Check medications given during stay", action: "filter", target: "medication" },
    ],
  },
];

const DEFAULT_SUGGESTIONS = [
  { text: "Explore related items", action: "expand", target: "neighbors" },
  { text: "See where this data came from", action: "evidence", target: "node" },
  { text: "Show in timeline", action: "view", target: "timeline" },
];

export function getRecommendations(labels = []) {
  if (!labels.length) return DEFAULT_SUGGESTIONS;

  for (const rule of RULES) {
    if (rule.match(labels)) {
      return rule.suggestions;
    }
  }

  return DEFAULT_SUGGESTIONS;
}
