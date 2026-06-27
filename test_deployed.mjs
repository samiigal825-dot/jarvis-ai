import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/langgraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "mujhe web app du craete karke" }]
      })
    });
    
    console.log("STATUS:", res.status);
    
    if (!res.body) return;
    const decoder = new TextDecoder();
    for await (const chunk of res.body) {
      console.log("CHUNK:", decoder.decode(chunk));
    }
  } catch (err) {
    console.log("ERROR:", err);
  }
}
test();
