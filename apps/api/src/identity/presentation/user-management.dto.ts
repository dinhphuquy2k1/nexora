import { UserRole, UserStatus } from "../domain/user-policy";
import { ApiProperty } from "@nestjs/swagger";
import { UserDto } from "./auth.dto";
export class CreateOperatorDto {
  @ApiProperty({ example: "operator_one" }) username!: string;
}
export class SetupPasswordDto {
  @ApiProperty({
    description: "Single-use fragment token",
    minLength: 64,
    maxLength: 64,
  })
  token!: string;
  @ApiProperty({ minLength: 8, maxLength: 1024 }) password!: string;
}
export class SetupLinkDto {
  @ApiProperty() setupUrl!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: Date;
}
export class OperatorCreatedDto extends SetupLinkDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
}
export class SetupSuccessDto {
  @ApiProperty() success!: boolean;
}
export class StatusRequestDto {
  @ApiProperty({ enum: Object.values(UserStatus) }) status!: UserStatus;
}
export class ManagedUserDto extends UserDto {
  @ApiProperty({ enum: Object.values(UserRole) }) role!: UserRole;
  @ApiProperty({ enum: Object.values(UserStatus) }) status!: UserStatus;
  @ApiProperty() hasPassword!: boolean;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
}
export class ManagedUserResponseDto {
  @ApiProperty({ type: ManagedUserDto }) user!: ManagedUserDto;
}
export class UserListDto {
  @ApiProperty({ type: [ManagedUserDto] }) users!: ManagedUserDto[];
}
