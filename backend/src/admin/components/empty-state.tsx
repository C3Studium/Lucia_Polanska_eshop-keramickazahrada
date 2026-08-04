import { Heading, Text } from "@medusajs/ui";
import type { ReactNode } from "react";

/**
 * The one empty state used across the custom admin pages (WorkflowPlan.md §19).
 *
 * Every queue and list in this admin spends most of its life empty — that is
 * the goal, not a failure — so the empty state is a first-class screen rather
 * than a blank area. It answers two questions: is anything wrong (no), and what
 * puts something here.
 */
export type EmptyStateProps = {
  /** Czech, states the situation: „Zásoby jsou v pořádku". */
  title: string;
  /** Czech, explains what will make something appear here. */
  description?: string;
  /** Optional single next step. */
  action?: ReactNode;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="flex min-h-64 flex-col items-center justify-center gap-y-3 px-6 py-10 text-center">
    <Heading level="h2">{title}</Heading>
    {description && (
      <Text size="small" className="text-ui-fg-subtle max-w-md">
        {description}
      </Text>
    )}
    {action}
  </div>
);

/**
 * „1 kus / 3 kusy / 5 kusů" — Czech counts three ways, and a threshold line
 * that reads „5 kusy" looks like a bug to the person reading it.
 */
export const pieces = (count: number): string => {
  if (count === 1) {
    return "1 kus";
  }
  if (count >= 2 && count <= 4) {
    return `${count} kusy`;
  }
  return `${count} kusů`;
};
