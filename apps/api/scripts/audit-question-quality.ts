import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { evaluateQuestionQuality, QuestionQualityIssue } from "../src/question-quality";
import { StoreService } from "../src/store.service";

type PartSummary = {
  total: number;
  valid: number;
  invalid: number;
};

type InvalidRow = {
  id: string;
  partNo: number;
  issues: QuestionQualityIssue[];
  stem: string;
};

function snippet(text: string, limit = 120): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}...`;
}

function parseOutputPath(argv: string[]): string | null {
  const arg = argv.find((item) => item.startsWith("--out="));
  if (!arg) {
    return null;
  }
  return arg.slice("--out=".length).trim() || null;
}

function run(): void {
  process.env.STORE_SNAPSHOT_FILE = "";
  const store = new StoreService();
  const tenantId = "__question_audit_tenant__";
  store.ensureSeedQuestions(tenantId, "__audit__");
  const questions = store.questions.filter((item) => item.tenantId === tenantId);

  const partStats = new Map<number, PartSummary>();
  const issueStats = new Map<QuestionQualityIssue, number>();
  const invalidRows: InvalidRow[] = [];

  questions.forEach((question) => {
    const report = evaluateQuestionQuality(question);
    const partSummary = partStats.get(question.partNo) ?? { total: 0, valid: 0, invalid: 0 };
    partSummary.total += 1;
    if (report.valid) {
      partSummary.valid += 1;
    } else {
      partSummary.invalid += 1;
      invalidRows.push({
        id: question.id,
        partNo: question.partNo,
        issues: report.issues,
        stem: snippet(question.stem),
      });
      report.issues.forEach((issue) => {
        issueStats.set(issue, (issueStats.get(issue) ?? 0) + 1);
      });
    }
    partStats.set(question.partNo, partSummary);
  });

  const orderedParts = Array.from(partStats.entries()).sort((a, b) => a[0] - b[0]);
  const invalidCount = invalidRows.length;
  const totalCount = questions.length;
  const validCount = totalCount - invalidCount;

  console.log("QUESTION_QUALITY_AUDIT");
  console.log(`TOTAL=${totalCount} VALID=${validCount} INVALID=${invalidCount}`);
  orderedParts.forEach(([partNo, stats]) => {
    console.log(`PART_${partNo} total=${stats.total} valid=${stats.valid} invalid=${stats.invalid}`);
  });

  console.log("TOP_ISSUES");
  Array.from(issueStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([issue, count]) => {
      console.log(`${issue}=${count}`);
    });

  console.log("INVALID_SAMPLES");
  invalidRows.slice(0, 40).forEach((row) => {
    console.log(`[Part ${row.partNo}] ${row.id} :: ${row.issues.join(", ")} :: ${row.stem}`);
  });

  const outputPath = parseOutputPath(process.argv.slice(2));
  if (outputPath) {
    const absolute = resolve(outputPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(
      absolute,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary: {
            total: totalCount,
            valid: validCount,
            invalid: invalidCount,
          },
          byPart: orderedParts.map(([partNo, stats]) => ({ partNo, ...stats })),
          issues: Array.from(issueStats.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([issue, count]) => ({ issue, count })),
          invalidRows,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`WROTE_REPORT=${absolute}`);
  }

  if (process.argv.includes("--strict") && invalidCount > 0) {
    process.exitCode = 1;
  }
}

run();
