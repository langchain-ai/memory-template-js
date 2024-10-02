import { Annotation, LangGraphRunnableConfig } from "@langchain/langgraph";
import { SYSTEM_PROMPT } from "./prompts.js";

type UpdateMode = "patch" | "insert";

interface MemoryConfig {
  tool: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  };
  systemPrompt: string;
  updateMode: UpdateMode;
}

export const ConfigurationAnnotation = Annotation.Root({
  userId: Annotation<string>,
  model: Annotation<string>,
  memoryTypes: Annotation<MemoryConfig[]>,
});

export const ensureConfiguration = (
  config: LangGraphRunnableConfig,
): typeof ConfigurationAnnotation.State => {
  const configurable = config?.configurable || {};
  const values: typeof ConfigurationAnnotation.State = {
    userId: configurable.userId || process.env.USER_ID,
    model: configurable.model || process.env.MODEL,
    memoryTypes: configurable.memoryTypes
      ? configurable.memoryTypes.map(
          (v: any): MemoryConfig => ({
            tool: {
              type: "function",
              function: {
                name: v.name,
                description: v.description,
                parameters: v.parameters,
              },
            },
            systemPrompt: v.systemPrompt,
            updateMode: v.updateMode,
          }),
        )
      : DEFAULT_MEMORY_CONFIGS,
  };
  return values;
};

const DEFAULT_MEMORY_CONFIGS: MemoryConfig[] = [
  {
    tool: {
      type: "function",
      function: {
        name: "User",
        description:
          "Update this document to maintain up-to-date information about the user in the conversation.",
        parameters: {
          type: "object",
          properties: {
            user_name: {
              type: "string",
              description: "The user's preferred name",
            },
            age: { type: "integer", description: "The user's age" },
            interests: {
              type: "array",
              items: { type: "string" },
              description: "A list of the user's interests",
            },
            home: {
              type: "string",
              description:
                "Description of the user's home town/neighborhood, etc.",
            },
            occupation: {
              type: "string",
              description: "The user's current occupation or profession",
            },
            conversation_preferences: {
              type: "array",
              items: { type: "string" },
              description:
                "A list of the user's preferred conversation styles, pronouns, topics they want to avoid, etc.",
            },
          },
        },
      },
    },
    systemPrompt: SYSTEM_PROMPT,
    updateMode: "patch",
  },
  {
    tool: {
      type: "function",
      function: {
        name: "Note",
        description:
          "Save notable memories the user has shared with you for later recall.",
        parameters: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description:
                "The situation or circumstance where this memory may be relevant. " +
                "Include any caveats or conditions that contextualize the memory. " +
                "For example, if a user shares a preference, note if it only applies " +
                "in certain situations (e.g., 'only at work'). Add any other relevant " +
                "'meta' details that help fully understand when and how to use this memory.",
            },
            content: {
              type: "string",
              description:
                "The specific information, preference, or event being remembered.",
            },
          },
          required: ["context", "content"],
        },
      },
    },
    systemPrompt: SYSTEM_PROMPT,
    updateMode: "insert",
  },
];

export { type MemoryConfig, DEFAULT_MEMORY_CONFIGS };
