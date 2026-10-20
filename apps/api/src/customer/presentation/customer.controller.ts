import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { OriginGuard } from "../../identity/presentation/origin.guard";
import { ApiErrorDto } from "../../http";
import { CustomerService } from "../application/customer.service";
import {
  AddressDeletedDto,
  AddressInputDto,
  AddressPatchDto,
  AddressResponseDto,
  CreateCustomerDto,
  CustomerListQueryDto,
  CustomerResponseDto,
  CustomersResponseDto,
  DefaultAddressDto,
  PatchCustomerDto,
} from "./customer.dto";
type ActorRequest = Request & { user: { id: string } };
@ApiTags("Customers")
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 500, type: ApiErrorDto })
@Controller("customers")
export class CustomerController {
  constructor(private readonly service: CustomerService) {}
  @Get()
  @ApiResponse({ status: 200, type: CustomersResponseDto })
  list(@Req() req: ActorRequest, @Query() query: CustomerListQueryDto) {
    return this.service.list(req.user, query);
  }
  @Post()
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "CUSTOMER_PHONE_EXISTS",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  create(@Req() req: ActorRequest, @Body() body: CreateCustomerDto) {
    return this.service.create(req.user, body);
  }
  @Get(":id")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  get(@Req() req: ActorRequest, @Param("id") id: string) {
    return this.service.get(req.user, id);
  }
  @Patch(":id")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "CUSTOMER_PHONE_EXISTS",
  })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  update(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() body: PatchCustomerDto,
  ) {
    return this.service.update(req.user, id, body);
  }
  @Post(":id/addresses")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 201, type: AddressResponseDto })
  add(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() body: AddressInputDto,
  ) {
    return this.service.addAddress(req.user, id, body);
  }
  @Patch(":id/addresses/:addressId")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: AddressResponseDto })
  updateAddress(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Param("addressId") addressId: string,
    @Body() body: AddressPatchDto,
  ) {
    return this.service.updateAddress(req.user, id, addressId, body);
  }
  @Delete(":id/addresses/:addressId")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: AddressDeletedDto })
  remove(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Param("addressId") addressId: string,
  ) {
    return this.service.removeAddress(req.user, id, addressId);
  }
  @Put(":id/default-address")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @UseGuards(OriginGuard)
  @ApiResponse({ status: 200, type: AddressResponseDto })
  setDefault(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() body: DefaultAddressDto,
  ) {
    return this.service.setDefault(req.user, id, body);
  }
}
