export const lifecycleStages = ["onboarding", "active", "suspended", "closed"] as const;
export type LifecycleStage = (typeof lifecycleStages)[number];

export type KnowledgeAnswer = {
  documentId: string;
  title: string;
  guidance: string;
  stage: LifecycleStage;
  confidence: number;
};

export type AdminDecision = {
  action: "reply" | "admin_review";
  answer: KnowledgeAnswer;
  note: string;
};

export function decideAdminAction(answer: KnowledgeAnswer): AdminDecision {
  const needsReview = answer.stage === "suspended" || answer.stage === "closed";
  return {
    action: needsReview ? "admin_review" : "reply",
    answer,
    note: needsReview
      ? "An admin must confirm the account state before this procedure is applied."
      : "The operations team can follow this procedure directly."
  };
}
