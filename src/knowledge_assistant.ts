import { InfraiClient } from "./infrai_client.js";
import {
  decideAdminAction,
  lifecycleStages,
  type AdminDecision,
  type KnowledgeAnswer,
  type LifecycleStage
} from "./lifecycle_decision.js";

const isStage = (value: unknown): value is LifecycleStage =>
  typeof value === "string" && lifecycleStages.includes(value as LifecycleStage);

export class KnowledgeAssistant {
  private readonly infrai: InfraiClient;
  private readonly collection: string;

  constructor(infrai: InfraiClient, collection: string) {
    this.infrai = infrai;
    this.collection = collection;
  }

  async answer(question: string, tenantId: string): Promise<AdminDecision | null> {
    const [embedding] = await this.infrai.embed(question);
    const matches = await this.infrai.query(this.collection, embedding);
    const documents = matches.flatMap((match) => {
      const metadata = match.metadata;
      if (
        typeof metadata?.title !== "string" ||
        typeof metadata.guidance !== "string" ||
        !isStage(metadata.stage)
      ) return [];
      return [{ match, title: metadata.title, guidance: metadata.guidance, stage: metadata.stage }];
    });
    if (documents.length === 0) return null;

    const rankings = await this.infrai.rerank(
      `${question}\nTenant: ${tenantId}`,
      documents.map((document) => `${document.title}\n${document.guidance}`)
    );
    const top = rankings[0];
    const selected = documents[top?.index ?? 0];
    if (!selected) return null;

    const answer: KnowledgeAnswer = {
      documentId: selected.match.id,
      title: selected.title,
      guidance: selected.guidance,
      stage: selected.stage,
      confidence: top?.score ?? selected.match.score
    };
    return decideAdminAction(answer);
  }
}
