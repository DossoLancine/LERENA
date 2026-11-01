-- Les sites existants reprennent l'adresse, la ville, la position et le téléphone de leur établissement
UPDATE "Branch" AS b
SET "address" = COALESCE(b."address", o."address"),
    "city"    = COALESCE(b."city", o."city"),
    "lat"     = COALESCE(b."lat", o."lat"),
    "lng"     = COALESCE(b."lng", o."lng"),
    "phone"   = COALESCE(b."phone", o."phone")
FROM "Organization" AS o
WHERE b."organizationId" = o."id";
