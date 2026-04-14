export function searchMessages(messages, query) {
  if (!query) return messages;
  const q = query.toLowerCase();

  return messages.filter(m =>
    m.content.toLowerCase().includes(q)
  );
}
