import { expect, test, describe } from "bun:test";
import { getOpenApiDocument } from "../server/openapi";
import docs from "../server/routes/docs";

describe("OpenAPI Automated Documentation (@hono/zod-openapi)", () => {
  test("generates valid OpenAPI 3.0 document with all canonical resource groups", () => {
    const doc = getOpenApiDocument();

    expect(doc).toBeDefined();
    expect(doc.openapi).toStartWith("3.0");
    expect(doc.info.title).toBe("Koperasi API");
    expect(doc.info.version).toBe("1.0.0");

    const paths = Object.keys(doc.paths || {});
    expect(paths.length).toBeGreaterThanOrEqual(40);

    const tags = new Set(doc.tags?.map((t: any) => t.name) || []);
    for (const requiredTag of [
      "auth",
      "member-auth",
      "members",
      "loans",
      "savings",
      "shu",
      "npl",
      "cashflow",
      "reports",
    ]) {
      expect(tags.has(requiredTag)).toBe(true);
    }
  });

  test("contains all required response envelope schemas in components.schemas", () => {
    const doc = getOpenApiDocument();
    const schemas = doc.components?.schemas || {};

    const required = [
      "ApiSuccessEnvelope",
      "ApiDataEnvelope",
      "ApiMessageEnvelope",
      "ApiErrorEnvelope",
      "PaginatedList",
    ];

    for (const schemaName of required) {
      expect(schemas[schemaName]).toBeDefined();
    }
  });

  test("serves /openapi.json, /openapi.yaml, and /doc with HTTP 200", async () => {
    const resJson = await docs.request("/openapi.json");
    expect(resJson.status).toBe(200);
    expect(resJson.headers.get("content-type")).toContain("application/json");

    const bodyJson = (await resJson.json()) as any;
    expect(bodyJson.openapi).toStartWith("3.0");

    const resYaml = await docs.request("/openapi.yaml");
    expect(resYaml.status).toBe(200);
    expect(resYaml.headers.get("content-type")).toContain("application/yaml");
    const bodyYaml = await resYaml.text();
    expect(bodyYaml).toContain("openapi: 3.0");

    const resDoc = await docs.request("/doc");
    expect(resDoc.status).toBe(200);
    expect(resDoc.headers.get("content-type")).toContain("text/html");
    const html = await resDoc.text();
    expect(html).toContain("swagger-ui");
  });
});
