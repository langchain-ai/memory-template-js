import {
  LangGraphRunnableConfig,
  START,
  StateGraph,
  Send,
} from "@langchain/langgraph";

import { v4 as uuidv4 } from "uuid";
import {
  ConfigurationAnnotation,
  ensureConfiguration,
} from "./configuration.js";
import { ProcessorAnnotation, GraphAnnotation } from "./state.js";
import {
  getStoreFromConfigOrThrow,
  initModel,
  prepareMessages,
} from "./utils.js";

async function handlePatchMemory(
  state: typeof ProcessorAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GraphAnnotation.State>> {
  const store = getStoreFromConfigOrThrow(config);
  const configurable = ensureConfiguration(config);
  const namespace = [configurable.userId, "user_states", state.functionName];
  const existingItem = await store.get(namespace, "memory");
  const existing = existingItem
    ? { [existingItem.key]: existingItem.value }
    : null;
  const memoryConfig = configurable.memoryTypes.find(
    (conf) => conf.tool.function.name === state.functionName,
  );

  if (!memoryConfig) {
    throw new Error(`Memory config not found for ${state.functionName}`);
  }

  const extractorTool = [
    {
      ...memoryConfig.tool,
    },
  ];
  const extractorModel = await initModel(configurable.model);
  if (!extractorModel.bindTools) {
    throw new Error("Selected model does not support tool calling.");
  }
  // Since we're passing `tool_choice`, ensure the model configured to use supports it.
  // If `tool_choice` is not supported, the model will throw an error.
  const extractor = extractorModel.bindTools(extractorTool, {
    tool_choice: memoryConfig.tool.function.name,
  });

  const preparedMessages = prepareMessages(
    state.messages,
    memoryConfig.systemPrompt,
  );
  const inputs = { messages: preparedMessages, existing };
  const result = await extractor.invoke(inputs as any, config);
  const extracted = result.tool_calls?.[0].args ?? {};

  await store.put(namespace, "memory", extracted);
  return { messages: [] };
}

async function handleInsertionMemory(
  state: typeof ProcessorAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GraphAnnotation.State>> {
  const store = getStoreFromConfigOrThrow(config);
  const configurable = ensureConfiguration(config);
  const namespace = [configurable.userId, "events", state.functionName];
  const existingItems = await store.search(namespace, { limit: 5 });
  const memoryConfig = configurable.memoryTypes.find(
    (conf) => conf.tool.function.name === state.functionName,
  );

  if (!memoryConfig) {
    throw new Error(`Memory config not found for ${state.functionName}`);
  }

  const extractorTool = [
    {
      ...memoryConfig.tool,
    },
  ];
  const extractorModel = await initModel(configurable.model);
  if (!extractorModel.bindTools) {
    throw new Error("Selected model does not support tool calling.");
  }
  const extractor = extractorModel.bindTools(extractorTool);

  const existing = existingItems
    ? existingItems.map((item) => [item.key, state.functionName, item.value])
    : undefined;
  const systemPrompt =
    memoryConfig.systemPrompt + existing
      ? `\n\nExisting items: ${JSON.stringify(existing, null, 2)}`
      : "";

  const extracted = await extractor.invoke(
    prepareMessages(state.messages, systemPrompt),
    config,
  );

  const storePromise = extracted.tool_calls?.map((r) =>
    store.put(namespace, uuidv4(), r.args),
  );
  storePromise ? await Promise.all(storePromise) : null;

  return { messages: [] };
}

function scatterSchemas(
  state: typeof GraphAnnotation.State,
  config?: LangGraphRunnableConfig,
): Send[] {
  const configurable = ensureConfiguration(config ?? {});
  const sends: Send[] = [];
  const currentState = { ...state };

  for (const v of configurable.memoryTypes) {
    const updateMode = v.updateMode;
    let target: string;

    switch (updateMode) {
      case "patch":
        target = "handlePatchMemory";
        break;
      case "insert":
        target = "handleInsertionMemory";
        break;
      default:
        throw new Error(`Unknown update mode: ${updateMode}`);
    }

    sends.push(
      new Send(target, { ...currentState, functionName: v.tool.function.name }),
    );
  }

  return sends;
}

// Create the graph + all nodes
const builder = new StateGraph(GraphAnnotation, ConfigurationAnnotation)
  .addNode("handlePatchMemory", handlePatchMemory)
  .addNode("handleInsertionMemory", handleInsertionMemory)
  .addConditionalEdges(START, scatterSchemas, [
    "handlePatchMemory",
    "handleInsertionMemory",
  ]);

export const graph = builder.compile();
