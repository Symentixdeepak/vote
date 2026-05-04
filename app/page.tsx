"use client";

import { BarChart3, CheckCircle2, Medal, Send, UserRoundCheck, Vote } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CANDIDATES, getCandidateName } from "@/lib/candidates";
import type { CandidateId } from "@/lib/candidates";
import type { ResultsPayload, VoteRecord } from "@/lib/types";

type ApiResponse = ResultsPayload & {
  yourVote?: VoteRecord;
  message?: string;
};

type ConfettiPiece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
};

const defaultResults: ResultsPayload = {
  totalVotes: 0,
  leaderboard: CANDIDATES.map((candidate) => ({
    candidate: candidate.id,
    name: candidate.name,
    color: candidate.color,
    accent: candidate.accent,
    votes: 0
  })),
  votes: []
};

const storageKey = "commerce-monitor-last-vote";

export default function Home() {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [candidate, setCandidate] = useState<CandidateId | "">("");
  const [results, setResults] = useState<ResultsPayload>(defaultResults);
  const [showResults, setShowResults] = useState(false);
  const [yourVote, setYourVote] = useState<VoteRecord | undefined>();
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const confettiRef = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    const savedVote = window.localStorage.getItem(storageKey);

    if (savedVote) {
      try {
        setYourVote(JSON.parse(savedVote) as VoteRecord);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const matchingVote = useMemo(() => {
    const normalizedRollNumber = rollNumber.trim().toUpperCase();

    if (!normalizedRollNumber) {
      return yourVote;
    }

    return (
      results.votes.find((vote) => vote.rollNumber.toUpperCase() === normalizedRollNumber) ?? yourVote
    );
  }, [results.votes, rollNumber, yourVote]);

  function drawConfetti() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    confettiRef.current = confettiRef.current
      .map((piece) => ({
        ...piece,
        x: piece.x + piece.vx,
        y: piece.y + piece.vy,
        vy: piece.vy + 0.18,
        rotation: piece.rotation + piece.spin,
        life: piece.life - 1
      }))
      .filter((piece) => piece.life > 0 && piece.y < canvas.height + 40);

    confettiRef.current.forEach((piece) => {
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
      context.restore();
    });

    if (confettiRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(drawConfetti);
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function burstConfetti() {
    const colors = ["#0f766e", "#f59e0b", "#ef4444", "#2563eb", "#7c3aed", "#111827"];
    const width = window.innerWidth;
    const startX = width / 2;
    const startY = Math.min(window.innerHeight * 0.28, 240);

    confettiRef.current = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;

      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 6 + Math.random() * 8,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 90 + Math.random() * 45
      };
    });

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    drawConfetti();
  }

  async function loadResults() {
    setIsLoadingResults(true);
    setStatus("");

    try {
      const response = await fetch("/api/votes", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to load results.");
      }

      setResults(payload);
      setShowResults(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load results.");
    } finally {
      setIsLoadingResults(false);
    }
  }

  async function submitVote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          rollNumber,
          candidate
        })
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok && response.status !== 409) {
        throw new Error(payload.message ?? "Unable to submit vote.");
      }

      setResults(payload);
      setShowResults(true);

      if (payload.yourVote) {
        setYourVote(payload.yourVote);
        window.localStorage.setItem(storageKey, JSON.stringify(payload.yourVote));
      }

      if (response.status === 409) {
        setStatus(payload.message ?? "This roll number has already voted.");
      } else {
        const recordedCandidate = payload.yourVote?.candidate ?? candidate;
        setStatus(
          recordedCandidate
            ? `Vote recorded for ${getCandidateName(recordedCandidate)}.`
            : "Vote recorded."
        );
        burstConfetti();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit vote.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const topVoteCount = Math.max(1, ...results.leaderboard.map((item) => item.votes));

  return (
    <main className="page-shell">
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <section className="title-band" aria-labelledby="page-title">
        <div className="title-mark">
          <Vote size={32} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Class Election</p>
          <h1 id="page-title">Welcome Coders for Voting 2026-27 11th Commerce Monitor</h1>
        </div>
      </section>

      <section className="voting-grid">
        <form className="ballot-panel" onSubmit={submitVote}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ballot</p>
              <h2>Cast Vote</h2>
            </div>
            <span className="vote-count">{results.totalVotes} votes</span>
          </div>

          <div className="field-row">
            <label htmlFor="name">Enter Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              required
            />
          </div>

          <div className="field-row">
            <label htmlFor="rollNumber">Roll Number</label>
            <input
              id="rollNumber"
              name="rollNumber"
              type="text"
              value={rollNumber}
              onChange={(event) => setRollNumber(event.target.value)}
              autoComplete="off"
              maxLength={30}
              required
            />
          </div>

          <fieldset className="candidate-field">
            <legend>Choose Student</legend>
            <div className="candidate-options">
              {CANDIDATES.map((student) => (
                <label
                  className="candidate-option"
                  data-selected={candidate === student.id}
                  key={student.id}
                  style={
                    {
                      "--candidate-color": student.color,
                      "--candidate-accent": student.accent
                    } as React.CSSProperties
                  }
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={student.id}
                    checked={candidate === student.id}
                    onChange={() => setCandidate(student.id)}
                    required
                  />
                  <span className="candidate-avatar">{student.name.slice(0, 1)}</span>
                  <span>{student.name}</span>
                  <CheckCircle2 className="candidate-check" size={20} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="actions">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              <Send size={18} aria-hidden="true" />
              {isSubmitting ? "Submitting" : "Submit Vote"}
            </button>
            <button className="secondary-button" type="button" onClick={loadResults} disabled={isLoadingResults}>
              <BarChart3 size={18} aria-hidden="true" />
              {isLoadingResults ? "Loading" : "View Result"}
            </button>
          </div>

          {status ? <p className="status-line">{status}</p> : null}
        </form>

        <aside className="results-panel" aria-live="polite">
          {showResults ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Result</p>
                  <h2>Leaderboard</h2>
                </div>
                <Medal size={28} aria-hidden="true" />
              </div>

              <ol className="leaderboard">
                {results.leaderboard.map((item, index) => (
                  <li className="leader-row" key={item.candidate}>
                    <span className="rank">{index + 1}</span>
                    <div className="leader-main">
                      <div className="leader-meta">
                        <strong>{item.name}</strong>
                        <span>{item.votes} votes</span>
                      </div>
                      <div className="meter" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(8, (item.votes / topVoteCount) * 100)}%`,
                            background: item.color
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="your-vote">
                <UserRoundCheck size={22} aria-hidden="true" />
                <div>
                  <p>Your Vote</p>
                  <strong>
                    {matchingVote ? getCandidateName(matchingVote.candidate) : "No vote found"}
                  </strong>
                </div>
              </div>

              <div className="vote-table-wrap">
                <div className="table-title">Who Voted Who</div>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll No.</th>
                      <th>Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.votes.length ? (
                      results.votes.map((vote) => (
                        <tr key={vote.id}>
                          <td>{vote.name}</td>
                          <td>{vote.rollNumber}</td>
                          <td>{getCandidateName(vote.candidate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>No votes yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="result-placeholder" aria-hidden="true">
              <BarChart3 size={72} />
            </div>
          )}
        </aside>
      </section>

      <footer className="credit-footer">Made with love by ABHI</footer>
    </main>
  );
}
