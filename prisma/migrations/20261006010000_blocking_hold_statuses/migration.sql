-- Confirmed pay-separately reservations also hold the unit until they lapse.
DROP INDEX IF EXISTS "Hold_one_active_per_unit";
CREATE UNIQUE INDEX "Hold_one_active_per_unit" ON "Hold" ("locationKey", "unitId") WHERE "status" IN ('active', 'confirmed_pay_separately');
