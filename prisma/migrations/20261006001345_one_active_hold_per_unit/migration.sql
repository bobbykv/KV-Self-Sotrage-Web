-- At most one active website hold per SiteLink unit. Inserting the Hold row is
-- how a checkout claims a unit, so concurrent visitors can't both hold it.
CREATE UNIQUE INDEX "Hold_one_active_per_unit" ON "Hold" ("locationKey", "unitId") WHERE "status" = 'active';
