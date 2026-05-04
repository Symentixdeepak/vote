import type { CandidateId } from "@/lib/candidates";

export type VoteRecord = {
  id: string;
  name: string;
  rollNumber: string;
  candidate: CandidateId;
  createdAt: string;
};

export type LeaderboardItem = {
  candidate: CandidateId;
  name: string;
  color: string;
  accent: string;
  votes: number;
};

export type ResultsPayload = {
  totalVotes: number;
  leaderboard: LeaderboardItem[];
  votes: VoteRecord[];
};
