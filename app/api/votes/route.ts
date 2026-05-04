import { NextResponse } from "next/server";
import { isCandidateId } from "@/lib/candidates";
import { summarizeVotes } from "@/lib/results";
import { createVote, DuplicateVoteError, getVotes } from "@/lib/vote-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VoteRequestBody = {
  name?: unknown;
  rollNumber?: unknown;
  candidate?: unknown;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET() {
  try {
    const votes = await getVotes();
    return NextResponse.json(summarizeVotes(votes));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to load votes."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: VoteRequestBody;

  try {
    body = (await request.json()) as VoteRequestBody;
  } catch {
    return NextResponse.json({ message: "Invalid vote request." }, { status: 400 });
  }

  const name = cleanText(body.name);
  const rollNumber = cleanText(body.rollNumber).toUpperCase();
  const candidate = body.candidate;

  if (!name || name.length > 80) {
    return NextResponse.json({ message: "Enter a valid name." }, { status: 400 });
  }

  if (!rollNumber || rollNumber.length > 30) {
    return NextResponse.json({ message: "Enter a valid roll number." }, { status: 400 });
  }

  if (!isCandidateId(candidate)) {
    return NextResponse.json({ message: "Choose a student." }, { status: 400 });
  }

  try {
    const yourVote = await createVote({
      name,
      rollNumber,
      candidate
    });
    const votes = await getVotes();

    return NextResponse.json(
      {
        ...summarizeVotes(votes),
        yourVote
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DuplicateVoteError) {
      const votes = await getVotes();

      return NextResponse.json(
        {
          ...summarizeVotes(votes),
          yourVote: error.vote,
          message: error.message
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to submit vote."
      },
      { status: 500 }
    );
  }
}
