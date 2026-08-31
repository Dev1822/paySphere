/**
 * @fileoverview Helpdesk Controller
 * @description Manages document ingestion, RAG queries, and ticket escalation.
 * Issue: #1001
 */
const { KnowledgeChunk, HRTicket } = require('../models/helpdesk.model');
const Employee = require('../models/employee.model');
const { chunkDocument, generateMockEmbedding, searchKnowledgeBase } = require('../services/vectorSearch.service');
const { buildRAGPrompt, callLLM } = require('../utils/llmPromptBuilder');
const logger = require('../utils/logger');

/**
 * POST /api/helpdesk/knowledge/upload
 * HR uploads a text/PDF document to be chunked and indexed.
 */
exports.uploadKnowledge = async (req, res, next) => {
    try {
        const { title, content } = req.body;
        if (!content || content.length < 50) {
            return res.status(400).json({ message: 'Document content is too short to index.' });
        }

        // Delete existing chunks for this document to allow re-indexing
        await KnowledgeChunk.deleteMany({
            documentTitle: title
        });

        const chunks = chunkDocument(content, 1000, 200);

        // In a real app, we'd fetch the global vocabulary or use an external Embedding API.
        // Here we build a local vocabulary for the mock embedding.
        const vocabulary = new Set();
        chunks.forEach(c => c.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).forEach(w => vocabulary.add(w)));
        const vocabArray = Array.from(vocabulary);

        const chunkDocs = chunks.map((text, index) => ({
            documentTitle: title,
            chunkIndex: index,
            content: text,
            embedding: generateMockEmbedding(text, vocabArray)
        }));

        await KnowledgeChunk.insertMany(chunkDocs);

        res.status(201).json({ message: 'Knowledge base updated', chunkCount: chunks.length });
    } catch (error) { next(error); }
};

/**
 * POST /api/helpdesk/ask
 * Employee asks a question. System performs RAG search and returns AI answer.
 */
exports.askQuestion = async (req, res, next) => {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ message: 'Question is required' });

        // 1. Retrieve all chunks for the tenant (In prod: query Vector DB directly)
        const allChunks = await KnowledgeChunk.find({});

        // 2. Perform similarity search
        const relevantChunks = searchKnowledgeBase(allChunks, question, 3);

        // 3. Build RAG Prompt
        const promptPayload = buildRAGPrompt(question, relevantChunks);

        // 4. Call LLM
        const aiResponse = await callLLM(promptPayload);

        // 5. Check if escalation is needed
        const needsEscalation = aiResponse.includes("I don't have enough information");

        res.status(200).json({
            answer: aiResponse,
            citations: relevantChunks.map(c => c.documentTitle),
            needsEscalation
        });
    } catch (error) { next(error); }
};

/**
 * POST /api/helpdesk/tickets/escalate
 * Converts an unresolved AI query into a tracked HR Ticket.
 */
exports.escalateToTicket = async (req, res, next) => {
    try {
        const { originalQuery, aiResponse, priority } = req.body;

        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const ticket = await HRTicket.create({
            employeeId: employee._id,
            subject: `Query: ${originalQuery.slice(0, 50)}...`,
            originalQuery,
            aiResponse: aiResponse || '',
            priority: priority || 'Medium',

            messages: [{
                senderId: req.userId,
                senderType: 'Employee',
                content: originalQuery
            }]
        });

        res.status(201).json({ message: 'Ticket escalated to HR successfully', ticketId: ticket._id });
    } catch (error) { next(error); }
};
