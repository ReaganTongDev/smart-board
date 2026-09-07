import React from "react";
import { CheckSquare, Square } from "lucide-react";

interface MarkdownViewProps {
  content: string | null | undefined;
  onToggleChecklist?: (newContent: string) => void;
  className?: string;
  compact?: boolean;
}

export function MarkdownView({
  content,
  onToggleChecklist,
  className = "",
  compact = false,
}: MarkdownViewProps) {
  if (!content || !content.trim()) return null;

  const lines = content.split("\n");

  // Count total checklist items
  let totalChecklist = 0;
  let completedChecklist = 0;
  lines.forEach((l) => {
    if (/^\s*[-*]\s*\[[ xX]\]/.test(l)) {
      totalChecklist++;
      if (/^\s*[-*]\s*\[[xX]\]/.test(l)) completedChecklist++;
    }
  });

  const handleToggle = (lineIndex: number) => {
    if (!onToggleChecklist) return;
    const newLines = [...lines];
    const targetLine = newLines[lineIndex];
    if (/^\s*[-*]\s*\[ \]/.test(targetLine)) {
      newLines[lineIndex] = targetLine.replace(/(\s*[-*]\s*\[) (\])/, "$1x$2");
    } else if (/^\s*[-*]\s*\[[xX]\]/.test(targetLine)) {
      newLines[lineIndex] = targetLine.replace(/(\s*[-*]\s*\[)[xX](\])/, "$1 $2");
    }
    onToggleChecklist(newLines.join("\n"));
  };

  // Helper to parse inline bold, italic, code, links
  const renderInline = (text: string): React.ReactNode => {
    // Split by code, bold, link
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Inline code: `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Bold: **bold**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Italic: *italic*
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
      // Link: [label](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);

      // Find first occurrence
      const matches = [
        { type: "code", match: codeMatch, index: codeMatch?.index ?? -1 },
        { type: "bold", match: boldMatch, index: boldMatch?.index ?? -1 },
        { type: "italic", match: italicMatch, index: italicMatch?.index ?? -1 },
        { type: "link", match: linkMatch, index: linkMatch?.index ?? -1 },
      ]
        .filter((m) => m.match && m.index >= 0)
        .sort((a, b) => a.index - b.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0];
      const matchStart = first.index;
      const matchLength = first.match![0].length;

      // Append text before match
      if (matchStart > 0) {
        parts.push(remaining.slice(0, matchStart));
      }

      if (first.type === "code") {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 font-mono text-[11px] text-violet-300"
          >
            {first.match![1]}
          </code>
        );
      } else if (first.type === "bold") {
        parts.push(
          <strong key={key++} className="font-semibold text-slate-100">
            {first.match![1]}
          </strong>
        );
      } else if (first.type === "italic") {
        parts.push(
          <em key={key++} className="italic text-slate-300">
            {first.match![1]}
          </em>
        );
      } else if (first.type === "link") {
        parts.push(
          <a
            key={key++}
            href={first.match![2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {first.match![1]}
          </a>
        );
      }

      remaining = remaining.slice(matchStart + matchLength);
    }

    return <>{parts}</>;
  };

  return (
    <div className={`space-y-1.5 text-xs text-slate-300 leading-relaxed ${className}`}>
      {/* Progress indicator if checklists exist */}
      {totalChecklist > 0 && !compact && (
        <div className="mb-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Tasks Checklist</span>
            <span className="font-medium text-violet-400">
              {completedChecklist}/{totalChecklist} (
              {Math.round((completedChecklist / totalChecklist) * 100)}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300 rounded-full"
              style={{
                width: `${(completedChecklist / totalChecklist) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Checklist item: - [ ] or - [x]
        const checklistMatch = line.match(/^(\s*)[-*]\s*\[([ xX])\]\s*(.*)$/);
        if (checklistMatch) {
          const isChecked = checklistMatch[2].toLowerCase() === "x";
          const text = checklistMatch[3];
          const indent = checklistMatch[1].length;

          return (
            <div
              key={idx}
              style={{ marginLeft: `${indent * 8}px` }}
              className={`flex items-start gap-2 py-0.5 group ${
                onToggleChecklist ? "cursor-pointer select-none" : ""
              }`}
              onClick={(e) => {
                if (onToggleChecklist) {
                  e.stopPropagation();
                  handleToggle(idx);
                }
              }}
            >
              <button
                type="button"
                className="mt-0.5 text-slate-500 hover:text-violet-400 transition-colors shrink-0"
                aria-label={isChecked ? "Uncheck item" : "Check item"}
              >
                {isChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-violet-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                )}
              </button>
              <span
                className={`flex-1 ${
                  isChecked
                    ? "line-through text-slate-500"
                    : "text-slate-200"
                }`}
              >
                {renderInline(text)}
              </span>
            </div>
          );
        }

        // Heading 1: # Title
        if (line.startsWith("# ")) {
          return (
            <h4
              key={idx}
              className="font-bold text-slate-100 text-sm mt-2 mb-1 pb-0.5 border-b border-slate-800"
            >
              {renderInline(line.slice(2))}
            </h4>
          );
        }

        // Heading 2: ## Subtitle
        if (line.startsWith("## ")) {
          return (
            <h5
              key={idx}
              className="font-semibold text-slate-200 text-xs mt-1.5 mb-0.5 text-violet-300"
            >
              {renderInline(line.slice(3))}
            </h5>
          );
        }

        // Heading 3: ### Section
        if (line.startsWith("### ")) {
          return (
            <h6 key={idx} className="font-medium text-slate-300 text-xs mt-1">
              {renderInline(line.slice(4))}
            </h6>
          );
        }

        // Blockquote: > text
        if (line.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-violet-500/60 pl-2.5 my-1 text-slate-400 italic text-[11px]"
            >
              {renderInline(line.slice(2))}
            </blockquote>
          );
        }

        // Bullet point: - text or * text
        if (/^\s*[-*]\s+/.test(line)) {
          const text = line.replace(/^\s*[-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 mt-1.5 shrink-0" />
              <span className="text-slate-300">{renderInline(text)}</span>
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={idx} className="text-slate-300">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/** Helper to extract quick checklist summary: e.g. "2/4" */
export function getChecklistSummary(content: string | null | undefined): {
  total: number;
  completed: number;
} | null {
  if (!content) return null;
  const lines = content.split("\n");
  let total = 0;
  let completed = 0;
  for (const l of lines) {
    if (/^\s*[-*]\s*\[[ xX]\]/.test(l)) {
      total++;
      if (/^\s*[-*]\s*\[[xX]\]/.test(l)) completed++;
    }
  }
  return total > 0 ? { total, completed } : null;
}
