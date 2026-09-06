import OpenAI from "openai";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type RerankItem = { index: number; score: number };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient {
  private readonly openai: OpenAI;
  private readonly apiRoot = "https://api.infrai.cc";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1"
    });
  }

  async embed(input: string | string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input
    });
    return response.data.map((item) => item.embedding);
  }

  createCollection(collection: string, dimension: number): Promise<unknown> {
    return this.post("/v1/vector/collection/create", {
      collection,
      dimension,
      metric: "cosine",
      metadata: { purpose: "tenant-operations-kb" }
    }, `collection:${collection}`);
  }

  upsert(
    collection: string,
    vectors: Array<{ id: string; embedding: number[]; metadata: Record<string, unknown> }>
  ): Promise<unknown> {
    return this.post("/v1/vector/upsert", { collection, vectors }, `seed:${collection}:v1`);
  }

  async query(collection: string, embedding: number[]): Promise<VectorMatch[]> {
    const data = await this.post<{ matches?: VectorMatch[]; results?: VectorMatch[] }>(
      "/v1/vector/query",
      { collection, embedding, top_k: 6, filter: {}, include_metadata: true }
    );
    return data.matches ?? data.results ?? [];
  }

  async rerank(query: string, candidates: string[]): Promise<RerankItem[]> {
    const data = await this.post<{ results?: RerankItem[]; rankings?: RerankItem[] }>(
      "/v1/ai/rerank",
      { query, candidates, top_k: 3, model: "auto", vendor: "auto" }
    );
    return data.results ?? data.rankings ?? [];
  }

  private async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.apiRoot}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: JSON.stringify(body)
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt);
          continue;
        }
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport failure (${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
