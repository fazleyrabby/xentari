export async function handleChat(input) {
  // TEMP: simple response
  return {
    type: "chat",
    message: `🤖 Xentari: I understand "${input}". What would you like to build?`
  };
}
