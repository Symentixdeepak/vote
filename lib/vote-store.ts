import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { isCandidateId } from "@/lib/candidates";
import type { CandidateId } from "@/lib/candidates";
import type { VoteRecord } from "@/lib/types";

type NewVote = {
  name: string;
  rollNumber: string;
  candidate: CandidateId;
};

type DatabaseError = Error & {
  code?: string;
};

let tableReady: Promise<void> | undefined;

const localVotesPath = path.join(process.cwd(), "data", "votes.json");

export class DuplicateVoteError extends Error {
  vote?: VoteRecord;

  constructor(vote?: VoteRecord) {
    super("This roll number has already voted.");
    this.name = "DuplicateVoteError";
    this.vote = vote;
  }
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

function assertPersistentStorageAvailable() {
  if (!getDatabaseUrl() && process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel. Connect a Postgres database before collecting votes.");
  }
}

async function ensureTable() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return;
  }

  if (!tableReady) {
    const sql = neon(databaseUrl);

    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS monitor_votes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          roll_number TEXT NOT NULL,
          candidate TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS monitor_votes_roll_number_unique_idx
        ON monitor_votes (lower(roll_number))
      `;
    })();
  }

  await tableReady;
}

function normalizeVote(row: Record<string, unknown>): VoteRecord {
  const candidate = row.candidate;

  if (!isCandidateId(candidate)) {
    throw new Error("Stored vote contains an unknown candidate.");
  }

  const createdAt = row.createdAt ?? row.created_at;

  return {
    id: String(row.id),
    name: String(row.name),
    rollNumber: String(row.rollNumber ?? row.roll_number),
    candidate,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)
  };
}

async function readLocalVotes(): Promise<VoteRecord[]> {
  try {
    const rawVotes = await fs.readFile(localVotesPath, "utf8");
    const parsedVotes = JSON.parse(rawVotes) as VoteRecord[];

    return parsedVotes.filter((vote) => isCandidateId(vote.candidate));
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeLocalVotes(votes: VoteRecord[]) {
  await fs.mkdir(path.dirname(localVotesPath), { recursive: true });
  await fs.writeFile(localVotesPath, JSON.stringify(votes, null, 2), "utf8");
}

export async function getVotes(): Promise<VoteRecord[]> {
  assertPersistentStorageAvailable();

  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return readLocalVotes();
  }

  await ensureTable();
  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT
      id,
      name,
      roll_number AS "rollNumber",
      candidate,
      created_at AS "createdAt"
    FROM monitor_votes
    ORDER BY created_at DESC
  `;

  return rows.map((row) => normalizeVote(row as Record<string, unknown>));
}

export async function findVoteByRollNumber(rollNumber: string): Promise<VoteRecord | undefined> {
  const normalizedRollNumber = rollNumber.trim().toLowerCase();

  if (!normalizedRollNumber) {
    return undefined;
  }

  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    const votes = await readLocalVotes();
    return votes.find((vote) => vote.rollNumber.trim().toLowerCase() === normalizedRollNumber);
  }

  await ensureTable();
  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT
      id,
      name,
      roll_number AS "rollNumber",
      candidate,
      created_at AS "createdAt"
    FROM monitor_votes
    WHERE lower(roll_number) = ${normalizedRollNumber}
    LIMIT 1
  `;

  return rows[0] ? normalizeVote(rows[0] as Record<string, unknown>) : undefined;
}

export async function createVote(vote: NewVote): Promise<VoteRecord> {
  assertPersistentStorageAvailable();

  const existingVote = await findVoteByRollNumber(vote.rollNumber);

  if (existingVote) {
    throw new DuplicateVoteError(existingVote);
  }

  const databaseUrl = getDatabaseUrl();
  const voteRecord: VoteRecord = {
    id: randomUUID(),
    name: vote.name,
    rollNumber: vote.rollNumber,
    candidate: vote.candidate,
    createdAt: new Date().toISOString()
  };

  if (!databaseUrl) {
    const votes = await readLocalVotes();
    const nextVotes = [voteRecord, ...votes];
    await writeLocalVotes(nextVotes);
    return voteRecord;
  }

  await ensureTable();
  const sql = neon(databaseUrl);

  try {
    const rows = await sql`
      INSERT INTO monitor_votes (id, name, roll_number, candidate, created_at)
      VALUES (${voteRecord.id}, ${voteRecord.name}, ${voteRecord.rollNumber}, ${voteRecord.candidate}, ${voteRecord.createdAt})
      RETURNING
        id,
        name,
        roll_number AS "rollNumber",
        candidate,
        created_at AS "createdAt"
    `;

    return normalizeVote(rows[0] as Record<string, unknown>);
  } catch (error) {
    const databaseError = error as DatabaseError;

    if (databaseError.code === "23505") {
      throw new DuplicateVoteError(await findVoteByRollNumber(vote.rollNumber));
    }

    throw error;
  }
}
