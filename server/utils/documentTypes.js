// Documents a store must (or may) submit when applying on PureGasly.
// Change `required` here and both the API and the sign-up form follow
// (the client fetches nothing - keep client/src/utils/documentTypes.js in sync).
const DOCUMENT_TYPES = [
  { key: 'business_registration', label: 'DTI / SEC Business Registration Certificate', required: true },
  { key: 'business_permit', label: "Mayor's / Business Permit", required: true },
  { key: 'government_id', label: "Owner's Valid Government ID", required: true },
  { key: 'bir_certificate', label: 'BIR Certificate of Registration (Form 2303)', required: false },
  { key: 'fire_safety', label: 'Fire Safety Inspection Certificate (BFP)', required: false },
  { key: 'doe_accreditation', label: 'DOE LPG Dealer / Retailer Accreditation', required: false },
  { key: 'store_photo', label: 'Photo of Store Front', required: false },
];

const KEYS = DOCUMENT_TYPES.map((d) => d.key);
const REQUIRED_KEYS = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.key);
const labelOf = (key) => (DOCUMENT_TYPES.find((d) => d.key === key) || {}).label || key;

module.exports = { DOCUMENT_TYPES, KEYS, REQUIRED_KEYS, labelOf };
