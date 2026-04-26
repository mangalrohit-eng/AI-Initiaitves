/* One-off: node scripts/generate-assess-template.cjs */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "../public/assess-tower-template.xlsx");
const rows = [
  [
    "L2",
    "L3",
    "L4",
    "FTE_onshore",
    "FTE_offshore",
    "contractor_onshore",
    "contractor_offshore",
    "annual_spend_usd",
  ],
  ["PillarA", "Sub1", "Activity example 1", 2, 0, 0, 0, ""],
  ["PillarA", "Sub1", "Activity example 2", 1, 0, 0, 0, ""],
];
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Footprint");
fs.writeFileSync(out, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("Wrote", out);
