import * as XLSX from "xlsx";
import { prospectFirstName } from "@/lib/execution/renderMessage";

/**
 * Canonical prospect fields ↔ template variables:
 * {{first_name}} → firstName (fallback: first token of name)
 * {{company}}    → company
 * {{job_title}}  → jobTitle
 * {{pain_point}} → painPoint (fallback: campaign goals at send time)
 */
export const PROSPECT_COLUMN_ALIASES = {
  name: [
    "name",
    "full name",
    "fullname",
    "prospect name",
    "contact name",
    "contact",
    "person",
  ],
  firstName: ["first name", "firstname", "fname", "given name"],
  lastName: ["last name", "lastname", "lname", "surname", "family name"],
  company: [
    "company",
    "company name",
    "companyname",
    "organization",
    "organisation",
    "org",
    "account",
    "account name",
  ],
  jobTitle: [
    "job title",
    "jobtitle",
    "title",
    "role",
    "position",
    "designation",
  ],
  painPoint: [
    "pain point",
    "painpoint",
    "pain points",
    "company industry",
    "companyindustry",
    "industry",
    "sector",
  ],
  phone: ["phone", "phone number", "phonenumber", "mobile", "telephone", "tel"],
  whatsapp: [
    "whatsapp",
    "whatsapp no",
    "whatsapp number",
    "whatsappnumber",
    "wa number",
    "wa",
  ],
  email: ["email", "email address", "emailaddress", "e mail", "e-mail"],
  linkedinUrl: [
    "linkedin url",
    "linkedinurl",
    "linkedin",
    "linkedin profile",
    "linkedin link",
    "profile url",
  ],
  linkedinPublicUrl: [
    "linkedin public url",
    "linkedinpublicurl",
    "public linkedin",
    "public linkedin url",
  ],
};

export function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeaders(headerRow) {
  const mapping = {};
  const normalized = headerRow.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(PROSPECT_COLUMN_ALIASES)) {
    const index = normalized.findIndex((h) => h && aliases.includes(h));
    if (index >= 0) mapping[field] = index;
  }

  return mapping;
}

function cellValue(row, index) {
  if (index === undefined) return "";
  const value = row[index];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isHeadlessLinkedIn(url) {
  return /linkedin\.com\/search\/results\/people\/headless/i.test(url);
}

function resolveLinkedIn(row, mapping) {
  const publicUrl = cellValue(row, mapping.linkedinPublicUrl);
  const profileUrl = cellValue(row, mapping.linkedinUrl);

  if (publicUrl && !isHeadlessLinkedIn(publicUrl)) return publicUrl;
  if (profileUrl && !isHeadlessLinkedIn(profileUrl)) return profileUrl;
  return publicUrl || profileUrl || null;
}

function resolveName(row, mapping) {
  const direct = cellValue(row, mapping.name);
  if (direct) return direct;

  const first = cellValue(row, mapping.firstName);
  const last = cellValue(row, mapping.lastName);
  if (first || last) return [first, last].filter(Boolean).join(" ");

  return "";
}

function resolveFirstName(row, mapping, fullName) {
  const fromColumn = cellValue(row, mapping.firstName);
  if (fromColumn) return fromColumn;
  if (fullName) return prospectFirstName(fullName);
  return null;
}

function rowToProspect(row, mapping) {
  const name = resolveName(row, mapping);
  if (!name) return null;

  const firstName = resolveFirstName(row, mapping, name);
  const company = cellValue(row, mapping.company) || null;
  const jobTitle = cellValue(row, mapping.jobTitle) || null;
  const painPoint = cellValue(row, mapping.painPoint) || null;

  return {
    name,
    firstName,
    company,
    jobTitle,
    painPoint,
    phone: cellValue(row, mapping.phone) || null,
    whatsapp: cellValue(row, mapping.whatsapp) || null,
    email: cellValue(row, mapping.email) || null,
    linkedinUrl: resolveLinkedIn(row, mapping),
  };
}

export function parseProspectRows(rows) {
  if (!rows.length) {
    throw new Error("The spreadsheet is empty.");
  }

  const headerRow = rows[0].map((h) => String(h));
  const mapping = mapHeaders(headerRow);

  const hasNameColumn =
    mapping.name !== undefined || mapping.firstName !== undefined;

  if (!hasNameColumn) {
    const detected = headerRow.filter(Boolean).join(", ") || "(none)";
    throw new Error(
      `Missing name columns. Need "Name" or "firstName"/"lastName" (any casing). Found: ${detected}`
    );
  }

  const prospects = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !String(c ?? "").trim())) continue;

    const prospect = rowToProspect(row, mapping);
    if (!prospect) {
      errors.push(`Row ${i + 1}: name is required.`);
      continue;
    }

    prospects.push(prospect);
  }

  if (!prospects.length) {
    throw new Error("No valid prospect rows found in the file.");
  }

  return { prospects, errors, totalRows: rows.length - 1, mapping };
}

export function parseProspectExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        resolve(parseProspectRows(rows));
      } catch (err) {
        reject(new Error(err?.message || "Failed to parse Excel file."));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}
