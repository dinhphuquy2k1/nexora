import { Prisma } from "@nexora/database";
import type { ProviderOperation } from "../../domain/shipment";

type ChargesInput = NonNullable<ProviderOperation["charges"]>;
type MilestonesInput = NonNullable<ProviderOperation["milestones"]>;
type ServicesInput = NonNullable<ProviderOperation["services"]>;
type ItemsInput = NonNullable<ProviderOperation["items"]>;

/** Bulk unnest upsert preserving stable charge IDs and skipping unchanged rows. */
export function buildUpsertChargesQuery(
  shipmentId: string,
  charges: ChargesInput,
): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO shipment_charges (
      shipment_id,
      line_no,
      charge_code,
      amount,
      currency,
      provider_label
    )
    SELECT
      ${shipmentId}::uuid,
      x.line_no,
      x.charge_code,
      x.amount::numeric,
      x.currency,
      x.provider_label
    FROM unnest(
      ${charges.map((line) => line.lineNo)}::int[],
      ${charges.map((line) => line.chargeCode)}::text[],
      ${charges.map((line) => line.amount)}::text[],
      ${charges.map((line) => line.currency)}::text[],
      ${charges.map((line) => line.providerLabel)}::text[]
    ) AS x(line_no, charge_code, amount, currency, provider_label)
    ON CONFLICT (shipment_id, line_no)
    DO UPDATE SET
      charge_code = EXCLUDED.charge_code,
      amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      provider_label = EXCLUDED.provider_label
    WHERE (
      shipment_charges.charge_code,
      shipment_charges.amount,
      shipment_charges.currency,
      shipment_charges.provider_label
    ) IS DISTINCT FROM (
      EXCLUDED.charge_code,
      EXCLUDED.amount,
      EXCLUDED.currency,
      EXCLUDED.provider_label
    )
  `;
}

/** Bulk unnest upsert preserving stable milestone IDs and skipping unchanged rows. */
export function buildUpsertMilestonesQuery(
  shipmentId: string,
  milestones: MilestonesInput,
): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO shipment_milestones (
      shipment_id,
      milestone_code,
      occurred_at,
      location_name,
      provider_label
    )
    SELECT
      ${shipmentId}::uuid,
      x.milestone_code,
      x.occurred_at::timestamptz,
      x.location_name,
      x.provider_label
    FROM unnest(
      ${milestones.map((entry) => entry.milestoneCode)}::text[],
      ${milestones.map((entry) => entry.occurredAt)}::text[],
      ${milestones.map((entry) => entry.locationName)}::text[],
      ${milestones.map((entry) => entry.providerLabel)}::text[]
    ) AS x(milestone_code, occurred_at, location_name, provider_label)
    ON CONFLICT (shipment_id, milestone_code)
    DO UPDATE SET
      occurred_at = EXCLUDED.occurred_at,
      location_name = EXCLUDED.location_name,
      provider_label = EXCLUDED.provider_label
    WHERE (
      shipment_milestones.occurred_at,
      shipment_milestones.location_name,
      shipment_milestones.provider_label
    ) IS DISTINCT FROM (
      EXCLUDED.occurred_at,
      EXCLUDED.location_name,
      EXCLUDED.provider_label
    )
  `;
}

/** Bulk unnest upsert preserving stable service IDs and skipping unchanged rows. */
export function buildUpsertServicesQuery(
  shipmentId: string,
  services: ServicesInput,
): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO shipment_services (
      shipment_id,
      service_code,
      enabled
    )
    SELECT
      ${shipmentId}::uuid,
      x.service_code,
      x.enabled
    FROM unnest(
      ${services.map((entry) => entry.serviceCode)}::text[],
      ${services.map((entry) => entry.enabled)}::boolean[]
    ) AS x(service_code, enabled)
    ON CONFLICT (shipment_id, service_code)
    DO UPDATE SET
      enabled = EXCLUDED.enabled
    WHERE shipment_services.enabled IS DISTINCT FROM EXCLUDED.enabled
  `;
}

/** Bulk unnest upsert preserving stable item IDs and skipping unchanged rows. */
export function buildUpsertItemsQuery(
  shipmentId: string,
  items: ItemsInput,
): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO shipment_items (
      shipment_id,
      line_no,
      name,
      quantity,
      unit_value,
      currency
    )
    SELECT
      ${shipmentId}::uuid,
      x.line_no,
      x.name,
      x.quantity,
      x.unit_value::numeric,
      x.currency
    FROM unnest(
      ${items.map((line) => line.lineNo)}::int[],
      ${items.map((line) => line.name)}::text[],
      ${items.map((line) => line.quantity)}::int[],
      ${items.map((line) => line.unitValue)}::text[],
      ${items.map((line) => line.currency)}::text[]
    ) AS x(line_no, name, quantity, unit_value, currency)
    ON CONFLICT (shipment_id, line_no)
    DO UPDATE SET
      name = EXCLUDED.name,
      quantity = EXCLUDED.quantity,
      unit_value = EXCLUDED.unit_value,
      currency = EXCLUDED.currency
    WHERE (
      shipment_items.name,
      shipment_items.quantity,
      shipment_items.unit_value,
      shipment_items.currency
    ) IS DISTINCT FROM (
      EXCLUDED.name,
      EXCLUDED.quantity,
      EXCLUDED.unit_value,
      EXCLUDED.currency
    )
  `;
}
