const { GoogleGenAI } = require('@google/genai');
const { getEmbedding } = require('../services/embeddings');
const { searchSimilar } = require('../services/qdrant');
require('dotenv').config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function retrieveRelevantContext(prDescription, diffSummary) {
    // Embed the PR's intent + changes to find semantically related history
    const queryText = `${prDescription}\n\nChanges: ${diffSummary}`;
    const queryVector = await getEmbedding(queryText);

    const results = await searchSimilar(queryVector, 8);

    return results.map(r => ({
        score: r.score,
        type: r.payload.type,
        sha: r.payload.sha || null,
        author: r.payload.author || null,
        content: r.payload.content,
        url: r.payload.url || null,
    }));
}

async function analyzeBlastRadius(prMeta, files, retrievedContext) {
    const diffText = files.map(f =>
        `--- FILE: ${f.filename} [${f.status}] +${f.additions}/-${f.deletions} ---\n${f.patch}`
    ).join('\n\n');

    const contextText = retrievedContext.map((c, i) =>
        `[Related context ${i + 1}, relevance ${(c.score * 100).toFixed(0)}%]\n${c.content}`
    ).join('\n\n');

    const prompt = `You are a senior staff engineer doing a blast radius analysis on a pull request before it merges. Your job is NOT to review code quality — it is to assess the real-world operational and organizational consequences of this change.

PR: ${prMeta.owner}/${prMeta.repo} #${prMeta.pullNumber}

DIFF:
${diffText}

RELATED HISTORICAL CONTEXT (past commits and documentation that are semantically related to this change):
${contextText}

Analyze this change and think about:
- What does this change actually DO in terms of behavior, not just syntax?
- Based on the related historical context, what other parts of the system have touched similar code before?
- What assumptions might other code, services, or teams have about the current behavior that this change could violate?
- Is this a breaking change to any contract (API shape, function signature, config format)?
- What is the realistic risk level if this merges without broader communication?

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "change_type": "behavior-change|contract-change|refactor-only|bug-fix|feature-addition|config-change",
  "plain_summary": "2-3 sentences explaining what this change does in plain English",
  "blast_radius_score": <number 1-10, where 10 is highest risk/widest impact>,
  "affected_areas": [
    {
      "area": "specific area of concern (e.g. 'API consumers', 'downstream caching', 'related module X')",
      "reasoning": "why this is affected, referencing the related context if relevant",
      "severity": "critical|warning|info"
    }
  ],
  "related_history": [
    {
      "reference": "which related commit/doc this connects to",
      "relevance": "why this past context matters for this PR"
    }
  ],
  "recommended_actions": ["specific action before merging, e.g. 'notify team X', 'add integration test for Y'"],
  "safe_to_merge_alone": true or false
}`;

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
    });

    const text = result.text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
}

module.exports = { retrieveRelevantContext, analyzeBlastRadius };