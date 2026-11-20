import { env, aiEnabled } from "@/lib/env";
import { expandToken, stem, tokenize } from "@/lib/ai/synonyms";

/**
 * Vectors for semantic retrieval.
 *
 * - Local mode (default): deterministic TF-weighted lexical vectors with
 *   synonym-group expansion — real retrieval behavior, no external calls.
 * - OpenAI mode (when OPENAI_API_KEY is set): text-embedding-3-small with
 *   cosine similarity; item vectors are cached on the catalog row.
 */

export type LexicalVector = Map<string, number>;

const BROAD_TOKENS = new Set(tokenize("the a an of and or for to in on with very"));

/** Build a sparse lexical vector from text with synonym expansion + stemming. */
export function buildLexicalVector(text: string): LexicalVector {
  const tf = new Map<string, number>();
  for (const token of tokenize(text)) {
    const expansions = expandToken(token);
    const weight = 1 / Math.sqrt(expansions.length); // dampen broad groups
    for (const exp of expansions) {
      if (BROAD_TOKENS.has(exp)) continue;
      const key = stem(exp);
      tf.set(key, (tf.get(key) ?? 0) + weight);
    }
  }
  // L2 normalize so dot product == cosine similarity.
  let norm = 0;
  for (const v of tf.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of tf) tf.set(k, v / norm);
  return tf;
}

export function cosineLexical(a: LexicalVector, b: LexicalVector): number {
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w) dot += v * w;
  }
  return Math.max(0, dot);
}

export function cosineDense(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * OpenAI embedding for a single text. Returns null when unconfigured or on
 * failure — callers fall back to lexical vectors, never to invented data.
 */
export async function openAIEmbedding(text: string): Promise<number[] | null> {
  if (!aiEnabled) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text.slice(0, 4000),
      }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[ai] embedding failed:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
