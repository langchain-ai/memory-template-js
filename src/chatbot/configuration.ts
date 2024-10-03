import { Annotation, LangGraphRunnableConfig } from "@langchain/langgraph";
import { SYSTEM_PROMPT } from "./prompts.js";

export const ConfigurationAnnotation = Annotation.Root({
  userId: Annotation<string>,
  memAssistantId: Annotation<string>,
  delaySeconds: Annotation<number>,
  systemPrompt: Annotation<string>,
  model: Annotation<string>,
  memoryTypes: Annotation<Record<string, unknown>[] | undefined>,
});

const DEFAULT_CHATBOT_CONFIG: typeof ConfigurationAnnotation.State = {
  systemPrompt: SYSTEM_PROMPT,
  // Remove this default in production
  userId: "default-user",
  memAssistantId: "memory_graph",
  model: "claude-3-5-sonnet-20240620",
  delaySeconds: 10,
  memoryTypes: undefined,
};

export const ensureConfiguration = (
  config: LangGraphRunnableConfig,
): typeof ConfigurationAnnotation.State => {
  const configurable = config?.configurable || {};
  const values: typeof ConfigurationAnnotation.State = {
    systemPrompt:
      configurable.systemPrompt || DEFAULT_CHATBOT_CONFIG.systemPrompt,
    userId:
      configurable.userId ||
      process.env.USER_ID ||
      DEFAULT_CHATBOT_CONFIG.userId,
    memAssistantId:
      configurable.memAssistantId || DEFAULT_CHATBOT_CONFIG.memAssistantId,
    model:
      configurable.model || process.env.MODEL || DEFAULT_CHATBOT_CONFIG.model,
    delaySeconds:
      configurable.delaySeconds || DEFAULT_CHATBOT_CONFIG.delaySeconds,
    memoryTypes: configurable.memoryTypes || DEFAULT_CHATBOT_CONFIG.memoryTypes,
  };
  return values;
};
