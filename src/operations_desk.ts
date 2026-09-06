import express from "express";
import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { KnowledgeAssistant } from "./knowledge_assistant.js";

const requestSchema = z.object({
  tenantId: z.string().min(1).max(80),
  question: z.string().min(8).max(500)
}).strict();

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const app = express();
app.use(express.json({ limit: "16kb" }));
const assistant = new KnowledgeAssistant(
  new InfraiClient(apiKey),
  process.env.INFRAI_COLLECTION ?? "saas-operations"
);

app.post("/ask", async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
    return;
  }

  try {
    const decision = await assistant.answer(parsed.data.question, parsed.data.tenantId);
    if (!decision) {
      response.status(404).json({ error: "no_matching_procedure" });
      return;
    }
    response.json(decision);
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.status(error.status).json({ error: error.code, details: error.details });
      return;
    }
    response.status(502).json({ error: "knowledge_service_unavailable" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Operations desk listening on http://localhost:${port}`));
