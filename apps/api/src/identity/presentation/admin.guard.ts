import { UserRole } from "../domain/user-policy";
import {
  Injectable,
  HttpException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { IdentityPort } from "../application/identity.port";
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly port: IdentityPort) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    if (!req.user)
      throw new HttpException(
        { code: "UNAUTHORIZED", message: "Chưa đăng nhập" },
        401,
      );
    if ((await this.port.findActiveRole(req.user.id)) !== UserRole.ADMIN)
      throw new HttpException(
        { code: "FORBIDDEN", message: "Không có quyền quản trị" },
        403,
      );
    return true;
  }
}
