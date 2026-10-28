export type State = "completed" | "late" | "action" | "waiting_patient" | "on_track";
export type Priority = "urgent" | "high" | "medium" | "ready";

export type Cockpit = {
  date: string;
  kpis: { active: number; on_track: number; on_track_pct: number; incomplete: number; tasks_to_treat: number; urgent: number; deadlines_72h: number; next_deadline: string | null; finished_week: number };
  queue: { journey_id: string; priority: Priority; priority_label: string; days_to_surgery: number; patient_name: string; reference: string; procedure: string; surgery_date: string; progress: number; next_doc: string | null; owner: string; state: State; note: string | null; proposal_id: string | null; proposal_kind: string | null }[];
  validation_pending: number;
  assistant: { proposal: { id: string; kind: string; journey_id: string | null; patient_name: string; payload: Record<string, any> } | null; to_chase: number; no_response: number; ready: number };
};
export type JourneyList = {
  total: number; counts: Record<State, number>;
  items: { journey_id: string; patient_name: string; reference: string; procedure: string; surgery_date: string; days_to_surgery: number; stage: string; progress: number; state: State; state_label: string; owner: string }[];
};
export type JourneyDetail = {
  journey_id: string; state: State; state_label: string; reference: string; procedure: string; surgeon: string; owner: string; surgery_date: string; admission_time: string; days_to_surgery: number; template_version: number;
  patient: { name: string; ref: string; birth_date: string | null };
  progress: { done: number; total: number; pct: number; missing: number };
  timeline: { id: string; label: string; title: string; status: "done" | "action" | "upcoming"; due_date: string; owner: string; detail: string }[];
  documents: { id: string; title: string; status: "Validé" | "En revue" | "Manquant"; due_date: string; file_id: string | null; file_name: string | null }[];
  activity: { at: string; tag: string; text: string; actor: string }[];
  next_action: { proposal_id: string; kind: string; payload: Record<string, any> } | null;
};
export type Proposal = { id: string; agent: string; kind: string; payload: Record<string, any>; status: string };
export type Notice = { version: string; controller: string; city: string; rights_contact: string; cndp_ref: string; transfer_ref: string; retention_days: number };
export type Portal = {
  first_name: string; language: "fr" | "ar"; establishment: string; consent_required: boolean; notice: Notice;
  journeys: { journey_id: string; surgery_date: string; procedure: string; admission_time: string; progress: { done: number; total: number };
    tasks: { id: string; title: string; kind: string; due_date: string; status: "todo" | "submitted" | "done"; can_submit: boolean }[];
    messages: { subject: string; body: string }[] }[];
};
export type Me = { establishment: string; roles: string[]; ai_enabled: boolean; ai_blocked_reason: string; cndp_ref: string };
