import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAksLine, parseAksRowBlock } from "./lineParser.js";

test("AKS sample quotation rows", () => {
  const examples: Array<[string, string, number, string, string]> = [
    [
      "1 ABC111203 8 B&S 7.71MM [96/.32] BATTERY V90 $369.54 100MTS 30MTS",
      "ABC111203",
      369.54,
      "100MTS",
      "30MTS",
    ],
    [
      "2 ABC1120403 000 B&S 83.19MM [1035/.32] BATT V90 $1193.69 30MTS 30MTS",
      "ABC1120403",
      1193.69,
      "30MTS",
      "30MTS",
    ],
    [
      "3 ABC119203 6 B&S 13.5MM [168/.32] BATTERY V90 $655.41 100MTS 30MTS",
      "ABC119203",
      655.41,
      "100MTS",
      "30MTS",
    ],
    [
      "4 ABC128703 4 B&S 20.26MM [252/.32] BATTERY V90 $989.84 100MTS 30MTS",
      "ABC128703",
      989.84,
      "100MTS",
      "30MTS",
    ],
    [
      "5 ABC136403 3 B&S 26.45MM [329/.32] BATTERY V90 $1283.85 100MTS 30MTS",
      "ABC136403",
      1283.85,
      "100MTS",
      "30MTS",
    ],
    [
      "6 ABC145503 2 B&S 32.07MM [399/.32] BATTERY V90 $1586.43 100MTS 30MTS",
      "ABC145503",
      1586.43,
      "100MTS",
      "30MTS",
    ],
    [
      "7 ABC1492032 1 B&S 39.55MM [492/.32] BATTERY V90 $585.39 30MTS 30MTS",
      "ABC1492032",
      585.39,
      "30MTS",
      "30MTS",
    ],
    [
      "8 ABC1612032 0 B&S 49MM [608/.32] BATTERY V90 $704.08 30MTS 30MTS",
      "ABC1612032",
      704.08,
      "30MTS",
      "30MTS",
    ],
    [
      "9 ABC191003 00 B&S 64.15MM [798/.32] BATTERY V90 $3098.89 100MTS 30MTS",
      "ABC191003",
      3098.89,
      "100MTS",
      "30MTS",
    ],
  ];
  for (const [line, partNo, price, uom, moq] of examples) {
    const result = parseAksLine(line);
    assert.ok(result, `Failed to parse: ${line}`);
    assert.equal(result.partNo, partNo);
    assert.equal(result.price, price);
    assert.equal(result.uom, uom);
    assert.equal(result.moq, moq);
  }
});

test("Terms and conditions do not parse as products", () => {
  assert.equal(parseAksLine("Price valid for 30 days, excluding GST"), null);
  assert.equal(parseAksLine("4.1 Price and Payment $500 100MTS 30MTS"), null);
});

test("AKS wrapped description: price appears on continuation line", () => {
  const row = parseAksRowBlock([
    "4 ASC16503 4.59MM [57/.32] (6MM AUTO) V90",
    "Standard Non-Stripe Colours Only $231.19 100mt 30mts",
  ]);
  assert.ok(row);
  assert.equal(row.partNo, "ASC16503");
  assert.equal(
    row.description,
    "4.59MM [57/.32] (6MM AUTO) V90 Standard Non-Stripe Colours Only",
  );
  assert.equal(row.price, 231.19);
  assert.equal(row.uom, "100MT");
  assert.equal(row.moq, "30MTS");
});

test("AKS wrapped description: price appears before continuation", () => {
  const row = parseAksRowBlock([
    "4 ASC16503 4.59MM [57/.32] (6MM AUTO) V90 $231.19 100mt 30mts",
    "Standard Non-Stripe Colours Only",
  ]);
  assert.ok(row);
  assert.equal(
    row.description,
    "4.59MM [57/.32] (6MM AUTO) V90 Standard Non-Stripe Colours Only",
  );
  assert.equal(row.price, 231.19);
});

test("AKS ordinary single-line products stay supported", () => {
  const row = parseAksRowBlock([
    "5 AWC21603 3MM [2X14/.32] TWIN SHEATH V90 $132.93 100mt 30mts",
  ]);
  assert.ok(row);
  assert.equal(row.partNo, "AWC21603");
  assert.equal(row.description, "3MM [2X14/.32] TWIN SHEATH V90");
  assert.equal(row.price, 132.93);
});
