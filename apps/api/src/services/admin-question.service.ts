import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateQuestionDto } from "../dto";
import { RequestContext } from "../context";
import { evaluateQuestionQuality } from "../question-quality";
import { isAttemptSelectableQuestion } from "../question-policy";
import { StoreService } from "../store.service";
import { Question } from "../types";
import { newId, nowIso } from "../utils";

@Injectable()
export class AdminQuestionService {
  constructor(private readonly store: StoreService) {}

  createQuestion(ctx: RequestContext, dto: CreateQuestionDto): { questionId: string } {
    const correctCount = dto.options.filter((item) => Boolean(item.isCorrect)).length;
    if (correctCount !== 1) {
      throw new BadRequestException("Exactly one option must be marked correct");
    }
    const question = {
      id: newId(),
      tenantId: ctx.tenantId,
      partNo: dto.partNo,
      skillTag: dto.skillTag,
      difficulty: dto.difficulty,
      stem: dto.stem,
      explanation: dto.explanation,
      source: "admin" as const,
      status: "draft" as const,
      createdBy: ctx.userId,
      createdAt: nowIso(),
      options: dto.options.map((item) => ({
        key: item.key,
        text: item.text,
        isCorrect: Boolean(item.isCorrect),
      })),
    };
    this.store.questions.push(question);
    return { questionId: question.id };
  }

  publishQuestion(ctx: RequestContext, questionId: string): { questionId: string; status: string } {
    const question = this.store.questions.find(
      (item) => item.id === questionId && item.tenantId === ctx.tenantId,
    );
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    question.status = "published";
    return { questionId: question.id, status: question.status };
  }

  listQuestions(ctx: RequestContext, part?: number, difficulty?: number) {
    return this.store.questions.filter((item) => {
      if (item.tenantId !== ctx.tenantId) {
        return false;
      }
      if (typeof part === "number" && item.partNo !== part) {
        return false;
      }
      if (typeof difficulty === "number" && item.difficulty !== difficulty) {
        return false;
      }
      return true;
    });
  }

  getQuestionPoolHealth(ctx: RequestContext) {
    const questions = this.store.questions.filter((item) => item.tenantId === ctx.tenantId);
    const published = questions.filter((item) => item.status === "published");
    const byPart = new Map<
      number,
      {
        total: number;
        published: number;
        valid: number;
        attemptSelectable: number;
      }
    >();
    const issueCounts = new Map<string, number>();
    const publishedKeys = new Map<string, number>();

    const normalize = (value: string | undefined): string =>
      String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const questionKey = (question: Question): string => {
      const options = question.options.map((opt) => normalize(opt.text)).join("||");
      return `p${question.partNo}|${normalize(question.stem)}|${normalize(question.passage)}|${options}`;
    };

    questions.forEach((question) => {
      const report = evaluateQuestionQuality(question);
      const bucket = byPart.get(question.partNo) ?? {
        total: 0,
        published: 0,
        valid: 0,
        attemptSelectable: 0,
      };
      bucket.total += 1;
      if (question.status === "published") {
        bucket.published += 1;
      }
      if (report.valid) {
        bucket.valid += 1;
      } else {
        report.issues.forEach((issue) => {
          issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
        });
      }
      if (question.status === "published" && isAttemptSelectableQuestion(question)) {
        bucket.attemptSelectable += 1;
      }
      if (question.status === "published") {
        const key = questionKey(question);
        publishedKeys.set(key, (publishedKeys.get(key) ?? 0) + 1);
      }
      byPart.set(question.partNo, bucket);
    });

    const duplicatePublishedKeys = Array.from(publishedKeys.values()).filter((count) => count > 1).length;
    return {
      total: questions.length,
      published: published.length,
      attemptSelectablePublished: published.filter((item) => isAttemptSelectableQuestion(item)).length,
      duplicatePublishedKeys,
      byPart: Array.from(byPart.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([partNo, stats]) => ({
          partNo,
          ...stats,
        })),
      topIssues: Array.from(issueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([issue, count]) => ({ issue, count })),
    };
  }

  listAuditLogs(ctx: RequestContext) {
    return this.store.auditLogs
      .filter((item) => !item.tenantId || item.tenantId === ctx.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200);
  }
}
