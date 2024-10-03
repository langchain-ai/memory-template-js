// Define utility functions for your graph.

import { Item } from "@langchain/langgraph";

/**
 * Format the user's memories.
 */
export function formatMemories(memories: Item[] | null | undefined): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  // Note Bene: You can format better than this....
  const formattedMemories = memories
    .map(
      (m) =>
        `${String(m.value)}\tLast updated: ${new Date(m.updatedAt).toDateString()}`,
    )
    .join("\n");

  return `

## Memories

You have noted the following memorable events from previous interactions with the user.
<memories>
${formattedMemories}
</memories>
`;
}
