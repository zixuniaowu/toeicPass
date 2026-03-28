import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "../app.service";
import { LoginDto, RegisterDto } from "../dto";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { ReqShape } from "../request-context";

@Controller("auth")
export class AuthController {
  constructor(private readonly appService: AppService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.appService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Headers("x-tenant-code") tenantCode?: string) {
    if (tenantCode && !dto.tenantCode) {
      dto.tenantCode = tenantCode;
    }
    return this.appService.login(dto);
  }

  @Post("refresh")
  @UseGuards(JwtAuthGuard)
  refresh(@Req() req: ReqShape) {
    if (!req.user?.sub) {
      throw new UnauthorizedException("Missing user");
    }
    return this.appService.refreshToken(req.user.sub);
  }
}
