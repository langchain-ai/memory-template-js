import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  mergeMessageRuns,
} from "@langchain/core/messages";
import { BaseStore, LangGraphRunnableConfig } from "@langchain/langgraph";
import { initChatModel } from "langchain/chat_models/universal";

/**
 * Get the store from the configuration or throw an error.
 */
export function getStoreFromConfigOrThrow(
  config: LangGraphRunnableConfig,
): BaseStore {
  if (!config.store) {
    throw new Error("Store not found in configuration");
  }

  return config.store;
}

/**
 * Merge message runs and add instructions before and after to stay on task.
 */
export function prepareMessages(
  messages: BaseMessage[],
  systemPrompt: string,
): BaseMessage[] {
  const sys: SystemMessage = new SystemMessage({
    content: `${systemPrompt}

<memory-system>Reflect on following interaction. Use the provided tools to retain any necessary memories about the user. Use parallel/multi-tool calling to extract the appropriate number of memories if multiple are required.</memory-system>
`,
  });

  const msg: HumanMessage = new HumanMessage({
    content:
      "## End of conversation\n\n<memory-system>Reflect on the interaction above. What memories ought to be retained or updated?</memory-system>",
  });

  return mergeMessageRuns([sys, ...messages, msg]);
}

/**
 * Initialize the configured chat model.
 */
export async function initModel(
  fullySpecifiedName: string,
): Promise<BaseChatModel> {
  let provider: string | undefined;
  let model: string;

  if (fullySpecifiedName.includes("/")) {
    [provider, model] = fullySpecifiedName.split("/", 2);
  } else {
    model = fullySpecifiedName;
  }

  return await initChatModel(model, {
    modelProvider: provider,
  });
}
