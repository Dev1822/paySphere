import type { NextFunction, Request, Response } from 'express';

const FlashcardDeck = require('../models/flashcardDeck.model');
const geminiUtils = require('../utils/gemini');
const { generateSummaryTags } = geminiUtils;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
}

export interface FlashcardCard {
  front: string;
  back: string;
}

export interface FlashcardDeckDocument {
  _id: unknown;
  title: string;
  description?: string;
  subject: string;
  exam: string;
  isPublic: boolean;
  cards: FlashcardCard[];
  tags: string[];
  downloadsCount: number;
  save: () => Promise<FlashcardDeckDocument>;
}

interface CreateDeckBody {
  title?: string;
  description?: string;
  subject?: string;
  exam?: string;
  isPublic?: boolean;
  cards?: FlashcardCard[];
}

interface UpdateDeckBody {
  title?: string;
  description?: string;
  subject?: string;
  exam?: string;
  isPublic?: boolean;
  cards?: FlashcardCard[];
}

interface DeckIdParams {
  id: string;
}

interface CommunityDecksQuery {
  subject?: string;
  exam?: string;
  minRating?: string;
  search?: string;
  page?: string;
  limit?: string;
}

type CreateDeckRequest = AuthenticatedRequest & { body: CreateDeckBody };
type UpdateDeckRequest = AuthenticatedRequest & {
  body: UpdateDeckBody;
  params: DeckIdParams;
};
type DeckIdRequest = AuthenticatedRequest & { params: DeckIdParams };
type CommunityDecksRequest = AuthenticatedRequest & {
  query: CommunityDecksQuery;
};

/**
 * Create a new flashcard deck for the authenticated user's tenant.
 */
export async function createDeck(
  req: CreateDeckRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const { title, description, subject, exam, isPublic, cards } = req.body;

    if (!title || !subject || !exam || !cards) {
      return res.status(400).json({
        message:
          'Missing required fields: title, subject, exam, and cards are required',
      });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res
        .status(400)
        .json({ message: 'A flashcard deck must have at least one card' });
    }

    const filter = {};

    let tags: string[] = [];
    if (isPublic) {
      tags = await generateSummaryTags({
        title,
        description,
        subject,
        exam,
        cards,
      });
    }

    const newDeck = await FlashcardDeck.create({
      title,
      description,
      subject,
      exam,
      isPublic: !!isPublic,
      cards,
      tags,
      createdBy: req.userId,
    });

    return res.status(201).json(newDeck);
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve the authenticated user's flashcard decks (custom and cloned).
 */
export async function getMyDecks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const filter = { createdBy: req.userId };
    const decks = await FlashcardDeck.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing deck's details/cards.
 */
export async function updateDeck(
  req: UpdateDeckRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const { id } = req.params;
    const { title, description, subject, exam, isPublic, cards } = req.body;

    const deck: FlashcardDeckDocument | null = await FlashcardDeck.findOne({
      _id: id,
      createdBy: req.userId,
    });
    if (!deck) {
      return res
        .status(404)
        .json({ message: 'Flashcard deck not found or unauthorized' });
    }

    if (title) deck.title = title;
    if (description !== undefined) deck.description = description;
    if (subject) deck.subject = subject;
    if (exam) deck.exam = exam;
    if (cards) {
      if (!Array.isArray(cards) || cards.length === 0) {
        return res
          .status(400)
          .json({ message: 'A flashcard deck must have at least one card' });
      }
      deck.cards = cards;
    }

    const prevPublic = deck.isPublic;
    if (isPublic !== undefined) {
      deck.isPublic = !!isPublic;
    }

    if (deck.isPublic && (!prevPublic || cards || title || subject || exam)) {
      deck.tags = await generateSummaryTags({
        title: deck.title,
        description: deck.description,
        subject: deck.subject,
        exam: deck.exam,
        cards: deck.cards,
      });
    } else if (!deck.isPublic) {
      deck.tags = [];
    }

    await deck.save();
    return res.status(200).json(deck);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a deck owned by the authenticated user.
 */
export async function deleteDeck(
  req: DeckIdRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const { id } = req.params;
    const deck = await FlashcardDeck.findOneAndDelete({
      _id: id,
      createdBy: req.userId,
    });
    if (!deck) {
      return res
        .status(404)
        .json({ message: 'Flashcard deck not found or unauthorized' });
    }
    return res
      .status(200)
      .json({ message: 'Flashcard deck deleted successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve community public decks with search, filters, and pagination.
 */
export async function getCommunityDecks(
  req: CommunityDecksRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const { subject, exam, minRating, search } = req.query;

    const query: Record<string, unknown> = { isPublic: true };

    if (subject) {
      query.subject = new RegExp(subject.trim(), 'i');
    }

    if (exam) {
      query.exam = new RegExp(exam.trim(), 'i');
    }

    if (minRating) {
      const parsedRating = parseFloat(minRating);
      if (!isNaN(parsedRating)) {
        query.rating = { $gte: parsedRating };
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ];
    }

    let page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit) || limit < 1) limit = 12;

    const skip = (page - 1) * limit;

    const [decks, totalDecks] = await Promise.all([
      FlashcardDeck.find(query)
        .sort({ downloadsCount: -1, rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FlashcardDeck.countDocuments(query),
    ]);

    return res.status(200).json({
      decks,
      totalPages: Math.ceil(totalDecks / limit) || 1,
      currentPage: page,
      totalDecks,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Clone a public deck into the authenticated user's own library.
 */
export async function cloneDeck(
  req: DeckIdRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const { id } = req.params;
    const filter = {};

    // `filter` was computed on the line above and then not used — the fetch
    // went through `findById`, so a deck belonging to another company was
    // clonable by id (#1010). Every other handler in this file scopes
    // correctly; this one built the filter and dropped it.
    //
    // The `isPublic` check below is not a substitute. "Public" means visible
    // within the company, not across companies — nothing in the product offers
    // a cross-tenant deck library.
    const originalDeck: FlashcardDeckDocument | null =
      await FlashcardDeck.findOne({ ...filter, _id: id });
    if (!originalDeck) {
      return res
        .status(404)
        .json({ message: 'Original flashcard deck not found' });
    }

    if (!originalDeck.isPublic) {
      return res
        .status(403)
        .json({ message: 'Cannot clone private flashcard decks' });
    }

    originalDeck.downloadsCount += 1;
    await originalDeck.save();

    const clonedDeck = await FlashcardDeck.create({
      title: `${originalDeck.title} (Cloned)`,
      description: originalDeck.description,
      subject: originalDeck.subject,
      exam: originalDeck.exam,
      isPublic: false,
      cards: originalDeck.cards.map((c) => ({ front: c.front, back: c.back })),
      clonedFromId: originalDeck._id,
      createdBy: req.userId,
      tags: originalDeck.tags,
    });

    return res.status(201).json(clonedDeck);
  } catch (error) {
    next(error);
  }
}