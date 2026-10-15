import { test } from "node:test";
import assert from "node:assert/strict";
import { negotiate, parseAccept, qualityFor, varyAccept } from "../src/negotiate.js";

test("explicit text/markdown gets Markdown", () => {
  assert.equal(negotiate("text/markdown"), "markdown");
  assert.equal(negotiate("text/markdown, text/html;q=0.9"), "markdown");
  assert.equal(negotiate("text/markdown;q=0.5, text/html;q=0.5"), "markdown");
});

test("browsers, wildcards and missing headers keep HTML", () => {
  assert.equal(negotiate("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"), "html");
  assert.equal(negotiate("*/*"), "html");
  assert.equal(negotiate("text/*"), "html");
  assert.equal(negotiate(""), "html");
  assert.equal(negotiate(null), "html");
});

test("q-values are honoured", () => {
  assert.equal(negotiate("text/html, text/markdown;q=0.5"), "html");
  assert.equal(negotiate("text/html;q=0, text/markdown;q=0.1"), "markdown");
  assert.equal(negotiate("text/markdown;q=0, text/html"), "html");
});

test("unsupported types only are not acceptable (406)", () => {
  assert.equal(negotiate("application/json"), null);
  assert.equal(negotiate("image/png, application/pdf"), null);
  assert.equal(negotiate("text/markdown;q=0, text/html;q=0"), null);
});

test("text/plain gets the Markdown body labelled as plain text", () => {
  assert.equal(negotiate("text/plain"), "plain");
});

test("parser and helpers", () => {
  assert.deepEqual(parseAccept("Text/Markdown;Q=0.7"), [{ type: "text/markdown", q: 0.7 }]);
  assert.equal(qualityFor(parseAccept("text/*;q=0.4, */*;q=0.1"), "text/markdown"), 0.4);
  assert.equal(varyAccept(null), "Accept");
  assert.equal(varyAccept("Accept-Encoding"), "Accept-Encoding, Accept");
  assert.equal(varyAccept("accept"), "accept");
});
