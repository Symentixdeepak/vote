import { CANDIDATES } from "@/lib/candidates";
import type { ResultsPayload, VoteRecord } from "@/lib/types";

export function summarizeVotes(votes: VoteRecord[]): ResultsPayload {
  const leaderboard = CANDIDATES.map((candidate) => ({
    candidate: candidate.id,
    name: candidate.name,
    color: candidate.color,
    accent: candidate.accent,
    votes: votes.filter((vote) => vote.candidate === candidate.id).length
  })).sort((first, second) => {
    if (second.votes !== first.votes) {
      return second.votes - first.votes;
    }

    return first.name.localeCompare(second.name);
  });

  return {
    totalVotes: votes.length,
    leaderboard,
    votes
  };
}
