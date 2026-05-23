import * as XLSX from "xlsx";

const COLUMN_ALIASES = {
  name: ["name", "full name", "prospect name", "contact name"],
  company: ["company", "organization", "organisation", "account"],
  jobTitle: ["job title", "title", "role", "position", "designation"],
  phone: ["phone", "phone number", "mobile", "telephone"],
  whatsapp: ["whatsapp", "whatsapp no", "whatsapp no.", "whatsapp number", "wa number"],
  email: ["email", "email address", "e-mail"],
  linkedinUrl: ["linkedurl", "linkedinurl", "linkedin url", "linkedin", "linkedin profile", "linkedin link"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function mapHeaders(row) {
  const mapping = {};
  const normalized = row.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const index = normalized.findIndex((h) => aliases.includes(h));
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

export function parseProspectExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (!rows.length) {
          reject(new Error("The spreadsheet is empty."));
          return;
        }

        const headerRow = rows[0].map((h) => String(h));
        const mapping = mapHeaders(headerRow);

        if (mapping.name === undefined) {
          reject(
            new Error(
              'Missing required column "name". Expected headers: name, company, job title, phone, whatsapp no., email, linkedinUrl.'
            )
          );
          return;
        }

        const prospects = [];
        const errors = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => !String(c ?? "").trim())) continue;

          const name = cellValue(row, mapping.name);
          if (!name) {
            errors.push(`Row ${i + 1}: name is required.`);
            continue;
          }

          prospects.push({
            name,
            company: cellValue(row, mapping.company) || null,
            jobTitle: cellValue(row, mapping.jobTitle) || null,
            phone: cellValue(row, mapping.phone) || null,
            whatsapp: cellValue(row, mapping.whatsapp) || null,
            email: cellValue(row, mapping.email) || null,
            linkedinUrl: cellValue(row, mapping.linkedinUrl) || null,
          });
        }

        if (!prospects.length) {
          reject(new Error("No valid prospect rows found in the file."));
          return;
        }

        resolve({ prospects, errors, totalRows: rows.length - 1 });
      } catch (err) {
        reject(new Error(err?.message || "Failed to parse Excel file."));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}
