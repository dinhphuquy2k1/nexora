import { ApiProperty } from "@nestjs/swagger";

export class LoginRequestDto {
  @ApiProperty({ description: "Tên đăng nhập", example: "admin" })
  username!: string;

  @ApiProperty({ description: "Mật khẩu", example: "secret123" })
  password!: string;
}

export class UserDto {
  @ApiProperty({ description: "Mã định danh người dùng" })
  id!: string;

  @ApiProperty({ description: "Tên đăng nhập" })
  username!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class SessionResponseDto {
  @ApiProperty({ description: "Trạng thái xác thực", example: true })
  authenticated!: boolean;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ description: "Kết quả đăng xuất", example: true })
  success!: boolean;
}
