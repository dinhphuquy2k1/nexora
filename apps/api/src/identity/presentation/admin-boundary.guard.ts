import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { AdminGuard } from "./admin.guard";
import { isAdminBoundary } from "./admin-boundary";
@Injectable()
export class AdminBoundaryGuard implements CanActivate {
  constructor(private readonly admin: AdminGuard) {}
  canActivate(context: ExecutionContext) {
    return isAdminBoundary(context) ? this.admin.canActivate(context) : true;
  }
}
