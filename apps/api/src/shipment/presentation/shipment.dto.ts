import { PaginationLimits } from "@nexora/shared/validation";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  LogisticsStage,
  ShipmentKind,
  ShipmentChargeCode,
  ShipmentMilestoneCode,
} from "@nexora/shared/shipment";
export class ShipmentQueryDto {
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: PaginationLimits.MAX_PAGE,
    default: PaginationLimits.DEFAULT_PAGE,
  })
  page?: string;
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: PaginationLimits.MAX_PAGE_SIZE,
    default: PaginationLimits.DEFAULT_PAGE_SIZE,
  })
  pageSize?: string;
  @ApiPropertyOptional({ type: String, maxLength: 256 }) q?: string;
  @ApiPropertyOptional({ type: String, enum: Object.values(LogisticsStage) })
  stage?: string;
  @ApiPropertyOptional({ type: String, enum: ["open"] }) claim?: string;
}
export class ShipmentHistoryQueryDto {
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: PaginationLimits.MAX_PAGE,
    default: PaginationLimits.DEFAULT_PAGE,
  })
  page?: string;
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: PaginationLimits.MAX_PAGE_SIZE,
    default: PaginationLimits.DEFAULT_PAGE_SIZE,
  })
  pageSize?: string;
}
export class ShipmentPaginationDto {
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483647 })
  page!: number;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) total!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) totalPages!: number;
}
export class ShipmentAmountSummaryDto {
  @ApiProperty({ type: String, enum: ["NONE", "SINGLE", "MULTIPLE"] })
  state!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  amount!: string | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
}
export class ShipmentChargeSummaryDto {
  @ApiProperty({ type: () => ShipmentAmountSummaryDto })
  unitPrice!: ShipmentAmountSummaryDto;
  @ApiProperty({ type: () => ShipmentAmountSummaryDto })
  domesticShipping!: ShipmentAmountSummaryDto;
  @ApiProperty({ type: Boolean }) hasInsurance!: boolean;
  @ApiProperty({ type: Boolean }) hasCounting!: boolean;
  @ApiProperty({ type: Boolean }) hasWoodPacking!: boolean;
  @ApiProperty({ type: Boolean }) hasBubbleWrap!: boolean;
}
export class ShipmentMilestoneSummaryDto {
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  originReceivedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  originDispatchedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  destReceivedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  destDispatchedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) destWarehouse!: string | null;
}
export class ShipmentItemSummaryDto {
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: "integer", minimum: 0 }) lineCount!: number;
}
export class ShipmentMilestoneDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String, enum: Object.values(ShipmentMilestoneCode) })
  milestoneCode!: string;
  @ApiProperty({ type: String, format: "date-time" }) occurredAt!: string;
  @ApiProperty({ type: String, nullable: true }) locationName!: string | null;
  @ApiProperty({ type: String, nullable: true }) providerLabel!: string | null;
}
export class ShipmentItemDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 32767 }) lineNo!: number;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: 2147483647,
    nullable: true,
  })
  quantity!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  unitValue!: string | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
}
export class ShipmentSummaryDto {
  @ApiProperty({ type: String, nullable: true }) originWarehouse!:
    | string
    | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  weightKg!: string | null;
  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: 2147483647,
    nullable: true,
  })
  packageCount!: number | null;
  @ApiProperty({
    type: "integer",
    minimum: 0,
    maximum: 2147483647,
    nullable: true,
  })
  itemCount!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  declaredValue!: string | null;
  @ApiProperty({ type: String, nullable: true }) declaredCurrency!:
    | string
    | null;
  @ApiProperty({ type: () => ShipmentChargeSummaryDto })
  chargeSummary!: ShipmentChargeSummaryDto;
  @ApiProperty({ type: () => ShipmentMilestoneSummaryDto })
  milestoneSummary!: ShipmentMilestoneSummaryDto;
  @ApiProperty({ type: () => ShipmentItemSummaryDto })
  itemSummary!: ShipmentItemSummaryDto;

  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) trackingCode!: string;
  @ApiProperty({ type: String, enum: Object.values(ShipmentKind) })
  shipmentKind!: string;
  @ApiProperty({ type: String, nullable: true }) provider!: string | null;
  @ApiProperty({ type: String, enum: Object.values(LogisticsStage) })
  logisticsStage!: string;
  @ApiProperty({ type: String, nullable: true }) providerStatus!: string | null;
  @ApiProperty({ type: String, nullable: true }) providerClaimStatus!:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) customerId!:
    | string
    | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  totalAmount!: string | null;
  @ApiProperty({ type: String, nullable: true }) totalCurrency!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
}
export class ShipmentChargeDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 32767 }) lineNo!: number;
  @ApiProperty({ type: String, enum: Object.values(ShipmentChargeCode) })
  chargeCode!: string;
  @ApiProperty({
    type: String,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  amount!: string;
  @ApiProperty({ type: String }) currency!: string;
  @ApiProperty({ type: String, nullable: true }) providerLabel!: string | null;
}
export class ShipmentDetailDto extends ShipmentSummaryDto {
  @ApiProperty({ type: () => ShipmentMilestoneDto, isArray: true })
  milestones!: ShipmentMilestoneDto[];
  @ApiProperty({ type: () => ShipmentItemDto, isArray: true })
  items!: ShipmentItemDto[];

  @ApiProperty({ type: String, nullable: true }) serviceLevel!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Exact decimal string; no monetary arithmetic or rounding",
  })
  exchangeRate!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  exchangeRateAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  providerUpdatedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  lastSyncedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  assigneeUserId!: string | null;
  @ApiProperty({ type: String, nullable: true }) internalNote!: string | null;
  @ApiProperty({ type: () => ShipmentChargeDto, isArray: true })
  charges!: ShipmentChargeDto[];
}
export class ShipmentHistoryDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483647 })
  sourceVersion!: number;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 2147483647 })
  processorVersion!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    enum: Object.values(LogisticsStage),
  })
  fromStage!: string | null;
  @ApiProperty({ type: String, enum: Object.values(LogisticsStage) })
  toStage!: string;
  @ApiProperty({ type: String, nullable: true }) providerStatus!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  providerChangedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) observedAt!: string;
}
export class ShipmentStageCountsDto {
  @ApiProperty({ type: "integer", minimum: 0 }) TO_ORIGIN_WAREHOUSE!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) AT_ORIGIN_WAREHOUSE!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) TO_DEST_WAREHOUSE!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) AT_DEST_WAREHOUSE!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) DELIVERED!: number;
  @ApiProperty({ type: "integer", minimum: 0 }) UNKNOWN!: number;
}
export class ShipmentStatsDto {
  @ApiProperty({ type: "integer", minimum: 0 }) total!: number;
  @ApiProperty({ type: () => ShipmentStageCountsDto })
  byStage!: ShipmentStageCountsDto;
  @ApiProperty({ type: "integer", minimum: 0, nullable: true, enum: [null] })
  claims!: null;
}
export class ShipmentPageDto {
  @ApiProperty({ type: () => ShipmentSummaryDto, isArray: true })
  shipments!: ShipmentSummaryDto[];
  @ApiProperty({ type: () => ShipmentPaginationDto })
  pagination!: ShipmentPaginationDto;
  @ApiProperty({ type: () => ShipmentStatsDto }) stats!: ShipmentStatsDto;
  @ApiProperty({ type: Boolean, enum: [false] }) claimFilterAvailable!: boolean;
}
export class ShipmentResponseDto {
  @ApiProperty({ type: () => ShipmentDetailDto }) shipment!: ShipmentDetailDto;
}
export class ShipmentHistoryPageDto {
  @ApiProperty({ type: () => ShipmentHistoryDto, isArray: true })
  history!: ShipmentHistoryDto[];
  @ApiProperty({ type: () => ShipmentPaginationDto })
  pagination!: ShipmentPaginationDto;
}
