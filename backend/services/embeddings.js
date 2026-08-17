const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getEmbedding(text) {
    const result = await genAI.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
            outputDimensionality: 768,
        },
    });

    return result.embeddings[0].values;
}

module.exports = { getEmbedding };