import { InfraiClient } from "../src/infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before seeding the collection");

const collection = process.env.INFRAI_COLLECTION ?? "saas-operations";
const documents = [
  {
    id: "onboarding-domain-check",
    title: "Verify a tenant domain during onboarding",
    guidance: "Match the submitted domain to the billing contact, then mark domain verification complete in the tenant checklist.",
    stage: "onboarding"
  },
  {
    id: "active-admin-handoff",
    title: "Transfer the primary admin on an active account",
    guidance: "Confirm both admin identities, record the request ticket, and transfer primary admin ownership before removing old access.",
    stage: "active"
  },
  {
    id: "suspended-account-review",
    title: "Review an account that is suspended",
    guidance: "Keep access disabled while an admin verifies the suspension reason and records the approved next account state.",
    stage: "suspended"
  }
] as const;

const client = new InfraiClient(apiKey);
const embeddings = await client.embed(documents.map((document) =>
  `${document.title}\n${document.guidance}`
));
await client.createCollection(collection, embeddings[0].length);
await client.upsert(collection, documents.map((document, index) => ({
  id: document.id,
  embedding: embeddings[index],
  metadata: {
    title: document.title,
    guidance: document.guidance,
    stage: document.stage
  }
})));
console.log(`Seeded ${documents.length} tenant procedures into ${collection}.`);
