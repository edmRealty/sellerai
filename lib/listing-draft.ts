type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const draftFields = ['address', 'propertyLookupVersion', 'propertyPhoto', 'census', 'details', 'valuation', 'addons', 'acknowledgements', 'seller', 'finalPrice', 'photos', 'photosDeferred', 'description'] as const;
const paperworkFields = ['ownerRole', 'officialOwner', 'mailingAddress', 'brokerFeeConsent', 'brokerFeePercent', 'dualAgencyConsent', 'builtBefore1978', 'isMultiFamily', 'extraUploads'] as const;

export function buildListingDraft(input: JsonObject, existing: {
  data?: unknown;
  consumer_notice_status?: string | null;
  listing_agreement_status?: string | null;
} | null): JsonObject {
  const data = { ...object(existing?.data) };
  for (const field of draftFields) if (Object.hasOwn(input, field)) data[field] = input[field];
  const paperwork = { ...object(data.paperwork) };
  const submitted = object(input.paperwork);
  for (const field of paperworkFields) if (Object.hasOwn(submitted, field)) paperwork[field] = submitted[field];
  // Browser drafts never attest delivery, signature, or staff approval.
  paperwork.consumerNoticeStatus = existing?.consumer_notice_status ?? 'not_sent';
  paperwork.listingAgreementStatus = existing?.listing_agreement_status ?? 'not_sent';
  data.paperwork = paperwork;
  data.signed = paperwork.listingAgreementStatus === 'signed';
  data.activated = true; // This helper is called only after verified server authentication.
  return data;
}
