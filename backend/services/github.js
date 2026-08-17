const axios = require('axios');
require('dotenv').config();

const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
};

async function fetchRecentCommits(owner, repo, count = 20) {
    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits`,
        { headers, params: { per_page: count } }
    );

    return response.data.map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
    }));
}

async function fetchCommitDetails(owner, repo, sha) {
    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
        { headers }
    );

    return {
        sha: response.data.sha.substring(0, 7),
        message: response.data.commit.message,
        author: response.data.commit.author.name,
        date: response.data.commit.author.date,
        filesChanged: response.data.files.map(f => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch || '(no diff)',
        })),
    };
}

async function fetchReadme(owner, repo) {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/readme`,
            { headers }
        );
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
    } catch {
        return null;
    }
}

function parsePRUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) throw new Error('Invalid GitHub PR URL');
    return { owner: match[1], repo: match[2], pullNumber: match[3] };
}

async function fetchPRFiles(owner, repo, pullNumber) {
    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
        { headers }
    );

    const files = response.data;
    if (files.length > 50) {
        throw new Error(`PR too large for analysis (${files.length} files). Max is 50.`);
    }

    return files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '(binary or no diff)',
    }));
}

async function fetchPRMeta(owner, repo, pullNumber) {
    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
        { headers }
    );
    return {
        title: response.data.title,
        body: response.data.body || '',
        author: response.data.user.login,
    };
}

module.exports = {
    fetchRecentCommits,
    fetchCommitDetails,
    fetchReadme,
    parsePRUrl,
    fetchPRFiles,
    fetchPRMeta,
};