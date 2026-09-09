-- Migration 0006 — het instelveld "Decimalen" op een getal-kenmerk vervalt.
--
-- Een getal-kenmerk aanvaardt voortaan elke waarde die de gebruiker intikt,
-- met een komma als decimaalteken; er wordt niets meer af- of bijgerond op een
-- vooraf ingesteld aantal decimalen. De kolom (en haar CHECK) verdwijnt mee.

ALTER TABLE attribute_definition DROP COLUMN number_decimals;
