// Define utility functions for your graph.

interface Memory {
  value: any;
  updated_at: string;
}

/**
 * Format the user's memories.
 */
export function formatMemories(memories: Memory[] | null | undefined): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  // Note Bene: You can format better than this....
  const formattedMemories = memories
    .map((m) => `${String(m.value)}\tLast updated: ${m.updated_at}`)
    .join("\n");

  return `

## Memories

You have noted the following memorable events from previous interactions with the user.
<memories>
${formattedMemories}
</memories>
`;
}
