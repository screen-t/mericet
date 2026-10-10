/**
 * Local Semantic Relevance Matcher
 * 
 * Performs client-side in-memory text parsing and keyword relevance scoring
 * against user-specified vault items and claims.
 * 
 * NOTE: This is a distinct check from cryptographic Poseidon commitments.
 * Semantic relevance scores verify content alignment, NOT cryptographic correctness.
 */

export interface SemanticMatchResult {
  isRelevant: boolean;
  score: number; // 0.0 to 1.0
  matchedKeywords: string[];
  totalKeywords: number;
}

/**
 * Clean and tokenize a text string into normalized terms.
 */
function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

/**
 * Evaluate semantic relevance between document text and vault claim keywords.
 */
export function evaluateSemanticRelevance(
  documentText: string,
  targetClaimTitle: string,
  targetKeywords: string[] = []
): SemanticMatchResult {
  const docTokens = tokenize(documentText);
  const claimTokens = Array.from(tokenize(targetClaimTitle));
  const allKeywords = Array.from(new Set([...claimTokens, ...targetKeywords.map((k) => k.toLowerCase().trim())])).filter(Boolean);

  if (allKeywords.length === 0) {
    return {
      isRelevant: true,
      score: 1.0,
      matchedKeywords: [],
      totalKeywords: 0,
    };
  }

  const matches: string[] = [];
  for (const kw of allKeywords) {
    if (docTokens.has(kw) || documentText.toLowerCase().includes(kw)) {
      matches.push(kw);
    }
  }

  const score = matches.length / allKeywords.length;
  const isRelevant = score >= 0.3; // at least 30% of key claim terms present

  return {
    isRelevant,
    score: Math.round(score * 100) / 100,
    matchedKeywords: matches,
    totalKeywords: allKeywords.length,
  };
}
