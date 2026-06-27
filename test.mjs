import fetch from 'node-fetch';

async function test() {
  const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "user", content: "hello" }],
      stream: true
    })
  });
  
  const text = await res.text();
  console.log("RESPONSE:", text);
}
test();
