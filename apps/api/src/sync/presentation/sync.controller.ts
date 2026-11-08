import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  Header,
} from "@nestjs/common";
import { ApiTags, ApiResponse, ApiQuery, ApiParam } from "@nestjs/swagger";
import type { Request } from "express";
import { OriginGuard } from "../../identity/presentation/origin.guard";
import { ApiErrorDto } from "../../http";
import { SyncService } from "../application/sync-admission.service";
import { SyncType } from "../domain/sync.constants";
import type { SyncJob, SyncSchedule } from "../application/sync.port";
import {
  CreateSyncJobDto,
  PatchSyncConfigDto,
  SyncJobResponseDto,
  SyncJobDetailResponseDto,
  SyncJobsResponseDto,
  SyncConfigsResponseDto,
  SyncConfigResponseDto,
} from "./sync.dto";
const job = (r: SyncJob) => ({
  id: r.id,
  syncType: r.sync_type,
  triggerSource: r.trigger_source,
  status: r.status,
  phase: r.processing_phase,
  fetchedCount: r.fetched_count,
  newCount: r.new_count,
  changedCount: r.changed_count,
  unchangedCount: r.unchanged_count,
  appliedCount: r.applied_count,
  rejectedCount: r.rejected_count,
  needsReviewCount: r.needs_review_count,
  startedAt: r.started_at?.toISOString() ?? null,
  finishedAt: r.finished_at?.toISOString() ?? null,
  createdAt: r.created_at.toISOString(),
  errorCode: r.last_error_code,
});
const schedule = (r: SyncSchedule) => ({
  latestJob: r.latest_job ? job(r.latest_job) : null,
  syncType: r.sync_type,
  enabled: r.enabled,
  available: r.available,
  intervalMinutes: r.interval_minutes,
  nextRunAt: r.next_run_at?.toISOString() ?? null,
  lastSuccessAt: r.last_success_at?.toISOString() ?? null,
  lastCompletedAt: r.last_completed_at?.toISOString() ?? null,
});
type AuthRequest = Request & { user: { id: string } };
@ApiTags("Sync")
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@Controller("carrier-connections/:id")
export class SyncController {
  constructor(private readonly service: SyncService) {}
  @Post("sync-jobs")
  @UseGuards(OriginGuard)
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 201, type: SyncJobResponseDto })
  async admit(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Body() body: CreateSyncJobDto,
  ) {
    return { job: job(await this.service.admit(r.user.id, id, body)) };
  }
  @Get("sync-jobs")
  @ApiQuery({
    name: "syncType",
    required: false,
    enum: Object.values(SyncType),
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description: "Comma-separated job status codes",
  })
  @ApiQuery({
    name: "from",
    required: false,
    type: String,
    format: "date-time",
  })
  @ApiQuery({
    name: "until",
    required: false,
    type: String,
    format: "date-time",
  })
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 200, type: SyncJobsResponseDto })
  @ApiQuery({ name: "page", required: false, type: "integer", minimum: 1 })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: "integer",
    minimum: 1,
    maximum: 100,
  })
  async jobs(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await this.service.jobs(r.user.id, id, query);
    return { ...result, jobs: result.jobs.map(job) };
  }
  @Get("sync-jobs/:jobId")
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 200, type: SyncJobDetailResponseDto })
  @ApiQuery({ name: "page", required: false, type: "integer", minimum: 1 })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: "integer",
    minimum: 1,
    maximum: 100,
  })
  async job(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const [row, issues] = await Promise.all([
      this.service.job(r.user.id, id, jobId),
      this.service.issues(r.user.id, id, jobId, query),
    ]);
    return {
      job: job(row),
      issueTotal: issues.total,
      issues: issues.issues.map((i) => ({
        id: i.id,
        sourceId: i.source_identity_id,
        sourceVersion: i.source_version,
        processorVersion: i.processor_version,
        outcome: i.processing_outcome,
        errorCode: i.last_error_code,
      })),
    };
  }
  @Get("sync-configs")
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 200, type: SyncConfigsResponseDto })
  async configs(@Req() r: AuthRequest, @Param("id") id: string) {
    return {
      configs: (await this.service.configs(r.user.id, id)).map(schedule),
    };
  }
  @Patch("sync-configs/:type")
  @UseGuards(OriginGuard)
  @Header("Cache-Control", "no-store")
  @ApiParam({ name: "type", enum: Object.values(SyncType) })
  @ApiResponse({ status: 200, type: SyncConfigResponseDto })
  async configure(
    @Req() r: AuthRequest,
    @Param("id") id: string,
    @Param("type") type: string,
    @Body() body: PatchSyncConfigDto,
  ) {
    return {
      config: schedule(await this.service.configure(r.user.id, id, type, body)),
    };
  }
}
