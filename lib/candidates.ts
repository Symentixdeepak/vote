export const CANDIDATES = [
  {
    id: "trilok",
    name: "Trilok",
    color: "#0f766e",
    accent: "#ccfbf1"
  },
  {
    id: "manisha",
    name: "Manisha",
    color: "#c2410c",
    accent: "#ffedd5"
  },
  {
    id: "abhishek",
    name: "Abhishek",
    color: "#7c3aed",
    accent: "#ede9fe"
  }
] as const;

export type CandidateId = (typeof CANDIDATES)[number]["id"];

export function isCandidateId(value: unknown): value is CandidateId {
  return CANDIDATES.some((candidate) => candidate.id === value);
}

export function getCandidateName(candidateId: CandidateId): string {
  return CANDIDATES.find((candidate) => candidate.id === candidateId)?.name ?? candidateId;
}
