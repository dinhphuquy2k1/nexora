import { ApiProperty } from "@nestjs/swagger";
import { CarrierProvider, ConnectionStatus } from "../domain/carrier";
export class CarrierProviderSummaryDto {
  @ApiProperty({ enum: Object.values(CarrierProvider) }) provider!: string;
  @ApiProperty() displayName!: string;
}
export class CarriersDto {
  @ApiProperty({ type: [CarrierProviderSummaryDto] })
  carriers!: CarrierProviderSummaryDto[];
}
export class CarrierConnectionDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: Object.values(CarrierProvider) }) provider!: string;
  @ApiProperty() externalAccountId!: string;
  @ApiProperty({ type: String, nullable: true }) loginIdentifier!:
    | string
    | null;
  @ApiProperty({ minLength: 1, maxLength: 100 }) displayName!: string;
  @ApiProperty({ enum: Object.values(ConnectionStatus) }) status!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  lastVerifiedAt!: Date | null;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
}
export class ConnectionsDto {
  @ApiProperty({ type: [CarrierConnectionDto] })
  connections!: CarrierConnectionDto[];
}
export class ConnectionDto {
  @ApiProperty({ type: CarrierConnectionDto })
  connection!: CarrierConnectionDto;
}
export class RenameConnectionDto {
  @ApiProperty({ minLength: 1, maxLength: 100 }) displayName!: string;
}
export class ConnectionDeletedDto {
  @ApiProperty({ enum: [true] }) success!: boolean;
}
export class ConnectCarrierDto {
  @ApiProperty({ enum: Object.values(CarrierProvider) }) provider!: string;
  @ApiProperty({
    minLength: 1,
    maxLength: 128,
    description:
      "Required nonblank username for Uniship. Future providers without username/email will use their own request schema.",
  })
  loginIdentifier!: string;
  @ApiProperty({ minLength: 1, maxLength: 1024, writeOnly: true })
  password!: string;
  @ApiProperty({ minLength: 1, maxLength: 100 }) displayName!: string;
}
export class ReconnectCarrierDto {
  @ApiProperty({ minLength: 1, maxLength: 1024, writeOnly: true })
  password!: string;
}
