const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = 'blast_radius_context';

async function ensureCollection() {
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
        await client.createCollection(COLLECTION_NAME, {
            vectors: { size: 768, distance: 'Cosine' },
        });
        console.log(`Created collection: ${COLLECTION_NAME}`);
    } else {
        console.log(`Collection already exists: ${COLLECTION_NAME}`);
    }
}

async function upsertPoint(id, vector, payload) {
    await client.upsert(COLLECTION_NAME, {
        points: [{ id, vector, payload }],
    });
}

async function searchSimilar(vector, limit = 5) {
    const result = await client.search(COLLECTION_NAME, {
        vector,
        limit,
        with_payload: true,
    });
    return result;
}

async function getCollectionInfo() {
    return await client.getCollection(COLLECTION_NAME);
}

module.exports = { ensureCollection, upsertPoint, searchSimilar, getCollectionInfo };