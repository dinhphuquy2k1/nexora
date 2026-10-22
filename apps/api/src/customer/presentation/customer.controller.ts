import { presentCustomer, presentCustomerPage } from "./customer.presenter";
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
  async list(@Req() req: ActorRequest, @Query() query: CustomerListQueryDto) {
    return presentCustomerPage(await this.service.list(req.user, query));
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
  async create(@Req() req: ActorRequest, @Body() body: CreateCustomerDto) {
    const result = await this.service.create(req.user, body);
    return { customer: presentCustomer(result.customer) };
  }
  @Get(":id")
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async get(@Req() req: ActorRequest, @Param("id") id: string) {
    const result = await this.service.get(req.user, id);
    return { customer: presentCustomer(result.customer) };
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
  async update(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() body: PatchCustomerDto,
  ) {
    const result = await this.service.update(req.user, id, body);
    return { customer: presentCustomer(result.customer) };
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
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      "LAST_CUSTOMER_ADDRESS before DEFAULT_ADDRESS_REASSIGN_REQUIRED; reassign default before deletion",
  })
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
