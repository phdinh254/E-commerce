import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CouponsService } from './coupons.service';
import { FeaturedCouponQueryDto } from './dto/featured-query.dto';
import { FeaturedCouponResponseDto } from './dto/featured-coupon-response.dto';

@ApiTags('coupons')
@Controller({ path: 'coupons' })
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Mã giảm giá nổi bật cho marketing (public)' })
  @ApiResponse({ status: 200, type: [FeaturedCouponResponseDto] })
  featured(
    @Query() query: FeaturedCouponQueryDto,
  ): Promise<FeaturedCouponResponseDto[]> {
    return this.couponsService.getFeatured(query.limit);
  }
}
