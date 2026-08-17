const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const { getEmbedding } = require('./services/embeddings');
const { ensureCollection, upsertPoint, getCollectionInfo } = require('./services/qdrant');
const { fetchRecentCommits, fetchCommitDetails, fetchReadme } = require('./services/github');
const { retrieveRelevantContext, analyzeBlastRadius } = require('./agents/analyzer');
const { parsePRUrl, fetchPRFiles, fetchPRMeta } = require('./services/github');

const app = express();
app.use(cors());
app.use(express.json());

// Initialise Qdrant collection on startup
ensureCollection().catch(err => console.error('Failed to ensure collection:', err.message));

// Ingest a GitHub repo's commits + README into the vector DB
app.post('/ingest/repo', async (req, res) => {
    const { owner, repo, commitCount = 20 } = req.body;

    if (!owner || !repo) {
        return res.status(400).json({ error: 'owner and repo are required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    function send(event, data) {
        res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
    }

    try {
        const ingestedItems = [];

        // 1. README
        send('progress', { stage: 'readme', message: `Fetching README for ${owner}/${repo}...` });
        const readme = await fetchReadme(owner, repo);

        if (readme) {
            const text = `SERVICE README for ${owner}/${repo}:\n${readme.substring(0, 3000)}`;
            const vector = await getEmbedding(text);
            const id = uuidv4();
            await upsertPoint(id, vector, { type: 'readme', repo: `${owner}/${repo}`, content: text });
            ingestedItems.push({ type: 'readme', id });
            send('item_done', { type: 'readme', label: 'README' });
        } else {
            send('item_skipped', { type: 'readme', reason: 'No README found' });
        }

        // 2. Commits — fetch list first
        send('progress', { stage: 'commits', message: `Fetching ${commitCount} recent commits...` });
        const commits = await fetchRecentCommits(owner, repo, commitCount);
        send('progress', { stage: 'commits', message: `Found ${commits.length} commits. Embedding each one...`, total: commits.length });

        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i];

            try {
                const details = await fetchCommitDetails(owner, repo, commit.sha);

                const filesText = details.filesChanged
                    .map(f => `File: ${f.filename} [${f.status}] +${f.additions}/-${f.deletions}`)
                    .join('\n');

                const text = `COMMIT ${details.sha} by ${details.author} on ${details.date}:
Message: ${details.message}
Files changed:
${filesText}`;

                const vector = await getEmbedding(text);
                const id = uuidv4();

                await upsertPoint(id, vector, {
                    type: 'commit',
                    repo: `${owner}/${repo}`,
                    sha: details.sha,
                    author: details.author,
                    date: details.date,
                    message: details.message,
                    content: text,
                    url: `https://github.com/${owner}/${repo}/commit/${details.sha}`,
                });

                ingestedItems.push({ type: 'commit', sha: details.sha, id });

                // Send progress after EACH commit — this is what the UI needs
                send('item_done', {
                    type: 'commit',
                    sha: details.sha,
                    label: details.message.split('\n')[0].substring(0, 60),
                    current: i + 1,
                    total: commits.length,
                });

            } catch (commitErr) {
                // One bad commit shouldn't kill the whole ingestion
                send('item_failed', {
                    type: 'commit',
                    sha: commit.sha,
                    error: commitErr.message,
                    current: i + 1,
                    total: commits.length,
                });
            }
        }

        send('complete', {
            success: true,
            repo: `${owner}/${repo}`,
            ingested: ingestedItems.length,
            items: ingestedItems,
        });

    } catch (err) {
        send('error', { message: err.message });
    } finally {
        res.end();
    }
});

// Check what's currently stored
app.get('/ingest/status', async (req, res) => {
    try {
        const info = await getCollectionInfo();
        res.json({ pointsCount: info.points_count, status: info.status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

function sendEvent(res, event, data) {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
}

app.post('/analyze', async (req, res) => {
    const { prUrl } = req.body;
    if (!prUrl) return res.status(400).json({ error: 'prUrl is required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { owner, repo, pullNumber } = parsePRUrl(prUrl);

        sendEvent(res, 'status', { message: 'Fetching PR details...' });
        const prMeta = await fetchPRMeta(owner, repo, pullNumber);
        const files = await fetchPRFiles(owner, repo, pullNumber);

        sendEvent(res, 'status', { message: 'Searching historical context...' });
        const diffSummary = files.map(f => `${f.filename} (${f.status})`).join(', ');
        const retrievedContext = await retrieveRelevantContext(prMeta.title + ' ' + prMeta.body, diffSummary);

        sendEvent(res, 'context_found', {
            count: retrievedContext.length,
            items: retrievedContext.map(c => ({ type: c.type, sha: c.sha, score: c.score, url: c.url }))
        });

        sendEvent(res, 'status', { message: 'Analyzing blast radius...' });
        const analysis = await analyzeBlastRadius(
            { owner, repo, pullNumber },
            files,
            retrievedContext
        );

        sendEvent(res, 'complete', {
            pr: { owner, repo, pullNumber, title: prMeta.title, author: prMeta.author },
            filesChanged: files.length,
            retrievedContext: retrievedContext.map(c => ({ type: c.type, sha: c.sha, score: c.score, url: c.url })),
            analysis,
        });

    } catch (err) {
        sendEvent(res, 'error', { message: err.message });
    } finally {
        res.end();
    }
});

app.delete('/ingest/reset', async (req, res) => {
    try {
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
        await client.deleteCollection('blast_radius_context');
        await ensureCollection();
        res.json({ success: true, message: 'Collection reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));