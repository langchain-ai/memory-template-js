import { describe, it, expect } from "@jest/globals";
import { MemoryStore } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { builder } from "../src/memory_graph/graph.js";

describe("Memory Graph", () => {
  const userSchema = {
    type: "object",
    properties: {
      preferredName: { type: "string" },
      currentAge: { type: "string" },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "Various skills the user has.",
      },
      favoriteFoods: {
        type: "array",
        items: { type: "string" },
      },
      lastUpdated: { type: "string", format: "date-time" },
      coreMemories: {
        type: "array",
        items: { type: "string" },
        description:
          "Important events and memories that shape the user's identity.",
      },
      topicsDiscussed: {
        type: "array",
        items: { type: "string" },
        description: "topics the user has discussed previously",
      },
      otherPreferences: {
        type: "array",
        items: { type: "string" },
        description:
          "Other preferences the user has expressed that informs how you should interact with them.",
      },
      relationships: {
        type: "array",
        items: { type: "string" },
        description:
          "Store information about friends, family members, coworkers, and other important relationships the user has here. Include relevant information about them.",
      },
    },
  };

  const relationshipSchema = {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The legal name of the person.",
      },
      preferredName: {
        type: "string",
        description: "The name of the person in the relationship",
      },
      relationToUser: {
        type: "string",
        description:
          "The type of relationship (e.g., friend, sister, brother, grandmother, colleague)",
      },
      recentInteractions: {
        type: "array",
        items: { type: "string" },
        description: "List of recent interactions with this person",
      },
      notes: {
        type: "string",
        description:
          "Other important information about this individual and how they relate to the user.",
      },
    },
    required: [
      "name",
      "preferredName",
      "relationToUser",
      "recentInteractions",
      "notes",
    ],
  };

  it("should patch memory", async () => {
    const memStore = new MemoryStore();
    const memFunc = {
      name: "User",
      description: "Store all important information about a user here.",
      parameters: userSchema,
      systemPrompt: "",
      updateMode: "patch",
    };
    const threadId = uuidv4();
    const userId = "my-test-user";
    const config = {
      configurable: {
        memoryTypes: [memFunc],
        threadId: threadId,
        userId: userId,
      },
    };

    const graph = builder.compile({ store: memStore });
    await graph.invoke(
      {
        messages: [
          { role: "user", content: "My name is Bob. I like fun things" },
        ],
      },
      config,
    );

    const namespace = [userId, "user_states", "User"];
    let memories = await memStore.search(namespace);
    expect(memories.length).toBe(1);
    expect(memories[0].value.preferredName).toBe("Bob");

    await graph.invoke(
      {
        messages: [
          {
            role: "user",
            content: "Even though my name is Bob, I prefer to go by Robert.",
          },
        ],
      },
      config,
    );

    memories = await memStore.search(namespace);
    expect(memories.length).toBe(1);
    expect(memories[0].value.preferredName).toBe("Robert");

    const badNamespace = ["user_states", "my-bad-test-user", "User"];
    memories = await memStore.search(badNamespace);
    expect(memories.length).toBe(0);
  });

  it("should insert memory", async () => {
    const memStore = new MemoryStore();
    const memFunc = {
      name: "Relationship",
      description:
        "A relationship memory type for insertion. Call for each distinct individual the user interacts with.",
      parameters: relationshipSchema,
      systemPrompt:
        "Extract all relationships mentioned. Call Relationship once per-relationship.",
      updateMode: "insert",
    };
    const threadId = uuidv4();
    const userId = "my-test-user";
    const config = {
      configurable: {
        memoryTypes: [memFunc],
        threadId: threadId,
        userId: userId,
      },
    };

    const messages = [
      {
        role: "user",
        content:
          "I've been thinking about my old friend Joanne Steine lately. We met in 3rd grade and were inseparable for years.",
      },
      {
        role: "assistant",
        content:
          "It's nice that you're reminiscing about your childhood friend Joanne. Friendships from that age can be very special. How are things between you two now?",
      },
      {
        role: "user",
        content:
          "Well, that's the thing. We've been drifting apart over the years. It's sad, but I guess it happens sometimes.",
      },
      {
        role: "assistant",
        content:
          "I'm sorry to hear that you and Joanne have been drifting apart. It's true that relationships can change over time. Is there anything specific that's contributed to the distance between you?",
      },
      {
        role: "user",
        content:
          "Not really, just life getting in the way I suppose. But you know, it makes me even more grateful for my friend Anthony. Despite living far apart, we still manage to stay connected.",
      },
      {
        role: "assistant",
        content:
          "It's wonderful that you have a friend like Anthony who you can maintain a strong connection with despite the distance. Long-lasting friendships like that are truly valuable. How do you and Anthony manage to stay close?",
      },
      {
        role: "user",
        content:
          "We make an effort to call each other regularly and share important moments in our lives. It's not always easy, but it's worth it.",
      },
    ];

    const graph = builder.compile({ store: memStore });
    await graph.invoke({ messages }, config);

    const namespace = [userId, "events", "Relationship"];
    console.log("FOOOO");
    console.dir(memStore);
    const memories = await memStore.search(namespace);
    expect(memories.length).toBeGreaterThan(1);

    const joanneRelationship = memories.find((mem) =>
      mem.value.name.includes("Joanne"),
    );
    expect(joanneRelationship).toBeDefined();
    expect(joanneRelationship?.value.relationToUser).toContain("friend");

    const anthonyRelationship = memories.find((mem) =>
      mem.value.name.includes("Anthony"),
    );
    expect(anthonyRelationship).toBeDefined();
    expect(anthonyRelationship?.value.relationToUser).toContain("friend");
  });
});
