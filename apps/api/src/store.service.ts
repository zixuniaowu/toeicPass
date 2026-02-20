import { Injectable } from "@nestjs/common";
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
import * as vocabSeedData from "./vocab-seed.json";

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

  ensureSeedQuestions(tenantId: string, createdBy?: string): void {
    const seededStemSet = new Set(
      this.questions
        .filter((item) => item.tenantId === tenantId)
        .map((item) => item.stem.trim().toLowerCase()),
    );

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

    questionSeed.forEach((seed) => {
      const stemKey = seed.stem.trim().toLowerCase();
      if (seededStemSet.has(stemKey)) {
        return;
      }
      this.questions.push({
        id: newId(),
        tenantId,
        partNo: seed.partNo,
        skillTag: seed.skillTag,
        difficulty: seed.difficulty,
        stem: seed.stem,
        explanation: seed.explanation,
        mediaUrl: seed.mediaUrl,
        imageUrl: seed.imageUrl,
        status: "published",
        createdAt: nowIso(),
        createdBy,
        options: seed.options.map((opt) => ({
          key: opt.key,
          text: opt.text,
          isCorrect: opt.key === seed.correctKey,
        })),
      });
      seededStemSet.add(stemKey);
    });

    const part1Images = [
      "/assets/images/listening/part1-filing-cabinets.jpg",
      "/assets/images/listening/part1-unloading-truck.jpg",
      "/assets/images/listening/part1-bicycles-real.jpg",
    ];
    const listeningMediaByPart: Record<number, string> = {
      1: "/assets/audio/toeic-official/practice-test-2-part-1.mp3",
      2: "/assets/audio/toeic-official/practice-test-2-part-2.mp3",
      3: "/assets/audio/toeic-official/practice-test-2-part-3.mp3",
      4: "/assets/audio/toeic-official/practice-test-2-part-4.mp3",
    };

    type ImportedQuestion = {
      partNo: number;
      skillTag?: string;
      difficulty?: number;
      stem?: string;
      explanation?: string;
      mediaUrl?: string;
      imageUrl?: string;
      options?: Array<{ key?: string; text?: string }>;
      correctKey?: string;
    };

    const allBankQuestions: ImportedQuestion[] = [
      ...(questionBank as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion2 as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion3 as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion4 as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion5 as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion6 as { questions: ImportedQuestion[] }).questions,
      ...(questionBankExpansion7 as { questions: ImportedQuestion[] }).questions,
    ];
    allBankQuestions.forEach((raw, index) => {
      const partNo = Number(raw.partNo);
      if (!Number.isFinite(partNo) || partNo < 1 || partNo > 7) {
        return;
      }

      const stem = String(raw.stem ?? "").trim();
      if (!stem) {
        return;
      }
      const stemKey = stem.toLowerCase();
      if (seededStemSet.has(stemKey)) {
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

      const sourceCorrect = String(raw.correctKey ?? "").toUpperCase();
      let correctIndex = options.findIndex((item) => item.sourceKey === sourceCorrect);
      if (correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }
      const correctKey = options[correctIndex].key;

      const normalizedDifficulty = Math.max(1, Math.min(5, Number(raw.difficulty ?? 3)));
      const skillTag = String(raw.skillTag ?? "").trim() || this.defaultSkillTag(partNo);
      const explanation =
        String(raw.explanation ?? "")
          .replace(/Real TOEIC/gi, "TOEIC-style")
          .trim() ||
        "TOEIC-style practice item. Focus on choosing the option that best matches context and grammar.";
      const mediaUrl =
        String(raw.mediaUrl ?? "").trim() ||
        (partNo >= 1 && partNo <= 4 ? listeningMediaByPart[partNo] : undefined);
      const imageUrl =
        String(raw.imageUrl ?? "").trim() ||
        (partNo === 1 ? part1Images[index % part1Images.length] : undefined);

      this.questions.push({
        id: newId(),
        tenantId,
        partNo,
        skillTag,
        difficulty: normalizedDifficulty,
        stem,
        explanation,
        mediaUrl,
        imageUrl,
        status: "published",
        createdAt: nowIso(),
        createdBy,
        options: options.map((opt) => ({
          key: opt.key,
          text: opt.text,
          isCorrect: opt.key === correctKey,
        })),
      });
      seededStemSet.add(stemKey);
    });
  }

  private defaultSkillTag(partNo: number): string {
    if (partNo === 1) return "photo-description";
    if (partNo === 2) return "question-response";
    if (partNo === 3) return "conversation-detail";
    if (partNo === 4) return "talk-detail";
    if (partNo === 5) return "grammar";
    if (partNo === 6) return "text-completion";
    return "reading-comprehension";
  }

  ensureSeedVocabularyCards(tenantId: string, userId: string): void {
    const exists = this.vocabularyCards.some(
      (card) => card.tenantId === tenantId && card.userId === userId,
    );
    if (exists) {
      return;
    }

    const dueToday = nowIso().slice(0, 10);
    const seed = (vocabSeedData as { cards: Array<{
      term: string;
      pos: string;
      definition: string;
      example: string;
      sourcePart: number;
      tags: string[];
    }> }).cards;

    seed.forEach((item) => {
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
        dueAt: dueToday,
        createdAt: nowIso(),
      });
    });
  }
}
