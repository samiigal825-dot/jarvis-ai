import { ChatOpenAI } from "@langchain/openai";

async function test() {
  const model = new ChatOpenAI({
    modelName: "openai",
    apiKey: "dummy-key",
    configuration: {
      baseURL: "https://text.pollinations.ai/openai/"
    }
  });

  const stream = await model.stream("mujhe web app du craete karke");
  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }
}
test();
