export type CanonicalModel = {
  provider: string;
  id: string;
  display: string;
};

export type AgentConfig = {
  provider: string;
  baseUrl: string;
  model: string;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AgentRequest = {
  input: string;
  projectDir: string;
  sessionId?: string;
};

export type AgentResponse = {
  message: string;
  model: CanonicalModel;
  usage?: any;
};
