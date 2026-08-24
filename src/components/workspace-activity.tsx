"use client";

import { useState } from "react";
import { ArrowUpRight, Clock3, FolderOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";

export interface WorkspaceActivityItem {
  id: string;
  title: string;
  meta: string;
  href: string;
}

interface WorkspaceActivityProps {
  items: WorkspaceActivityItem[];
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptySubtitle: string;
  openLabel: string;
  showAllLabel: string;
  showLessLabel: string;
}

/** A compact, reusable list for data-backed workspace activity. */
export function WorkspaceActivity({
  items,
  title,
  subtitle,
  emptyTitle,
  emptySubtitle,
  openLabel,
  showAllLabel,
  showLessLabel,
}: WorkspaceActivityProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 4);

  return (
    <section aria-labelledby="workspace-activity-title" className="min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="workspace-activity-title" className="text-[21px] font-extrabold tracking-wide text-indigo-900">
            {title}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        <Clock3 aria-hidden="true" className="mb-1 size-5 shrink-0 text-coral-700" />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card">
        {visibleItems.length > 0 ? (
          <ul id="workspace-activity-list" className="divide-y divide-neutral-100">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-indigo-50/60 sm:px-5"
                  aria-label={openLabel.replace("{title}", item.title)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                    <FolderOpen aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-indigo-900 group-hover:text-coral-700">
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{item.meta}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral-700"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center">
            <FolderOpen aria-hidden="true" className="size-6 text-neutral-400" />
            <p className="mt-2 text-[13px] font-bold text-indigo-900">{emptyTitle}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{emptySubtitle}</p>
          </div>
        )}
        {items.length > 4 && (
          <div className="border-t border-neutral-100 px-4 py-2.5 sm:px-5">
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
              aria-controls="workspace-activity-list"
              className="text-[12px] font-extrabold text-coral-700 hover:text-coral-800 hover:underline"
            >
              {showAll ? showLessLabel : showAllLabel}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
