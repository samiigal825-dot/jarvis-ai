import fetch from 'node-fetch';

async function test() {
  const res = await fetch("https://text.pollinations.ai/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "user", content: "mujhe web app du craete karke" }],
      temperature: 0.5
    })
  });
  
  const text = await res.text();
  console.log("RESPONSE:", text);
}
test();
