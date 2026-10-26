/** JSON-driven game V2. Game rules, case revision and save version are separate. */
export type V2Mode = 'decoding' | 'experiment' | 'decision';
export type V2FactStatus = 'supported' | 'contradicted' | 'uncertain';
export type V2Relation = 'supports' | 'contradicts' | 'qualifies' | 'sequence';
export interface V2EvidenceLink {
  from: string;
  to: string;
  relation: V2Relation;
}
export interface V2DecodingOption {
  id: string;
  text: string;
  status: V2FactStatus;
  accepted: boolean;
  reason: string;
  evidence: string[];
}
export interface V2DecodingTask {
  id: string;
  prompt: string;
  options: V2DecodingOption[];
}
export interface V2Choice {
  id: string;
  text: string;
}
export interface V2Experiment {
  id: string;
  prompt: string;
  conditions: { id: string; label: string; prompt: string }[];
  choices: V2Choice[];
  revealDocuments: string[];
  comparisonPrompt: string;
  explanation: string;
}
export interface V2Decision {
  prompt: string;
  objectives: V2Choice[];
  options: (V2Choice & { outcome: string; tradeoff: string; cost: number })[];
  resources: number;
  revealDocuments: string[];
  updatePrompt: string;
}
export interface V2Case {
  revision: number;
  modes: V2Mode[];
  decoding: V2DecodingTask[];
  graph: { prompt: string; paths: V2EvidenceLink[][] };
  experiment?: V2Experiment;
  decision?: V2Decision;
  reportPrompt: string;
}
export interface V2ExperimentProgress {
  conditionId: string;
  initialChoice: string | null;
  updatedChoice: string | null;
  reason: string;
  stage: 'initial' | 'comparison' | 'complete';
}
export interface V2DecisionRecord {
  objectiveId: string;
  optionId: string;
  reason: string;
  evidence: string[];
  counterEvidence: string[];
  assumptions: string;
}
export interface V2HistoryEvent {
  sequence: number;
  type: string;
  targetId: string;
}
export interface V2Progress {
  decoding: Record<string, { optionId: string; evidence: string[]; note?: string }>;
  links: V2EvidenceLink[];
  experiment?: V2ExperimentProgress;
  decisions: V2DecisionRecord[];
  report: { claim: string; uncertainty: string };
  history: V2HistoryEvent[];
}
export type V2Action =
  | { type: 'v2-decode'; taskId: string; optionId: string; evidence: string[]; note?: string }
  | { type: 'v2-link'; link: V2EvidenceLink }
  | { type: 'v2-experiment-initial'; choiceId: string }
  | { type: 'v2-experiment-update'; choiceId: string; reason: string }
  | { type: 'v2-decision'; record: V2DecisionRecord }
  | { type: 'v2-report'; claim: string; uncertainty: string };
