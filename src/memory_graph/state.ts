import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Main graph state.
 */
export const GraphAnnotation = Annotation.Root({
  /**
   * The messages in the conversation.
   */
  ...MessagesAnnotation.spec,
});

/**
 * Extractor state.
 */
export const ProcessorAnnotation = Annotation.Root({
  ...GraphAnnotation.spec,
  functionName: Annotation<string>,
});
