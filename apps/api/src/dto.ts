import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  tenantCode!: string;

  @IsString()
  @IsNotEmpty()
  tenantName!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  tenantCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class GoalDto {
  @IsInt()
  @Min(10)
  @Max(990)
  targetScore!: number;

  @IsDateString()
  targetExamDate!: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(990)
  currentScore?: number;
}

export class AnswerDto {
  @IsString()
  questionId!: string;

  @IsIn(["A", "B", "C", "D"])
  selectedKey!: "A" | "B" | "C" | "D";

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}

export class SubmitAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

export class StartMistakeDrillDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  partNo?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  limit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  questionIds?: string[];
}

export class MistakeNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;

  @IsOptional()
  @IsString()
  rootCause?: string;
}

export class GradeCardDto {
  @IsInt()
  @Min(0)
  @Max(5)
  grade!: number;
}

export class OAuthLoginDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  tenantCode?: string;
}

export class CreateQuestionDto {
  @IsInt()
  @Min(1)
  @Max(7)
  partNo!: number;

  @IsString()
  skillTag!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  difficulty!: number;

  @IsString()
  stem!: string;

  @IsString()
  explanation!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}

export class QuestionOptionDto {
  @IsIn(["A", "B", "C", "D"])
  key!: "A" | "B" | "C" | "D";

  @IsString()
  text!: string;

  @IsInt()
  @Min(0)
  @Max(1)
  isCorrect!: number;
}

export class CreateIpCampaignDto {
  @IsString()
  name!: string;

  @IsIn(["official", "simulation"])
  mode!: "official" | "simulation";

  @IsDateString()
  plannedDate!: string;
}

export class ImportCandidatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CandidateRowDto)
  candidates!: CandidateRowDto[];
}

export class CandidateRowDto {
  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateIpSessionDto {
  @IsString()
  sessionCode!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsInt()
  @Min(1)
  seatCapacity!: number;
}

export class CheckInDto {
  @IsString()
  candidateId!: string;
}

export class ImportIpResultsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IpResultRowDto)
  rows!: IpResultRowDto[];
}

export class IpResultRowDto {
  @IsString()
  candidateId!: string;

  @IsInt()
  @Min(5)
  @Max(495)
  scoreL!: number;

  @IsInt()
  @Min(5)
  @Max(495)
  scoreR!: number;
}

// ===== Subscription =====

export class SubscribeDto {
  @IsIn(["free", "basic", "premium", "enterprise"])
  planCode!: "free" | "basic" | "premium" | "enterprise";

  @IsOptional()
  @IsIn(["monthly", "yearly"])
  billingCycle?: "monthly" | "yearly";

  @IsOptional()
  @IsString()
  paymentToken?: string;
}

export class RecordAdEventDto {
  @IsString()
  @IsNotEmpty()
  placementId!: string;

  @IsIn(["impression", "click", "dismiss", "reward_complete"])
  eventType!: "impression" | "click" | "dismiss" | "reward_complete";
}

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  slot!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  linkUrl!: string;

  @IsString()
  @IsNotEmpty()
  ctaText!: string;

  @IsNumber()
  priority!: number;

  @IsArray()
  @IsString({ each: true })
  targetPlans!: string[];

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

// ── SRS enqueue ──────────────────────────────────────────────────────────────

export class SrsEnqueueDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  questionIds!: string[];

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  slot?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetPlans?: string[];

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ConversationReplyDto {
  @IsString()
  @IsNotEmpty()
  scenarioId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ValidateIf((_, value) => Array.isArray(value))
  history?: string[];
}

export class WritingEvaluateDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
