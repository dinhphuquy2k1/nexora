import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { CustomerStatus } from "../domain/customer";
export class AddressInputDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  label?: string | null;
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 200,
    description: "Defaults to current customer name on create",
  })
  recipientName?: string;
  @ApiPropertyOptional({
    maxLength: 64,
    description: "Validated phone; defaults to customer phone on create",
  })
  recipientPhone?: string;
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 2,
    default: "VN",
    description: "ISO3166-1 alpha-2",
  })
  countryCode?: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 }) addressText!: string;
}
export class AddressPatchDto extends PartialType(AddressInputDto) {}
export class CreateCustomerDto {
  @ApiProperty({ minLength: 1, maxLength: 200 }) name!: string;
  @ApiProperty({
    maxLength: 64,
    description: "Valid national VN or international phone; stored E.164",
  })
  phone!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: "email",
    maxLength: 254,
  })
  email?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  note?: string | null;
  @ApiPropertyOptional({ type: AddressInputDto }) address?: AddressInputDto;
}
export class PatchCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ["address"] as const),
) {
  @ApiPropertyOptional({ enum: Object.values(CustomerStatus) })
  status?: CustomerStatus;
}
export class CustomerSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ example: "KH000001" }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: "+84912345678" }) phone!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ enum: Object.values(CustomerStatus) }) status!: CustomerStatus;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
export class CustomerAddressDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) label!: string | null;
  @ApiProperty() recipientName!: string;
  @ApiProperty() recipientPhone!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() addressText!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
export class CustomerDetailDto extends CustomerSummaryDto {
  @ApiProperty({ type: [CustomerAddressDto] }) addresses!: CustomerAddressDto[];
}
export class CustomerResponseDto {
  @ApiProperty({ type: CustomerDetailDto }) customer!: CustomerDetailDto;
}
export class AddressResponseDto {
  @ApiProperty({ type: CustomerAddressDto }) address!: CustomerAddressDto;
}
export class CustomerPaginationDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
export class CustomersResponseDto {
  @ApiProperty({ type: [CustomerSummaryDto] }) customers!: CustomerSummaryDto[];
  @ApiProperty({ type: CustomerPaginationDto })
  pagination!: CustomerPaginationDto;
}
export class CustomerListQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 }) page?: string;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  pageSize?: string;
  @ApiPropertyOptional({ maxLength: 200 }) q?: string;
  @ApiPropertyOptional({ enum: Object.values(CustomerStatus) })
  status?: CustomerStatus;
  @ApiPropertyOptional({
    maxLength: 64,
    description: "Exact match after phone normalization",
  })
  phone?: string;
}
export class DefaultAddressDto {
  @ApiProperty({ format: "uuid" }) addressId!: string;
}
export class AddressDeletedDto {
  @ApiProperty({ enum: [true] }) success!: boolean;
}
