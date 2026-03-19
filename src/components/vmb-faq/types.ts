export const EXPLAINER_STAGES = [
  "step1Active",
  "lineOwnerToA",
  "clientAGlow",
  "step2Active",
  "appointmentBooked",
  "step3Active",
  "paymentReceived",
  "insightOverlay",
  "fadeOut",
  "reset",
] as const;

export type ExplainerStage = (typeof EXPLAINER_STAGES)[number];

export const PHASE2_STAGES = [
  "step1Active",
  "lineAToNewClient",
  "friendJoins",
  "bookAppointmentReveal",
  "paymentLine",
  "paymentReceived",
  "dReveal",
  "connectorAToD",
  "dFlash",
  "hold",
  "fadeOut",
  "reset",
] as const;

export type Phase2Stage = (typeof PHASE2_STAGES)[number];
