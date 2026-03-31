import { Injectable } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { listeningMediaFor, normalizeListeningMediaUrl } from "./listening-media";
import { defaultSkillTag, normalizePart1Image, padOptionsToFour } from "./question-normalize";
import { extractPassageAndStem, normalizeReadingContext } from "./reading-context";
import {
  Attempt,
  AttemptItem,
  AuditLog,
  Goal,
  IpCampaign,
  IpCandidate,
  IpResult,
  IpSession,
  IpSessionCandidate,
  Membership,
  MistakeNote,
  OrgUnit,
  Question,
  ReviewCard,
  ScorePrediction,
  Tenant,
  User,
  VocabularyCard,
} from "./types";
import { newId, nowIso } from "./utils";
import * as questionBank from "./question-bank.json";
import * as questionBankExpansion from "./question-bank-expansion.json";
import * as questionBankExpansion2 from "./question-bank-expansion-2.json";
import * as questionBankExpansion3 from "./question-bank-expansion-3.json";
import * as questionBankExpansion4 from "./question-bank-expansion-4.json";
import * as questionBankExpansion5 from "./question-bank-expansion-5.json";
import * as questionBankExpansion6 from "./question-bank-expansion-6.json";
import * as questionBankExpansion7 from "./question-bank-expansion-7.json";
import * as questionBankExpansion8 from "./question-bank-expansion-8.json";
import * as vocabSeedData from "./vocab-seed.json";
import * as vocabSeedData1 from "./vocab-seed-1.json";
import * as vocabSeedData2 from "./vocab-seed-2.json";

type ImportedQuestion = {
  partNo: number;
  skillTag?: string;
  difficulty?: number;
  stem?: string;
  passage?: string;
  explanation?: string;
  mediaUrl?: string;
  imageUrl?: string;
  options?: Array<{ key?: string; text?: string }>;
  correctKey?: string;
};

type ImportedQuestionSource = "bank" | "official_pack";

type ImportedQuestionWithSource = ImportedQuestion & {
  __source: ImportedQuestionSource;
};

type VocabularySeedCard = {
  term: string;
  pos: string;
  definition: string;
  example: string;
  sourcePart: number;
  tags: string[];
};

const VOCAB_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "might",
  "must",
  "of",
  "on",
  "or",
  "our",
  "should",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  "about",
  "after",
  "before",
  "during",
  "under",
  "over",
  "within",
  "without",
  "between",
  "across",
  "onto",
  "upon",
  "only",
  "also",
  "then",
  "than",
  "here",
  "please",
  "today",
  "tomorrow",
  "yesterday",
  "first",
  "second",
  "third",
  "last",
  "next",
  "year",
  "month",
  "week",
  "time",
  "need",
  "needs",
  "needed",
  "take",
  "takes",
  "took",
  "taken",
  "work",
  "works",
  "working",
  "question",
  "questions",
  "option",
  "options",
  "answer",
  "answers",
  "correct",
  "incorrect",
  "choose",
  "choosing",
  "selected",
  "selection",
  "prompt",
  "prompts",
  "sentence",
  "sentences",
  "excerpt",
  "audio",
  "image",
  "images",
  "toeic",
  "style",
  "practice",
  "item",
  "items",
  "context",
  "contexts",
  "part",
  "parts",
  "speaker",
  "speakers",
  "likely",
  "most",
  "least",
  "best",
  "according",
  "based",
  "detail",
  "details",
  "main",
  "purpose",
  "following",
  "blank",
  "blanks",
  "dear",
  "conversation",
  "talk",
  "photo",
  "response",
  "baseform",
  "logical",
  "logically",
  "explicitly",
  "implicit",
  "implicitly",
  "grammar",
  "grammatical",
  "verb",
  "verbs",
  "noun",
  "nouns",
  "adjective",
  "adjectives",
  "adverb",
  "adverbs",
  "keyword",
  "keywords",
  "distractor",
  "distractors",
  "action",
  "requirement",
  "requirements",
  "because",
  "therefore",
  "however",
]);

const VOCAB_DICTIONARY_TERM_PATTERN = /^[a-z][a-z' -]{1,63}$/;

@Injectable()
export class StoreService {
  public tenants: Tenant[] = [];
  public users: User[] = [];
  public memberships: Membership[] = [];
  public goals: Goal[] = [];
  public questions: Question[] = [];
  public attempts: Attempt[] = [];
  public attemptItems: AttemptItem[] = [];
  public mistakeNotes: MistakeNote[] = [];
  public reviewCards: ReviewCard[] = [];
  public vocabularyCards: VocabularyCard[] = [];
  public predictions: ScorePrediction[] = [];
  public orgUnits: OrgUnit[] = [];
  public ipCampaigns: IpCampaign[] = [];
  public ipCandidates: IpCandidate[] = [];
  public ipSessions: IpSession[] = [];
  public ipSessionCandidates: IpSessionCandidate[] = [];
  public ipResults: IpResult[] = [];
  public auditLogs: AuditLog[] = [];

  private readonly snapshotFile =
    process.env.STORE_SNAPSHOT_FILE ?? (process.env.NODE_ENV === "test" ? "" : ".runtime/store-snapshot.json");
  private readonly snapshotEnabled = this.snapshotFile.trim().length > 0;
  private readonly officialPackFile =
    process.env.OFFICIAL_QUESTION_PACK_FILE ?? ".runtime/question-bank-official-pack.json";
  private officialPackCache: ImportedQuestion[] | null = null;
  private questionBankCache: ImportedQuestionWithSource[] | null = null;
  private vocabularySeedCache: VocabularySeedCard[] | null = null;

  constructor() {
    if (this.snapshotEnabled) {
      this.loadSnapshot();
      this.normalizeLearningHistory();
    }
  }

  hasOfficialQuestionPack(): boolean {
    return this.loadOfficialQuestionPack().length > 0;
  }

  persistSnapshot(): void {
    if (!this.snapshotEnabled) {
      return;
    }
    const payload = {
      version: 1,
      savedAt: nowIso(),
      data: {
        tenants: this.tenants,
        users: this.users,
        memberships: this.memberships,
        goals: this.goals,
        questions: this.questions,
        attempts: this.attempts,
        attemptItems: this.attemptItems,
        mistakeNotes: this.mistakeNotes,
        reviewCards: this.reviewCards,
        vocabularyCards: this.vocabularyCards,
        predictions: this.predictions,
        orgUnits: this.orgUnits,
        ipCampaigns: this.ipCampaigns,
        ipCandidates: this.ipCandidates,
        ipSessions: this.ipSessions,
        ipSessionCandidates: this.ipSessionCandidates,
        ipResults: this.ipResults,
        auditLogs: this.auditLogs,
      },
    };

    try {
      mkdirSync(dirname(this.snapshotFile), { recursive: true });
      writeFileSync(this.snapshotFile, JSON.stringify(payload), "utf8");
    } catch {
      // Persistence is best-effort in local mode; runtime should keep serving requests.
    }
  }

  private loadSnapshot(): void {
    if (!this.snapshotEnabled) {
      return;
    }
    if (!existsSync(this.snapshotFile)) {
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.snapshotFile, "utf8")) as {
        data?: Partial<StoreService>;
      };
      const data = parsed.data ?? {};
      this.tenants = Array.isArray(data.tenants) ? data.tenants : [];
      this.users = Array.isArray(data.users) ? data.users : [];
      this.memberships = Array.isArray(data.memberships) ? data.memberships : [];
      this.goals = Array.isArray(data.goals) ? data.goals : [];
      this.questions = Array.isArray(data.questions) ? data.questions : [];
      this.attempts = Array.isArray(data.attempts) ? data.attempts : [];
      this.attemptItems = Array.isArray(data.attemptItems) ? data.attemptItems : [];
      this.mistakeNotes = Array.isArray(data.mistakeNotes) ? data.mistakeNotes : [];
      this.reviewCards = Array.isArray(data.reviewCards) ? data.reviewCards : [];
      this.vocabularyCards = Array.isArray(data.vocabularyCards) ? data.vocabularyCards : [];
      this.predictions = Array.isArray(data.predictions) ? data.predictions : [];
      this.orgUnits = Array.isArray(data.orgUnits) ? data.orgUnits : [];
      this.ipCampaigns = Array.isArray(data.ipCampaigns) ? data.ipCampaigns : [];
      this.ipCandidates = Array.isArray(data.ipCandidates) ? data.ipCandidates : [];
      this.ipSessions = Array.isArray(data.ipSessions) ? data.ipSessions : [];
      this.ipSessionCandidates = Array.isArray(data.ipSessionCandidates) ? data.ipSessionCandidates : [];
      this.ipResults = Array.isArray(data.ipResults) ? data.ipResults : [];
      this.auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    } catch {
      // Ignore invalid snapshot and continue with fresh in-memory state.
    }
  }

  private normalizeLearningHistory(): void {
    if (this.attemptItems.length === 0 && this.reviewCards.length === 0) {
      return;
    }

    // Legacy snapshots may mark unanswered questions as incorrect. Normalize them first.
    this.attemptItems.forEach((item) => {
      if (typeof item.selectedKey !== "string" && item.isCorrect === false) {
        delete (item as { isCorrect?: boolean }).isCorrect;
      }
    });

    if (this.reviewCards.length === 0) {
      return;
    }

    const attemptMap = new Map(this.attempts.map((attempt) => [attempt.id, attempt]));
    const answeredWrongKeys = new Set<string>();
    this.attemptItems.forEach((item) => {
      if (item.isCorrect !== false || typeof item.selectedKey !== "string") {
        return;
      }
      const attempt = attemptMap.get(item.attemptId);
      if (!attempt) {
        return;
      }
      answeredWrongKeys.add(`${attempt.tenantId}:${attempt.userId}:${item.questionId}`);
    });

    this.reviewCards = this.reviewCards.filter((card) =>
      answeredWrongKeys.has(`${card.tenantId}:${card.userId}:${card.questionId}`),
    );
  }

  ensureSeedQuestions(tenantId: string, createdBy?: string): void {
    this.normalizeTenantQuestions(tenantId);
    this.archiveDuplicateTenantQuestions(tenantId);

    const existingQuestionByKey = new Map<string, Question>();
    this.questions
      .filter((item) => item.tenantId === tenantId)
      .forEach((item) => {
        const key = this.buildQuestionSeedKey(item.partNo, item.stem, item.passage, item.options);
        const existing = existingQuestionByKey.get(key);
        if (!existing) {
          existingQuestionByKey.set(key, item);
          return;
        }
        if (existing.status !== "published" && item.status === "published") {
          existingQuestionByKey.set(key, item);
          return;
        }
        if (existing.createdAt.localeCompare(item.createdAt) < 0) {
          existingQuestionByKey.set(key, item);
        }
      });

    const questionSeed: Array<{
      partNo: number;
      skillTag: string;
      difficulty: number;
      stem: string;
      explanation: string;
      mediaUrl?: string;
      imageUrl?: string;
      options: Array<{
        key: "A" | "B" | "C" | "D";
        text: string;
      }>;
      correctKey: "A" | "B" | "C" | "D";
    }> = [
      {
        partNo: 1,
        skillTag: "photo-description",
        difficulty: 1,
        stem: "Several filing cabinet drawers are open in an office.",
        explanation: "Part 1 requires matching what is visibly true in the picture, not assumed actions.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-1.mp3",
        imageUrl: "/assets/images/listening/part1-filing-cabinets.jpg",
        options: [
          { key: "A", text: "Several filing cabinet drawers are open." },
          { key: "B", text: "Office workers are greeting visitors." },
          { key: "C", text: "A printer is being repaired." },
          { key: "D", text: "Plants are being watered near the window." },
        ],
        correctKey: "A",
      },
      {
        partNo: 1,
        skillTag: "photo-description",
        difficulty: 2,
        stem: "Two workers are unloading boxes from a delivery truck.",
        explanation: "Focus on the observable present action instead of location details.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-1.mp3",
        imageUrl: "/assets/images/listening/part1-unloading-truck.jpg",
        options: [
          { key: "A", text: "The workers are signing contracts." },
          { key: "B", text: "The workers are loading furniture into a house." },
          { key: "C", text: "The workers are moving boxes off a truck." },
          { key: "D", text: "The workers are painting a wall." },
        ],
        correctKey: "C",
      },
      {
        partNo: 1,
        skillTag: "photo-description",
        difficulty: 2,
        stem: "Several bicycles are parked beside a fence.",
        explanation: "Plural subject + passive state 'are parked' is the key structure.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-1.mp3",
        imageUrl: "/assets/images/listening/part1-bicycles-real.jpg",
        options: [
          { key: "A", text: "People are buying bicycles at a shop." },
          { key: "B", text: "Bicycles are lined up by a fence." },
          { key: "C", text: "A cyclist is crossing a bridge." },
          { key: "D", text: "Children are riding in a park." },
        ],
        correctKey: "B",
      },
      {
        partNo: 2,
        skillTag: "question-response",
        difficulty: 1,
        stem: "When does the orientation session begin?",
        explanation: "A time question needs a time-based response.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-2.mp3",
        imageUrl: "/assets/images/listening/part2-response.svg",
        options: [
          { key: "A", text: "In the main conference room." },
          { key: "B", text: "At nine thirty this morning." },
          { key: "C", text: "By our training manager." },
          { key: "D", text: "The new employees are ready." },
        ],
        correctKey: "B",
      },
      {
        partNo: 2,
        skillTag: "question-response",
        difficulty: 2,
        stem: "Could you email me the revised budget?",
        explanation: "A request question is best answered by agreement or action.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-2.mp3",
        imageUrl: "/assets/images/listening/part2-response.svg",
        options: [
          { key: "A", text: "Sure, I will send it this afternoon." },
          { key: "B", text: "It was discussed in the budget meeting." },
          { key: "C", text: "On the third floor near accounting." },
          { key: "D", text: "The budget is larger this year." },
        ],
        correctKey: "A",
      },
      {
        partNo: 2,
        skillTag: "question-response",
        difficulty: 3,
        stem: "Why was the flight delayed?",
        explanation: "'Why' asks for a reason; only one option provides a cause.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-2.mp3",
        imageUrl: "/assets/images/listening/part2-response.svg",
        options: [
          { key: "A", text: "At Gate 12 near the cafe." },
          { key: "B", text: "Because of severe weather." },
          { key: "C", text: "In about two more hours." },
          { key: "D", text: "Yes, the pilot announced it." },
        ],
        correctKey: "B",
      },
      {
        partNo: 3,
        skillTag: "conversation-detail",
        difficulty: 3,
        stem: "In a conversation, the speakers discuss a delayed software release. What problem do they mention?",
        explanation: "Identify the stated obstacle in the conversation context.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-3.mp3",
        imageUrl: "/assets/images/listening/part3-conversation.svg",
        options: [
          { key: "A", text: "The office internet is unavailable." },
          { key: "B", text: "A key testing report is incomplete." },
          { key: "C", text: "The client changed vendors." },
          { key: "D", text: "The meeting room is double-booked." },
        ],
        correctKey: "B",
      },
      {
        partNo: 3,
        skillTag: "conversation-detail",
        difficulty: 3,
        stem: "The woman says she can adjust the timeline. What does she suggest first?",
        explanation: "The first practical suggestion is to move a specific milestone.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-3.mp3",
        imageUrl: "/assets/images/listening/part3-conversation.svg",
        options: [
          { key: "A", text: "Cancel the launch entirely." },
          { key: "B", text: "Hire an external consultant." },
          { key: "C", text: "Push the pilot test by one week." },
          { key: "D", text: "Transfer the project to another team." },
        ],
        correctKey: "C",
      },
      {
        partNo: 3,
        skillTag: "conversation-detail",
        difficulty: 4,
        stem: "What will the man do next in the conversation?",
        explanation: "Listen for commitment phrases such as 'I will send'.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-3.mp3",
        imageUrl: "/assets/images/listening/part3-conversation.svg",
        options: [
          { key: "A", text: "Book a flight to the branch office." },
          { key: "B", text: "Send the revised checklist to the team." },
          { key: "C", text: "Ask finance for an extra budget." },
          { key: "D", text: "Meet with the client immediately." },
        ],
        correctKey: "B",
      },
      {
        partNo: 4,
        skillTag: "talk-purpose",
        difficulty: 2,
        stem: "A company announcement explains changes to building access. What is the purpose of the talk?",
        explanation: "The core purpose is to inform employees of a new policy.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-4.mp3",
        imageUrl: "/assets/images/listening/part4-talk.svg",
        options: [
          { key: "A", text: "To promote a new security vendor" },
          { key: "B", text: "To explain updated entry procedures" },
          { key: "C", text: "To invite staff to a social event" },
          { key: "D", text: "To report quarterly earnings" },
        ],
        correctKey: "B",
      },
      {
        partNo: 4,
        skillTag: "talk-detail",
        difficulty: 3,
        stem: "According to the speaker, what has changed since last month?",
        explanation: "The new badge requirement is contrasted with last month's rule.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-4.mp3",
        imageUrl: "/assets/images/listening/part4-talk.svg",
        options: [
          { key: "A", text: "Parking fees were eliminated." },
          { key: "B", text: "The cafeteria schedule was reduced." },
          { key: "C", text: "All staff must scan badges at every entrance." },
          { key: "D", text: "Visitors can now enter without registration." },
        ],
        correctKey: "C",
      },
      {
        partNo: 4,
        skillTag: "talk-detail",
        difficulty: 3,
        stem: "Who should employees contact if their card does not work?",
        explanation: "Direct instruction includes a specific support desk.",
        mediaUrl: "/assets/audio/toeic-official/practice-test-2-part-4.mp3",
        imageUrl: "/assets/images/listening/part4-talk.svg",
        options: [
          { key: "A", text: "The reception manager" },
          { key: "B", text: "The payroll supervisor" },
          { key: "C", text: "The facilities contractor" },
          { key: "D", text: "The IT support desk" },
        ],
        correctKey: "D",
      },
      {
        partNo: 5,
        skillTag: "grammar-pronoun",
        difficulty: 2,
        stem: "The manager asked all staff to submit ___ travel receipts by Monday.",
        explanation: "Plural subject 'all staff' pairs with possessive pronoun 'their'.",
        options: [
          { key: "A", text: "their" },
          { key: "B", text: "there" },
          { key: "C", text: "them" },
          { key: "D", text: "they" },
        ],
        correctKey: "A",
      },
      {
        partNo: 5,
        skillTag: "grammar-conjunction",
        difficulty: 3,
        stem: "Our sales team has grown rapidly, ___ we need additional office space.",
        explanation: "Cause-effect relationship requires a result conjunction.",
        options: [
          { key: "A", text: "unless" },
          { key: "B", text: "therefore" },
          { key: "C", text: "although" },
          { key: "D", text: "meanwhile" },
        ],
        correctKey: "B",
      },
      {
        partNo: 5,
        skillTag: "vocabulary",
        difficulty: 3,
        stem: "Please keep this document in a secure place; it is strictly ___.",
        explanation: "Business context with security implies 'confidential'.",
        options: [
          { key: "A", text: "available" },
          { key: "B", text: "confidential" },
          { key: "C", text: "temporary" },
          { key: "D", text: "optional" },
        ],
        correctKey: "B",
      },
      {
        partNo: 6,
        skillTag: "text-completion",
        difficulty: 2,
        stem: "Complete the email: 'Thank you for attending yesterday's workshop. ___'",
        explanation: "A follow-up sentence should continue with next-step information.",
        options: [
          { key: "A", text: "Please find the presentation slides attached." },
          { key: "B", text: "The meeting room was on the third floor." },
          { key: "C", text: "Lunch is served from noon to one." },
          { key: "D", text: "Our website opened in 2012." },
        ],
        correctKey: "A",
      },
      {
        partNo: 6,
        skillTag: "text-completion",
        difficulty: 3,
        stem: "Complete the notice: 'Employees who park in Lot B must display the new permit. ___'",
        explanation: "A notice typically adds implementation timing.",
        options: [
          { key: "A", text: "Permit checks will start next Monday." },
          { key: "B", text: "The annual picnic was successful." },
          { key: "C", text: "The finance report is attached below." },
          { key: "D", text: "Our offices are near the subway." },
        ],
        correctKey: "A",
      },
      {
        partNo: 6,
        skillTag: "text-completion",
        difficulty: 4,
        stem: "Complete the memo: 'The cafeteria will close at 2 p.m. on Friday. ___'",
        explanation: "The best continuation offers an alternative arrangement.",
        options: [
          { key: "A", text: "Employees may use the cafe across the street after that time." },
          { key: "B", text: "Several interns joined the marketing team." },
          { key: "C", text: "The printer manual is in the cabinet." },
          { key: "D", text: "We launched two new products in spring." },
        ],
        correctKey: "A",
      },
      {
        partNo: 7,
        skillTag: "reading-main-idea",
        difficulty: 3,
        stem: "Article excerpt: 'Due to increased demand, our evening customer support line will now operate until 10 p.m. on weekdays.' What is the main purpose?",
        explanation: "The excerpt announces a service schedule extension.",
        options: [
          { key: "A", text: "To request hiring approvals" },
          { key: "B", text: "To announce extended support hours" },
          { key: "C", text: "To compare two call center vendors" },
          { key: "D", text: "To apologize for system downtime" },
        ],
        correctKey: "B",
      },
      {
        partNo: 7,
        skillTag: "reading-detail",
        difficulty: 3,
        stem: "Email excerpt: 'Please submit your reimbursement forms by March 8 so payments can be processed in this cycle.' What can be inferred?",
        explanation: "Deadline implies submissions after March 8 are processed later.",
        options: [
          { key: "A", text: "Forms submitted late may be paid in a later cycle." },
          { key: "B", text: "Only managers can request reimbursements." },
          { key: "C", text: "Payments are made in cash only." },
          { key: "D", text: "The reimbursement policy was canceled." },
        ],
        correctKey: "A",
      },
      {
        partNo: 7,
        skillTag: "reading-purpose",
        difficulty: 4,
        stem: "Web notice excerpt: 'Starting July 1, all training requests must be entered through the HR portal.' Why was this notice written?",
        explanation: "This is a policy update with a required new process.",
        options: [
          { key: "A", text: "To invite employees to a workshop" },
          { key: "B", text: "To introduce a mandatory request procedure" },
          { key: "C", text: "To announce a holiday schedule" },
          { key: "D", text: "To report quarterly training costs" },
        ],
        correctKey: "B",
      },
      {
        partNo: 7,
        skillTag: "reading-detail",
        difficulty: 4,
        stem: "Memo excerpt: 'The supplier confirmed that shipment 114B will arrive on Thursday, one day earlier than expected.' What is true?",
        explanation: "The memo explicitly states delivery is one day earlier.",
        options: [
          { key: "A", text: "Shipment 114B was canceled." },
          { key: "B", text: "Shipment 114B will arrive later than planned." },
          { key: "C", text: "Shipment 114B will arrive ahead of schedule." },
          { key: "D", text: "Shipment 114B is waiting for customs approval." },
        ],
        correctKey: "C",
      },
      {
        partNo: 5,
        skillTag: "grammar-preposition",
        difficulty: 2,
        stem: "The report must be submitted ___ Friday.",
        explanation: "Use 'by' to indicate a deadline no later than Friday.",
        options: [
          { key: "A", text: "at" },
          { key: "B", text: "by" },
          { key: "C", text: "for" },
          { key: "D", text: "with" },
        ],
        correctKey: "B",
      },
    ];

    questionSeed.forEach((seed, seedIndex) => {
      const parsed = extractPassageAndStem(seed.partNo, seed.stem);
      const normalizedReading = normalizeReadingContext(
        seed.partNo,
        parsed.stem,
        parsed.passage,
        seed.explanation,
      );
      const questionKey = this.buildQuestionSeedKey(
        seed.partNo,
        normalizedReading.stem,
        normalizedReading.passage,
        seed.options,
      );
      if (existingQuestionByKey.has(questionKey)) {
        return;
      }
      const mediaUrl = normalizeListeningMediaUrl(seed.mediaUrl, seed.partNo, seedIndex);
      const question: Question = {
        id: newId(),
        tenantId,
        partNo: seed.partNo,
        skillTag: seed.skillTag,
        difficulty: seed.difficulty,
        stem: normalizedReading.stem,
        passage: normalizedReading.passage,
        explanation: seed.explanation,
        mediaUrl,
        imageUrl: seed.imageUrl,
        source: "seed",
        status: "published",
        createdAt: nowIso(),
        createdBy,
        options: seed.options.map((opt) => ({
          key: opt.key,
          text: opt.text,
          isCorrect: opt.key === seed.correctKey,
        })),
      };
      this.questions.push(question);
      existingQuestionByKey.set(questionKey, question);
    });

    const allBankQuestions = this.questionBankDataset();
    allBankQuestions.forEach((raw, index) => {
      const sourceTag = raw.__source === "official_pack" ? "official_pack" : "bank";
      const partNo = Number(raw.partNo);
      if (!Number.isFinite(partNo) || partNo < 1 || partNo > 7) {
        return;
      }

      const stem = String(raw.stem ?? "").trim();
      if (!stem) {
        return;
      }

      const optionSource = Array.isArray(raw.options) ? raw.options : [];
      if (optionSource.length < 3) {
        return;
      }

      const options = optionSource
        .slice(0, 4)
        .map((item, optIndex) => ({
          key: ["A", "B", "C", "D"][optIndex] as "A" | "B" | "C" | "D",
          text: String(item?.text ?? "").trim(),
          sourceKey: String(item?.key ?? "").toUpperCase(),
        }))
        .filter((item) => item.text.length > 0);
      if (options.length < 3) {
        return;
      }
      padOptionsToFour(options, stem, partNo, sourceTag);

      const sourceCorrect = String(raw.correctKey ?? "").toUpperCase();
      let correctIndex = options.findIndex((item) => item.sourceKey === sourceCorrect);
      if (correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }
      const correctKey = options[correctIndex].key;

      const normalizedDifficulty = Math.max(1, Math.min(5, Number(raw.difficulty ?? 3)));
      const skillTag = String(raw.skillTag ?? "").trim() || defaultSkillTag(partNo);
      const explanation =
        String(raw.explanation ?? "")
          .replace(/Real TOEIC/gi, "TOEIC-style")
          .trim() ||
        "TOEIC-style practice item. Focus on choosing the option that best matches context and grammar.";
      const mediaUrl =
        String(raw.mediaUrl ?? "").trim() ||
        (partNo >= 1 && partNo <= 4 && sourceTag !== "official_pack"
          ? listeningMediaFor(partNo, index)
          : undefined);
      const imageUrl =
        partNo === 1
          ? normalizePart1Image(
              String(raw.imageUrl ?? "").trim() || undefined,
              stem,
              options.map((opt) => opt.text),
            )
          : String(raw.imageUrl ?? "").trim() || undefined;
      const parsed = extractPassageAndStem(partNo, stem, String(raw.passage ?? "").trim() || undefined);
      const normalizedReading = normalizeReadingContext(
        partNo,
        parsed.stem,
        parsed.passage,
        explanation,
      );
      const questionKey = this.buildQuestionSeedKey(
        partNo,
        normalizedReading.stem,
        normalizedReading.passage,
        options,
      );
      const existingQuestion = existingQuestionByKey.get(questionKey);
      if (existingQuestion && sourceTag !== "official_pack") {
        return;
      }
      const normalizedMediaUrl = normalizeListeningMediaUrl(mediaUrl, partNo, index, sourceTag);

      if (existingQuestion && sourceTag === "official_pack") {
        if (existingQuestion.source === "admin") {
          return;
        }
        existingQuestion.partNo = partNo;
        existingQuestion.skillTag = skillTag;
        existingQuestion.difficulty = normalizedDifficulty;
        existingQuestion.stem = normalizedReading.stem;
        existingQuestion.passage = normalizedReading.passage;
        existingQuestion.explanation = explanation;
        existingQuestion.mediaUrl = normalizedMediaUrl;
        existingQuestion.imageUrl = imageUrl;
        existingQuestion.source = "official_pack";
        existingQuestion.status = "published";
        existingQuestion.options = options.map((opt) => ({
          key: opt.key,
          text: opt.text,
          isCorrect: opt.key === correctKey,
        }));
        existingQuestionByKey.set(questionKey, existingQuestion);
        return;
      }

      const question: Question = {
        id: newId(),
        tenantId,
        partNo,
        skillTag,
        difficulty: normalizedDifficulty,
        stem: normalizedReading.stem,
        passage: normalizedReading.passage,
        explanation,
        mediaUrl: normalizedMediaUrl,
        imageUrl,
        source: sourceTag,
        status: "published",
        createdAt: nowIso(),
        createdBy,
        options: options.map((opt) => ({
          key: opt.key,
          text: opt.text,
          isCorrect: opt.key === correctKey,
        })),
      };
      this.questions.push(question);
      existingQuestionByKey.set(questionKey, question);
    });
  }

  private loadOfficialQuestionPack(): ImportedQuestion[] {
    if (this.officialPackCache) {
      return this.officialPackCache;
    }
    const candidatePaths = Array.from(
      new Set([
        resolve(this.officialPackFile),
        resolve(__dirname, "..", this.officialPackFile),
        resolve(__dirname, "..", "..", this.officialPackFile),
        resolve(__dirname, "..", "..", "..", this.officialPackFile),
      ]),
    );

    for (const packPath of candidatePaths) {
      if (!existsSync(packPath)) {
        continue;
      }
      try {
        const parsed = JSON.parse(readFileSync(packPath, "utf8")) as { questions?: ImportedQuestion[] };
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        if (questions.length > 0) {
          this.officialPackCache = questions;
          return questions;
        }
      } catch {
        // Try the next candidate path.
      }
    }
    this.officialPackCache = [];
    return [];
  }

  private officialStemSet(): Set<string> {
    return new Set(
      this.loadOfficialQuestionPack()
        .map((item) => String(item.stem ?? "").trim().toLowerCase())
        .filter((stem) => stem.length > 0),
    );
  }

  private questionBankDataset(): ImportedQuestionWithSource[] {
    if (this.questionBankCache) {
      return this.questionBankCache;
    }

    this.questionBankCache = [
      ...((questionBank as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion2 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion3 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion4 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion5 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion6 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion7 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...((questionBankExpansion8 as { questions?: ImportedQuestion[] }).questions ?? []).map((item) => ({
        ...item,
        __source: "bank" as const,
      })),
      ...this.loadOfficialQuestionPack().map((item) => ({
        ...item,
        __source: "official_pack" as const,
      })),
    ];
    return this.questionBankCache;
  }

  private normalizeTenantQuestions(tenantId: string): void {
    const partIndexes = new Map<number, number>();
    const questions = this.questions.filter((item) => item.tenantId === tenantId);
    const officialStems = this.officialStemSet();

    questions.forEach((question) => {
      const seq = partIndexes.get(question.partNo) ?? 0;
      partIndexes.set(question.partNo, seq + 1);

      if (!Array.isArray(question.options)) {
        question.options = [];
      }
      question.options = question.options
        .slice(0, 4)
        .map((opt, index) => ({
          key: ["A", "B", "C", "D"][index] as "A" | "B" | "C" | "D",
          text: String(opt?.text ?? "").trim(),
          isCorrect: Boolean(opt?.isCorrect),
        }))
        .filter((opt) => opt.text.length > 0);
      padOptionsToFour(question.options, question.stem, question.partNo, question.source ?? "legacy");
      if (question.options.filter((opt) => opt.isCorrect).length !== 1 && question.options.length > 0) {
        question.options = question.options.map((opt, index) => ({ ...opt, isCorrect: index === 0 }));
      }

      if (question.partNo >= 1 && question.partNo <= 4) {
        question.mediaUrl = normalizeListeningMediaUrl(
          question.mediaUrl,
          question.partNo,
          seq,
          question.source,
        );
      }
      if (question.partNo === 1) {
        question.imageUrl = normalizePart1Image(
          question.imageUrl,
          question.stem,
          question.options.map((opt) => opt.text),
        );
      }

      const parsed = extractPassageAndStem(question.partNo, question.stem, question.passage);
      const normalizedReading = normalizeReadingContext(
        question.partNo,
        parsed.stem,
        parsed.passage,
        question.explanation,
      );
      question.stem = normalizedReading.stem;
      question.passage = normalizedReading.passage;

      const stemKey = question.stem.trim().toLowerCase();
      if (officialStems.has(stemKey)) {
        question.source = "official_pack";
      } else if (!question.source || question.source === "official_pack") {
        question.source = "legacy";
      }
    });
  }

  private buildQuestionSeedKey(
    partNo: number,
    stem: string,
    passage?: string,
    options?: Array<{ text?: string } | string>,
  ): string {
    const normalizedPart = Number.isFinite(Number(partNo)) ? Number(partNo) : 0;
    const normalizedStem = String(stem ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const normalizedPassage = String(passage ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const normalizedOptions = (options ?? [])
      .map((item) => (typeof item === "string" ? item : String(item?.text ?? "")))
      .map((text) =>
        text
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((text) => text.length > 0)
      .join("||");
    const baseKey = normalizedPassage
      ? `p${normalizedPart}|${normalizedStem}|${normalizedPassage}`
      : `p${normalizedPart}|${normalizedStem}`;
    return normalizedOptions ? `${baseKey}|${normalizedOptions}` : baseKey;
  }

  private questionSourcePriority(source?: string): number {
    if (source === "official_pack") return 5;
    if (source === "admin") return 4;
    if (source === "seed") return 3;
    if (source === "bank") return 2;
    if (source === "legacy") return 1;
    return 0;
  }

  private archiveDuplicateTenantQuestions(tenantId: string): void {
    const keyed = new Map<string, Question[]>();
    this.questions.forEach((question) => {
      if (question.tenantId !== tenantId) {
        return;
      }
      if (question.source === "admin") {
        return;
      }
      const key = this.buildQuestionSeedKey(question.partNo, question.stem, question.passage, question.options);
      const bucket = keyed.get(key) ?? [];
      bucket.push(question);
      keyed.set(key, bucket);
    });

    const referencedQuestionIds = new Set(this.attemptItems.map((item) => item.questionId));
    const removableIds = new Set<string>();

    keyed.forEach((bucket) => {
      if (bucket.length <= 1) {
        return;
      }

      bucket.sort((a, b) => {
        const sourceDiff = this.questionSourcePriority(b.source) - this.questionSourcePriority(a.source);
        if (sourceDiff !== 0) {
          return sourceDiff;
        }
        const publishedDiff = Number(b.status === "published") - Number(a.status === "published");
        if (publishedDiff !== 0) {
          return publishedDiff;
        }
        const referencedDiff = Number(referencedQuestionIds.has(b.id)) - Number(referencedQuestionIds.has(a.id));
        if (referencedDiff !== 0) {
          return referencedDiff;
        }
        const passageDiff = String(b.passage ?? "").length - String(a.passage ?? "").length;
        if (passageDiff !== 0) {
          return passageDiff;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });

      const keeper = bucket[0];
      keeper.status = "published";
      bucket.slice(1).forEach((question) => {
        if (referencedQuestionIds.has(question.id)) {
          question.status = "archived";
          return;
        }
        removableIds.add(question.id);
      });
    });

    if (removableIds.size > 0) {
      this.questions = this.questions.filter((question) => !removableIds.has(question.id));
    }
  }

  ensureSeedVocabularyCards(tenantId: string, userId: string): void {
    const userCards = this.vocabularyCards
      .filter((card) => card.tenantId === tenantId && card.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.term.localeCompare(b.term));
    const existingKeys = new Set(
      userCards.map((card) => `${card.term.trim().toLowerCase()}::${card.pos.trim().toLowerCase()}`),
    );
    const seed = this.buildVocabularySeedCards();
    let queueIndex = userCards.length;

    seed.forEach((item) => {
      const key = `${item.term.trim().toLowerCase()}::${item.pos.trim().toLowerCase()}`;
      if (existingKeys.has(key)) {
        return;
      }
      this.vocabularyCards.push({
        id: newId(),
        tenantId,
        userId,
        term: item.term,
        pos: item.pos,
        definition: item.definition,
        example: item.example,
        sourcePart: item.sourcePart,
        tags: item.tags,
        easeFactor: 2.3,
        intervalDays: 0,
        dueAt: this.vocabularyDueDate(queueIndex),
        createdAt: nowIso(),
      });
      existingKeys.add(key);
      queueIndex += 1;
    });

    this.rebalanceVocabularySchedule(tenantId, userId);
  }

  private buildVocabularySeedCards(): VocabularySeedCard[] {
    if (this.vocabularySeedCache) {
      return this.vocabularySeedCache;
    }

    const curatedSeed = this.normalizeVocabularySeedCards([
      ...((vocabSeedData as { cards?: VocabularySeedCard[] }).cards ?? []),
      ...((vocabSeedData1 as { cards?: VocabularySeedCard[] }).cards ?? []),
      ...((vocabSeedData2 as { cards?: VocabularySeedCard[] }).cards ?? []),
    ]);
    const existingTerms = new Set(curatedSeed.map((item) => item.term.toLowerCase()));
    const generatedSeed = this.buildQuestionBankVocabularyCards(existingTerms);
    generatedSeed.forEach((item) => existingTerms.add(item.term.toLowerCase()));
    const dictionarySeed = this.buildDictionaryVocabularyCards(existingTerms);
    const shadowingSeed = this.buildShadowingCorpusVocabularyCards(existingTerms);

    const merged = new Map<string, VocabularySeedCard>();
    [...curatedSeed, ...generatedSeed, ...dictionarySeed, ...shadowingSeed].forEach((item) => {
      const key = item.term.trim().toLowerCase();
      if (!key || merged.has(key)) {
        return;
      }
      merged.set(key, item);
    });

    this.vocabularySeedCache = Array.from(merged.values());
    return this.vocabularySeedCache;
  }

  private buildDictionaryVocabularyCards(existingTerms: Set<string>): VocabularySeedCard[] {
    const sourcePaths = this.resolveVocabularyDictionaryPaths();
    if (sourcePaths.length === 0) {
      return [];
    }

    const cards: VocabularySeedCard[] = [];
    const entryPattern = /"([^"]+)":\s*\{\s*cn:\s*"((?:[^"\\]|\\.)*)"\s*,\s*ipa:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    for (const filePath of sourcePaths) {
      let source = "";
      try {
        source = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }

      let match: RegExpExecArray | null = null;
      while ((match = entryPattern.exec(source)) !== null) {
        const term = String(match[1] ?? "")
          .trim()
          .toLowerCase();
        if (!VOCAB_DICTIONARY_TERM_PATTERN.test(term)) {
          continue;
        }
        if (term.includes("  ")) {
          continue;
        }
        if (term.split(/\s+/).length > 6) {
          continue;
        }
        if (VOCAB_STOP_WORDS.has(term) || existingTerms.has(term)) {
          continue;
        }

        const pos = this.inferVocabularyPos(term);
        const cn = String(match[2] ?? "")
          .replace(/\\"/g, "\"")
          .replace(/\\n/g, " ")
          .replace(/\\t/g, " ")
          .trim();

        cards.push({
          term,
          pos,
          definition: cn ? `中文释义：${cn}` : this.generatedVocabularyDefinition(pos, 7),
          example: this.generatedVocabularyExample(term, pos),
          sourcePart: 7,
          tags: ["dictionary-sync", "shadowing"],
        });
        existingTerms.add(term);
      }
    }

    return cards;
  }

  private resolveVocabularyDictionaryPaths(): string[] {
    const candidates = [
      "apps/web/data/word-dictionary.ts",
      "apps/web/data/vocab-cn-overrides.ts",
      "../web/data/word-dictionary.ts",
      "../web/data/vocab-cn-overrides.ts",
      "../../web/data/word-dictionary.ts",
      "../../web/data/vocab-cn-overrides.ts",
      "../../../web/data/word-dictionary.ts",
      "../../../web/data/vocab-cn-overrides.ts",
      "../../../../web/data/word-dictionary.ts",
      "../../../../web/data/vocab-cn-overrides.ts",
    ].map((relativePath) => resolve(process.cwd(), relativePath));

    const fallbackFromDir = [
      resolve(__dirname, "../../web/data/word-dictionary.ts"),
      resolve(__dirname, "../../web/data/vocab-cn-overrides.ts"),
      resolve(__dirname, "../../../web/data/word-dictionary.ts"),
      resolve(__dirname, "../../../web/data/vocab-cn-overrides.ts"),
      resolve(__dirname, "../../../../web/data/word-dictionary.ts"),
      resolve(__dirname, "../../../../web/data/vocab-cn-overrides.ts"),
    ];

    return Array.from(new Set([...candidates, ...fallbackFromDir])).filter((filePath) => existsSync(filePath));
  }

  private buildShadowingCorpusVocabularyCards(existingTerms: Set<string>): VocabularySeedCard[] {
    const sources = [...this.loadShadowingCorpusTexts(), ...this.loadYoutubeSubtitleCorpusTexts()];
    if (sources.length === 0) {
      return [];
    }

    const frequency = new Map<string, number>();
    sources.forEach((text) => {
      this.extractVocabularyTokens(text).forEach((token) => {
        if (!VOCAB_DICTIONARY_TERM_PATTERN.test(token)) {
          return;
        }
        if (VOCAB_STOP_WORDS.has(token) || existingTerms.has(token)) {
          return;
        }
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
      });
    });

    const ranked = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5000);

    const cards: VocabularySeedCard[] = [];
    ranked.forEach(([term]) => {
      if (existingTerms.has(term)) {
        return;
      }
      const pos = this.inferVocabularyPos(term);
      cards.push({
        term,
        pos,
        definition: this.generatedVocabularyDefinition(pos, 7),
        example: this.generatedVocabularyExample(term, pos),
        sourcePart: 7,
        tags: ["corpus-sync", "shadowing"],
      });
      existingTerms.add(term);
    });
    return cards;
  }

  private loadShadowingCorpusTexts(): string[] {
    const files = this.resolveShadowingCorpusPaths();
    if (files.length === 0) {
      return [];
    }

    const textSet = new Set<string>();
    files.forEach((filePath) => {
      const lower = filePath.toLowerCase();
      let raw = "";
      try {
        raw = readFileSync(filePath, "utf8");
      } catch {
        return;
      }

      if (lower.endsWith("shadowing-materials.ts")) {
        const matches = raw.match(/text:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g) ?? [];
        matches.forEach((match) => {
          const text = match
            .replace(/^text:\s*"/, "")
            .replace(/"$/, "")
            .replace(/\\"/g, "\"")
            .trim();
          if (text) {
            textSet.add(text);
          }
        });
        return;
      }

      if (lower.endsWith(".json")) {
        try {
          this.extractTextsFromShadowingJson(raw).forEach((text) => textSet.add(text));
        } catch {
          // ignore invalid JSON corpus
        }
      }
    });

    return Array.from(textSet.values());
  }

  private extractTextsFromShadowingJson(raw: string): string[] {
    const parsed = JSON.parse(raw) as
      | Array<{ sentences?: Array<{ text?: string }> }>
      | { items?: Array<{ sentences?: Array<{ text?: string }> }> };

    const materials = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    const textSet = new Set<string>();
    materials.forEach((item) => {
      (item?.sentences ?? []).forEach((sentence) => {
        const text = String(sentence?.text ?? "").trim();
        if (text) {
          textSet.add(text);
        }
      });
    });
    return Array.from(textSet.values());
  }

  private resolveShadowingCorpusPaths(): string[] {
    const fromCwd = [
      "apps/web/data/shadowing-materials.ts",
      "apps/web/data/shadowing-materials-expanded-b.json",
      "apps/web/data/shadowing-materials-expanded-c.json",
      "apps/web/data/ted-latest-shadowing.json",
      "../web/data/shadowing-materials.ts",
      "../web/data/shadowing-materials-expanded-b.json",
      "../web/data/shadowing-materials-expanded-c.json",
      "../web/data/ted-latest-shadowing.json",
      "../../web/data/shadowing-materials.ts",
      "../../web/data/shadowing-materials-expanded-b.json",
      "../../web/data/shadowing-materials-expanded-c.json",
      "../../web/data/ted-latest-shadowing.json",
      "../../../web/data/shadowing-materials.ts",
      "../../../web/data/shadowing-materials-expanded-b.json",
      "../../../web/data/shadowing-materials-expanded-c.json",
      "../../../web/data/ted-latest-shadowing.json",
      "../../../../web/data/shadowing-materials.ts",
      "../../../../web/data/shadowing-materials-expanded-b.json",
      "../../../../web/data/shadowing-materials-expanded-c.json",
      "../../../../web/data/ted-latest-shadowing.json",
    ].map((relativePath) => resolve(process.cwd(), relativePath));

    const fromDir = [
      resolve(__dirname, "../../web/data/shadowing-materials.ts"),
      resolve(__dirname, "../../web/data/shadowing-materials-expanded-b.json"),
      resolve(__dirname, "../../web/data/shadowing-materials-expanded-c.json"),
      resolve(__dirname, "../../web/data/ted-latest-shadowing.json"),
      resolve(__dirname, "../../../web/data/shadowing-materials.ts"),
      resolve(__dirname, "../../../web/data/shadowing-materials-expanded-b.json"),
      resolve(__dirname, "../../../web/data/shadowing-materials-expanded-c.json"),
      resolve(__dirname, "../../../web/data/ted-latest-shadowing.json"),
      resolve(__dirname, "../../../../web/data/shadowing-materials.ts"),
      resolve(__dirname, "../../../../web/data/shadowing-materials-expanded-b.json"),
      resolve(__dirname, "../../../../web/data/shadowing-materials-expanded-c.json"),
      resolve(__dirname, "../../../../web/data/ted-latest-shadowing.json"),
    ];

    return Array.from(new Set([...fromCwd, ...fromDir])).filter((filePath) => existsSync(filePath));
  }

  private loadYoutubeSubtitleCorpusTexts(): string[] {
    const roots = this.resolveYoutubeSubtitleRoots();
    if (roots.length === 0) {
      return [];
    }

    const textSet = new Set<string>();
    roots.forEach((rootPath) => {
      this.collectFilesByExtension(rootPath, ".vtt").forEach((filePath) => {
        let raw = "";
        try {
          raw = readFileSync(filePath, "utf8");
        } catch {
          return;
        }
        const lines = raw.replace(/\uFEFF/g, "").split(/\r?\n/);
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }
          if (
            /^webvtt$/i.test(trimmed) ||
            /^kind:/i.test(trimmed) ||
            /^language:/i.test(trimmed) ||
            /^note\b/i.test(trimmed) ||
            /^\d+$/.test(trimmed) ||
            /-->/.test(trimmed)
          ) {
            return;
          }
          const plain = trimmed
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim();
          if (!plain || !/[a-z]/i.test(plain)) {
            return;
          }
          textSet.add(plain);
        });
      });
    });
    return Array.from(textSet.values());
  }

  private resolveYoutubeSubtitleRoots(): string[] {
    const fromCwd = [
      "apps/web/public/assets/youtube/ted-latest",
      "../web/public/assets/youtube/ted-latest",
      "../../web/public/assets/youtube/ted-latest",
      "../../../web/public/assets/youtube/ted-latest",
      "../../../../web/public/assets/youtube/ted-latest",
    ].map((relativePath) => resolve(process.cwd(), relativePath));

    const fromDir = [
      resolve(__dirname, "../../web/public/assets/youtube/ted-latest"),
      resolve(__dirname, "../../../web/public/assets/youtube/ted-latest"),
      resolve(__dirname, "../../../../web/public/assets/youtube/ted-latest"),
    ];

    return Array.from(new Set([...fromCwd, ...fromDir])).filter((filePath) => existsSync(filePath));
  }

  private collectFilesByExtension(rootPath: string, extension: string): string[] {
    const files: string[] = [];
    const stack = [rootPath];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || !existsSync(current)) {
        continue;
      }
      let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      entries.forEach((entry) => {
        const childPath = resolve(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(childPath);
          return;
        }
        if (entry.isFile() && childPath.toLowerCase().endsWith(extension.toLowerCase())) {
          files.push(childPath);
        }
      });
    }
    return files;
  }

  private normalizeVocabularySeedCards(cards: VocabularySeedCard[]): VocabularySeedCard[] {
    const dedup = new Map<string, VocabularySeedCard>();
    cards.forEach((item) => {
      const term = String(item.term ?? "").trim().toLowerCase();
      const pos = String(item.pos ?? "").trim().toLowerCase();
      const definition = String(item.definition ?? "").trim();
      if (!term || !pos || !definition) {
        return;
      }
      if (dedup.has(term)) {
        return;
      }
      dedup.set(term, {
        term,
        pos,
        definition,
        example: this.normalizeVocabularySentence(String(item.example ?? "").trim()),
        sourcePart: Number(item.sourcePart) >= 1 && Number(item.sourcePart) <= 7 ? Number(item.sourcePart) : 7,
        tags: Array.isArray(item.tags)
          ? item.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
          : [],
      });
    });
    return Array.from(dedup.values());
  }

  private buildQuestionBankVocabularyCards(existingTerms: Set<string>): VocabularySeedCard[] {
    type TokenStat = {
      count: number;
      contentHits: number;
      explanationHits: number;
      partCounts: Map<number, number>;
      tags: Set<string>;
      example?: string;
    };

    const tokenStats = new Map<string, TokenStat>();
    this.questionBankDataset().forEach((item) => {
      const partNo = Number(item.partNo);
      if (!Number.isFinite(partNo) || partNo < 1 || partNo > 7) {
        return;
      }

      const contentTexts = [
        String(item.stem ?? ""),
        String(item.passage ?? ""),
        ...(Array.isArray(item.options) ? item.options.map((opt) => String(opt?.text ?? "")) : []),
      ];
      contentTexts
        .flatMap((text) => this.splitVocabularySentences(text))
        .forEach((sentence) => {
          this.collectVocabularyTokens(sentence, partNo, "content", tokenStats, existingTerms);
        });

      this.splitVocabularySentences(String(item.explanation ?? "")).forEach((sentence) => {
        this.collectVocabularyTokens(sentence, partNo, "explanation", tokenStats, existingTerms);
      });
    });

    const minFrequency = 1;
    const minContentRatio = 0;
    const maxGenerated = 9000;
    const rankedTerms = Array.from(tokenStats.entries())
      .filter(([, stat]) => {
        if (stat.count < minFrequency) {
          return false;
        }
        if (stat.contentHits < 1) {
          return false;
        }
        return stat.contentHits >= Math.ceil(stat.count * minContentRatio);
      })
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, maxGenerated);

    return rankedTerms.map(([term, stat]) => {
      const sourcePart = this.dominantVocabularyPart(stat.partCounts);
      const pos = this.inferVocabularyPos(term);
      return {
        term,
        pos,
        definition: this.generatedVocabularyDefinition(pos, sourcePart),
        example: this.generatedVocabularyExample(term, pos, stat.example),
        sourcePart,
        tags: ["generated", "question-bank", ...Array.from(stat.tags).slice(0, 2)],
      };
    });
  }

  private collectVocabularyTokens(
    sentence: string,
    partNo: number,
    source: "content" | "explanation",
    tokenStats: Map<
      string,
      {
        count: number;
        contentHits: number;
        explanationHits: number;
        partCounts: Map<number, number>;
        tags: Set<string>;
        example?: string;
      }
    >,
    existingTerms: Set<string>,
  ): void {
    const tokens = this.extractVocabularyTokens(sentence);
    tokens.forEach((token) => {
      if (existingTerms.has(token)) {
        return;
      }
      const stat = tokenStats.get(token) ?? {
        count: 0,
        contentHits: 0,
        explanationHits: 0,
        partCounts: new Map<number, number>(),
        tags: new Set<string>(),
      };
      stat.count += 1;
      if (source === "content") {
        stat.contentHits += 1;
      } else {
        stat.explanationHits += 1;
      }
      stat.partCounts.set(partNo, (stat.partCounts.get(partNo) ?? 0) + 1);
      stat.tags.add(this.vocabularyTagByPart(partNo));
      if (!stat.example && source === "content") {
        stat.example = this.normalizeVocabularySentence(sentence);
      }
      tokenStats.set(token, stat);
    });
  }

  private splitVocabularySentences(text: string): string[] {
    return String(text ?? "")
      .split(/\r?\n+|(?<=[.!?])\s+/)
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter((item) => item.length >= 12 && item.length <= 220)
      .filter((item) => !item.includes("___"));
  }

  private extractVocabularyTokens(text: string): string[] {
    const rawTokens = text.toLowerCase().match(/[a-z][a-z'-]{1,}/g) ?? [];
    const dedup = new Set<string>();

    rawTokens.forEach((token) => {
      let normalized = token.replace(/^'+|'+$/g, "");
      normalized = normalized.replace(/-{2,}/g, "-");
      normalized = normalized.replace(/'+/g, "'");
      if (normalized.endsWith("'s")) {
        normalized = normalized.slice(0, -2);
      }
      if (normalized.endsWith("n't")) {
        normalized = normalized.slice(0, -3);
      }
      normalized = normalized.replace(/[^a-z'-]/g, "");
      normalized = normalized.replace(/^[-']+|[-']+$/g, "");
      const compact = normalized.replace(/[-']/g, "");
      if (compact.length < 3 || compact.length > 24) {
        return;
      }
      if (VOCAB_STOP_WORDS.has(normalized) || VOCAB_STOP_WORDS.has(compact)) {
        return;
      }
      if (normalized.startsWith("http") || normalized.startsWith("www")) {
        return;
      }
      dedup.add(normalized);
    });

    return Array.from(dedup.values());
  }

  private dominantVocabularyPart(partCounts: Map<number, number>): number {
    let bestPart = 7;
    let bestCount = 0;
    partCounts.forEach((count, partNo) => {
      if (count > bestCount || (count === bestCount && partNo < bestPart)) {
        bestCount = count;
        bestPart = partNo;
      }
    });
    return bestPart;
  }

  private vocabularyTagByPart(partNo: number): string {
    if (partNo === 1 || partNo === 2) {
      return "listening";
    }
    if (partNo === 3 || partNo === 4) {
      return "conversation";
    }
    if (partNo === 5) {
      return "grammar";
    }
    if (partNo === 6) {
      return "text-completion";
    }
    return "reading";
  }

  private inferVocabularyPos(term: string): string {
    if (term.endsWith("ly")) {
      return "adverb";
    }
    if (
      term.endsWith("ing") ||
      term.endsWith("ed") ||
      term.endsWith("ize") ||
      term.endsWith("ise") ||
      term.endsWith("ify")
    ) {
      return "verb";
    }
    if (
      term.endsWith("tion") ||
      term.endsWith("sion") ||
      term.endsWith("ment") ||
      term.endsWith("ness") ||
      term.endsWith("ity") ||
      term.endsWith("ship") ||
      term.endsWith("ance") ||
      term.endsWith("ence")
    ) {
      return "noun";
    }
    if (
      term.endsWith("ive") ||
      term.endsWith("able") ||
      term.endsWith("ible") ||
      term.endsWith("ous") ||
      term.endsWith("ical") ||
      term.endsWith("ic") ||
      term.endsWith("ary") ||
      term.endsWith("ory") ||
      term.endsWith("less") ||
      term.endsWith("ful") ||
      term.endsWith("al")
    ) {
      return "adjective";
    }
    return "noun";
  }

  private generatedVocabularyDefinition(pos: string, sourcePart: number): string {
    const context = sourcePart >= 5 ? "reading and grammar" : "listening and conversation";
    if (pos === "verb") {
      return `to do something commonly required in TOEIC ${context} contexts`;
    }
    if (pos === "adjective") {
      return `describing something often mentioned in TOEIC ${context} contexts`;
    }
    if (pos === "adverb") {
      return `in a way that is often used in TOEIC ${context} contexts`;
    }
    return `a term frequently used in TOEIC ${context} contexts`;
  }

  private generatedVocabularyExample(term: string, pos: string, sampled?: string): string {
    if (sampled) {
      return sampled;
    }
    if (pos === "verb") {
      return `Please ${term} the request before the deadline.`;
    }
    if (pos === "adjective") {
      return `The team proposed a ${term} solution for the client.`;
    }
    if (pos === "adverb") {
      return `The manager asked us to respond ${term} to the email.`;
    }
    return `The team reviewed the ${term} during the meeting.`;
  }

  private normalizeVocabularySentence(value: string): string {
    const normalized = value
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^[“"'`]+/, "")
      .replace(/[”"'`]+$/, "");
    if (!normalized) {
      return "";
    }
    if (normalized.length > 160) {
      return `${normalized.slice(0, 157).trimEnd()}...`;
    }
    if (/[.!?]$/.test(normalized)) {
      return normalized;
    }
    return `${normalized}.`;
  }

  private vocabularyDueDate(queueIndex: number): string {
    const dayOffset = Math.floor(Math.max(queueIndex, 0) / 30);
    const base = new Date();
    base.setDate(base.getDate() + dayOffset);
    return base.toISOString().slice(0, 10);
  }

  private rebalanceVocabularySchedule(tenantId: string, userId: string): void {
    const pendingCards = this.vocabularyCards
      .filter((card) => card.tenantId === tenantId && card.userId === userId)
      .filter((card) => card.intervalDays === 0 && typeof card.lastGrade !== "number");
    if (pendingCards.length <= 60) {
      return;
    }

    pendingCards
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.term.localeCompare(b.term))
      .forEach((card, index) => {
        card.dueAt = this.vocabularyDueDate(index);
      });
  }
}
