"use client";

import { ReactNode } from "react";

const linkPattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s]+)/g;

function renderLine(line: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  linkPattern.lastIndex = 0;

  while ((match = linkPattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const href = match[3] ?? match[4];
    const label = match[2] ?? href;

    nodes.push(
      <a
        key={`${href}-${partIndex}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-rose-600 underline decoration-rose-300 underline-offset-4 transition hover:text-rose-700"
      >
        {label}
      </a>,
    );

    lastIndex = linkPattern.lastIndex;
    partIndex += 1;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  if (nodes.length === 0) {
    return <span>&nbsp;</span>;
  }

  return nodes;
}

export function AnnouncementRichText({ content }: { content: string }) {
  return (
    <div className="space-y-1.5">
      {content.split(/\r?\n/).map((line, index) => (
        <p key={`announcement-line-${index}`} className="min-h-[1.25rem] break-words leading-6">
          {renderLine(line)}
        </p>
      ))}
    </div>
  );
}
