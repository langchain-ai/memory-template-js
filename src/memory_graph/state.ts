import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Main graph state.
 */
export const GraphAnnotation = Annotation.Root({
  /**
   * The messages in the conversation.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

/**
 * Extractor state.
 */
export const ProcessorAnnotation = Annotation.Root({
  ...GraphAnnotation.spec,
  functionName: Annotation<string>,
});
