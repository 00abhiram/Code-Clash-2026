"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProblemPanelProps {
  title: string;
  description: string;
  language: string;
  difficulty: string;
  questionType?: string;
}

export default function ProblemPanel({
  title,
  description,
  language,
  difficulty,
  questionType,
}: ProblemPanelProps) {
  const difficultyColor = {
    easy: "text-success bg-success/10",
    medium: "text-warning bg-warning/10",
    hard: "text-danger bg-danger/10",
  }[difficulty] || "text-gray-400 bg-gray-400/10";

  const typeColor =
    questionType === "TDD"
      ? "text-primary-light bg-primary/10"
      : "text-accent bg-accent/10";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className={`px-2 py-0.5 rounded-full font-medium ${difficultyColor}`}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </span>
          {questionType && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
              {questionType === "TDD" ? "Test-Driven" : "Debugging"}
            </span>
          )}
          <span className="text-gray-400">Language: {language}</span>
        </div>
      </div>

      <div className="prose prose-invert max-w-none">
        <div className="markdown-body text-gray-300 leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {description}
          </ReactMarkdown>
        </div>
      </div>

      <style jsx>{`
        .markdown-body :global(h1) {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: var(--foreground);
        }
        .markdown-body :global(h2) {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: var(--foreground);
        }
        .markdown-body :global(h3) {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: var(--foreground);
        }
        .markdown-body :global(p) {
          margin-bottom: 0.75rem;
        }
        .markdown-body :global(ul),
        .markdown-body :global(ol) {
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }
        .markdown-body :global(li) {
          margin-bottom: 0.25rem;
        }
        .markdown-body :global(code) {
          background: var(--surface);
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
          font-family: var(--font-mono), monospace;
        }
        .markdown-body :global(pre) {
          background: var(--surface);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .markdown-body :global(pre code) {
          background: none;
          padding: 0;
        }
        .markdown-body :global(blockquote) {
          border-left: 3px solid var(--primary-light);
          padding-left: 1rem;
          margin-bottom: 0.75rem;
          color: #9ca3af;
        }
        .markdown-body :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }
        .markdown-body :global(th),
        .markdown-body :global(td) {
          border: 1px solid var(--border);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .markdown-body :global(th) {
          background: var(--surface);
          font-weight: 600;
        }
        .markdown-body :global(strong) {
          color: var(--foreground);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
