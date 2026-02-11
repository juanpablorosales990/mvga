-- Add VES direction enum for bidirectional P2P marketplace
CREATE TYPE "VesDirection" AS ENUM ('ON_RAMP', 'OFF_RAMP');

-- Add direction to VesOffer (ON_RAMP = buy USDC with VES, OFF_RAMP = sell USDC for VES)
ALTER TABLE "VesOffer" ADD COLUMN "direction" "VesDirection" NOT NULL DEFAULT 'ON_RAMP';

-- Add direction to VesOrder
ALTER TABLE "VesOrder" ADD COLUMN "direction" "VesDirection" NOT NULL DEFAULT 'ON_RAMP';

-- Add seller Pago Móvil details for OFF_RAMP orders (user selling USDC provides their bank info)
ALTER TABLE "VesOrder" ADD COLUMN "sellerBankCode" TEXT;
ALTER TABLE "VesOrder" ADD COLUMN "sellerBankName" TEXT;
ALTER TABLE "VesOrder" ADD COLUMN "sellerPhoneNumber" TEXT;
ALTER TABLE "VesOrder" ADD COLUMN "sellerCiNumber" TEXT;

-- Update indexes for direction-aware queries
CREATE INDEX "VesOffer_status_direction_idx" ON "VesOffer"("status", "direction");
CREATE INDEX "VesOrder_status_direction_idx" ON "VesOrder"("status", "direction");
CREATE INDEX "VesOffer_direction_idx" ON "VesOffer"("direction");
CREATE INDEX "VesOrder_direction_idx" ON "VesOrder"("direction");
