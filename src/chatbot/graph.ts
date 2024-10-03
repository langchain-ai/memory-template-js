import {
  LangGraphRunnableConfig,
  StateGraph,
  MessagesAnnotation,
  Annotation,
  START,
  END,
} from "@langchain/langgraph";
import { Client } from "@langchain/langgraph-sdk";
import {
  ConfigurationAnnotation,
  ensureConfiguration,
} from "./configuration.js";
import { getStoreFromConfigOrThrow, initModel } from "../memory_graph/utils.js";
import { formatMemories } from "./utils.js";

const ChatAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

/**
 * Example chatbot that incorporates user memories.
 */

/**
 * Prompt the bot to respond to the user, incorporating memories (if provided).
 * @param state - The current state of the chat.
 * @param config - The configuration for the runnable.
 * @returns A partial state update with the bot's response message.
 */
async function bot(
  state: typeof ChatAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof ChatAnnotation.State>> {
  const configurable = ensureConfiguration(config);
  const store = getStoreFromConfigOrThrow(config);
  const namespace = [configurable.userId];

  const userMemory = await store.search(namespace);

  const model = await initModel(configurable.model);
  const prompt = configurable.systemPrompt
    .replace("{user_info}", formatMemories(userMemory))
    .replace("{time}", new Date().toISOString());

  const m = await model.invoke([
    { role: "system", content: prompt },
    ...state.messages,
  ]);

  return { messages: [m] };
}

/**
 * Schedule memory generation by calling the memory graph.
 * @param state - The current state of the chat.
 * @param config - The configuration for the runnable.
 * @returns An empty object as no state update is needed.
 */
async function scheduleMemories(
  _: typeof ChatAnnotation.State,
  config: LangGraphRunnableConfig,
) {
  const configurable = ensureConfiguration(config);
  const memoryClient = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  if (!config.configurable?.thread_id) {
    throw new Error("Thread ID is required to schedule memories.");
  }

  await memoryClient.runs.create(
    config.configurable.thread_id,
    configurable.memAssistantId,
    {
      // The memory service is running in the same deployment & thread, meaning
      // it shares state with this chat bot. No content needs to be sent
      input: { messages: [] },
      config: {
        configurable: {
          // Ensure the memory service knows where to save the extracted memories
          userId: configurable.userId,
          memoryTypes: configurable.memoryTypes,
        },
      },
      // This lets us "debounce" repeated requests to the memory graph
      // if the user is actively engaging in a conversation. This saves us $$ and
      // can help reduce the occurrence of duplicate memories.
      afterSeconds: configurable.delaySeconds,
      // Specify the graph and/or graph configuration to handle the memory processing
      // This memory-formation run will be enqueued and run later
      // If a new run comes in before it is scheduled, it will be cancelled,
      // then when this node is executed again, a *new* run will be scheduled
      multitaskStrategy: "enqueue",
    },
  );
  return {};
}

const builder = new StateGraph(ChatAnnotation, ConfigurationAnnotation)
  .addNode("bot", bot)
  .addNode("scheduleMemories", scheduleMemories)
  .addEdge(START, "bot")
  .addEdge("bot", "scheduleMemories")
  .addEdge("scheduleMemories", END);

export const graph = builder.compile();
