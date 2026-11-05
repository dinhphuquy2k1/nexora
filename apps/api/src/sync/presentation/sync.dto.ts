import { ApiProperty } from "@nestjs/swagger";
import {
  SyncJobStatus,
  SyncProcessingPhase,
  SyncType,
  SyncTrigger,
} from "../domain/sync.constants";
export class CreateSyncJobDto {
  @ApiProperty({ enum: Object.values(SyncType) }) syncType!: string;
}
export class PatchSyncConfigDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: "integer", enum: [15, 30, 60, 120, 240] })
  intervalMinutes!: number;
}
export class SyncJobDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: Object.values(SyncType) }) syncType!: string;
  @ApiProperty({ enum: Object.values(SyncTrigger) }) triggerSource!: string;
  @ApiProperty({ enum: Object.values(SyncJobStatus) }) status!: string;
  @ApiProperty({ enum: Object.values(SyncProcessingPhase) }) phase!: string;
  @ApiProperty({ type: "integer" }) fetchedCount!: number;
  @ApiProperty({ type: "integer" }) newCount!: number;
  @ApiProperty({ type: "integer" }) changedCount!: number;
  @ApiProperty({ type: "integer" }) unchangedCount!: number;
  @ApiProperty({ type: "integer" }) appliedCount!: number;
  @ApiProperty({ type: "integer" }) rejectedCount!: number;
  @ApiProperty({ type: "integer" }) needsReviewCount!: number;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  startedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  finishedAt!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) errorCode!: string | null;
}
export class SyncJobResponseDto {
  @ApiProperty({ type: SyncJobDto }) job!: SyncJobDto;
}
export class SyncJobSummaryDto {
  @ApiProperty({ type: "integer" }) total!: number;
  @ApiProperty({ type: "integer" }) completed!: number;
  @ApiProperty({ type: "integer" }) running!: number;
  @ApiProperty({ type: "integer" }) failed!: number;
}
export class SyncIssueDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) sourceId!: string;
  @ApiProperty({ type: "integer" }) sourceVersion!: number;
  @ApiProperty({ type: "integer" }) processorVersion!: number;
  @ApiProperty({ enum: ["NEEDS_REVIEW", "REJECTED_SOURCE", "RETRYABLE_ERROR"] })
  outcome!: string;
  @ApiProperty({ type: String, nullable: true }) errorCode!: string | null;
}
export class SyncJobDetailResponseDto extends SyncJobResponseDto {
  @ApiProperty({ type: [SyncIssueDto] }) issues!: SyncIssueDto[];
  @ApiProperty({ type: "integer" }) issueTotal!: number;
}
export class SyncJobsResponseDto {
  @ApiProperty({ type: SyncJobSummaryDto }) summary!: SyncJobSummaryDto;
  @ApiProperty({ isArray: true, enum: Object.values(SyncType) })
  types!: string[];
  @ApiProperty({ type: [SyncJobDto] }) jobs!: SyncJobDto[];
  @ApiProperty({ type: "integer" }) total!: number;
  @ApiProperty({ type: "integer" }) page!: number;
  @ApiProperty({ type: "integer" }) pageSize!: number;
}
export class SyncConfigDto {
  @ApiProperty({ type: SyncJobDto, nullable: true })
  latestJob!: SyncJobDto | null;
  @ApiProperty({ enum: Object.values(SyncType) }) syncType!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: "integer", enum: [15, 30, 60, 120, 240] })
  intervalMinutes!: number;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  nextRunAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  lastSuccessAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  lastCompletedAt!: string | null;
}
export class SyncConfigsResponseDto {
  @ApiProperty({ type: [SyncConfigDto] }) configs!: SyncConfigDto[];
}
export class SyncConfigResponseDto {
  @ApiProperty({ type: SyncConfigDto }) config!: SyncConfigDto;
}
