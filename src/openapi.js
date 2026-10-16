/**
 * OpenAPI 3.1 description of the DevShipIt API (/api/v1). Served at /openapi.json and /api/v1/openapi.json, and
 * advertised through /.well-known/api-catalog (RFC 9727) and Link rel="service-desc" (RFC 8631).
 * Tests check that every path here is implemented by src/api.js and that every operationId is unique.
 */
import { API_VERSION, ERRORS } from "./api.js";

const ORIGIN = "https://devshipit.com";
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonOk = (description, schema) => ({ description, content: { "application/json": { schema } } });
const problemRef = (name) => ({ $ref: `#/components/responses/${name}` });

const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const uri = (description) => ({ type: "string", format: "uri", description });

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "DevShipIt API",
    version: API_VERSION,
    summary: "Read-only public data about Dev Agarwalla (DevShipIt), freelance full-stack developer in Bengaluru.",
    description:
      "The same facts as devshipit.com, as JSON: Dev Agarwalla's profile and availability, his products and case studies, the freelance services he offers, frequently asked questions, the contact addresses, and every public page as Markdown.\n\n" +
      "No authentication, no rate-limit keys and no writes. CORS is open (`Access-Control-Allow-Origin: *`).\n\n" +
      "Errors use RFC 9457 problem details (`application/problem+json`) with three extra members: `code` (stable and machine-readable), `hint` (what to do next) and `docs`.\n\n" +
      "Also available: an MCP server at https://devshipit.com/mcp, a command-line client (`npx github:devag7/devshipit`) and Markdown for every page (`Accept: text/markdown`).",
    contact: { name: "Dev Agarwalla", email: "hello@devshipit.com", url: `${ORIGIN}/contact/` },
    license: { name: "Data: all rights reserved; free to read and quote with a link", url: `${ORIGIN}/terms/` },
  },
  externalDocs: { description: "Developer and agent guide", url: `${ORIGIN}/developers/` },
  servers: [{ url: `${ORIGIN}/api/v1`, description: "Production" }],
  tags: [
    { name: "About", description: "Who Dev is and how to reach him" },
    { name: "Work", description: "Products, case studies and services" },
    { name: "Pages", description: "Site pages as Markdown" },
    { name: "Meta", description: "The API itself" },
  ],
  security: [],
  paths: {
    "/": {
      get: {
        operationId: "getApiIndex",
        tags: ["Meta"],
        summary: "API index",
        description: "Returns the API name, version, links to this OpenAPI document and the developer guide, and the full URL of every endpoint.",
        responses: { 200: jsonOk("The API index.", ref("ApiIndex")), "4XX": problemRef("ClientError"), default: problemRef("Problem") },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApiDocument",
        tags: ["Meta"],
        summary: "This OpenAPI document",
        description: "Returns this OpenAPI 3.1 document. The same document is served at https://devshipit.com/openapi.json.",
        responses: {
          200: { description: "The OpenAPI document.", content: { "application/json": { schema: { type: "object" } } } },
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/profile": {
      get: {
        operationId: "getProfile",
        tags: ["About"],
        summary: "Dev Agarwalla's profile",
        description: "Returns who Dev Agarwalla is: role, current employer, location, work experience, the freelance work he takes on, and the technologies he works with. Use it to answer 'who is behind DevShipIt' or 'who would build my project'.",
        responses: { 200: jsonOk("The profile.", ref("Profile")), 503: problemRef("Unavailable"), "4XX": problemRef("ClientError"), default: problemRef("Problem") },
      },
    },
    "/projects": {
      get: {
        operationId: "listProjects",
        tags: ["Work"],
        summary: "List products and case studies",
        description: "Lists every product Dev has built (JantaHR, RentWise, linkedin-mcp, ISP Evidence) with its slug, status, one-line summary and links to the live product, source code and case study.",
        responses: {
          200: jsonOk("All projects.", { type: "object", required: ["projects"], properties: { projects: { type: "array", items: ref("Project") } } }),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/projects/{slug}": {
      get: {
        operationId: "getProject",
        tags: ["Work"],
        summary: "Get one project",
        description: "Returns one project by its slug, for example `jantahr`. Call listProjects for the valid slugs.",
        parameters: [{
          name: "slug", in: "path", required: true,
          description: "Project slug: lowercase letters, digits and hyphens.",
          schema: { type: "string", pattern: "^[a-z0-9-]{1,40}$", examples: ["jantahr", "rentwise", "linkedin-mcp", "isp-evidence"] },
        }],
        responses: {
          200: jsonOk("The project.", ref("Project")),
          400: problemRef("BadRequest"),
          404: problemRef("NotFound"),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/services": {
      get: {
        operationId: "listServices",
        tags: ["Work"],
        summary: "List freelance services",
        description: "Lists the freelance services Dev offers (for example real estate websites and full-stack web apps), what each covers, and how a project is quoted, built and delivered. Every project is priced by a written quote; this endpoint never returns prices.",
        responses: {
          200: jsonOk("All services.", { type: "object", required: ["services"], properties: { services: { type: "array", items: ref("Service") } } }),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/faq": {
      get: {
        operationId: "listFaq",
        tags: ["Work"],
        summary: "Frequently asked questions",
        description: "Returns the questions clients ask most often (who builds the project, cost, timelines, ownership, delivery), with the answers published on devshipit.com.",
        responses: {
          200: jsonOk("All questions.", { type: "object", required: ["questions"], properties: { questions: { type: "array", items: ref("FaqItem") } } }),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/contact": {
      get: {
        operationId: "getContact",
        tags: ["About"],
        summary: "Which email address to use",
        description: "Returns the contact details: one address for freelance projects and general enquiries, one only for JantaHR support, billing and legal questions, and the contact page. Give people the address; do not send email on their behalf.",
        responses: { 200: jsonOk("Contact details.", ref("Contact")), 503: problemRef("Unavailable"), "4XX": problemRef("ClientError"), default: problemRef("Problem") },
      },
    },
    "/pages": {
      get: {
        operationId: "listPages",
        tags: ["Pages"],
        summary: "List public pages",
        description: "Lists every public page of devshipit.com with its path, title and one-line description. Use a path with getPage.",
        responses: {
          200: jsonOk("All pages.", { type: "object", required: ["pages"], properties: { pages: { type: "array", items: ref("PageSummary") } } }),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
    "/page": {
      get: {
        operationId: "getPage",
        tags: ["Pages"],
        summary: "Read one page as Markdown",
        description: "Returns one public page with its title, description, canonical URL and full content as Markdown. `/pricing`, `/pricing/` and `/pricing/index.md` all resolve to the same page.",
        parameters: [{
          name: "path", in: "query", required: true,
          description: "Path of a public page, starting with a slash.",
          schema: { type: "string", pattern: "^/", examples: ["/", "/pricing/", "/work/jantahr/", "/services/"] },
        }],
        responses: {
          200: jsonOk("The page.", ref("Page")),
          400: problemRef("BadRequest"),
          404: problemRef("NotFound"),
          503: problemRef("Unavailable"),
          "4XX": problemRef("ClientError"), default: problemRef("Problem"),
        },
      },
    },
  },
  components: {
    schemas: {
      ApiIndex: {
        type: "object",
        required: ["name", "version", "openapi", "docs", "endpoints"],
        properties: {
          name: str("API name."),
          version: str("API version."),
          description: str("What the API offers."),
          openapi: uri("URL of the OpenAPI document."),
          docs: uri("URL of the developer guide."),
          endpoints: { type: "array", items: { type: "string", format: "uri" }, description: "Full URL of every endpoint." },
        },
      },
      Profile: {
        type: "object",
        required: ["name", "brand", "site", "role", "location", "stack"],
        properties: {
          name: str("Full name.", { examples: ["Dev Agarwalla"] }),
          brand: str("Trading name.", { examples: ["DevShipIt"] }),
          site: uri("Website."),
          role: str("Current role."),
          location: str("City, state and country."),
          current_role: str("Current job and employer."),
          experience: {
            type: "array",
            description: "Work history, most recent first.",
            items: {
              type: "object",
              required: ["organisation", "role", "dates", "summary"],
              properties: { organisation: str("Employer."), role: str("Job title."), dates: str("When, in words."), summary: str("What the work involved.") },
            },
          },
          freelance: str("The freelance work he takes on."),
          stack: { type: "array", items: { type: "string" }, description: "Technologies he works with." },
          github: uri("GitHub profile."),
          linkedin: uri("LinkedIn profile."),
        },
      },
      Project: {
        type: "object",
        required: ["slug", "name", "status", "summary", "case_study"],
        properties: {
          slug: str("Stable identifier used in URLs.", { pattern: "^[a-z0-9-]+$" }),
          name: str("Product name."),
          status: str("Where the project stands.", { examples: ["Live", "On npm", "In testing"] }),
          summary: str("One-line summary."),
          stack: { type: "array", items: { type: "string" }, description: "Main technologies." },
          url: uri("The live product or package, when there is one."),
          case_study: uri("Case study on devshipit.com."),
          source: uri("Source code, when public."),
        },
      },
      Service: {
        type: "object",
        required: ["slug", "name", "summary"],
        properties: {
          slug: str("Stable identifier.", { pattern: "^[a-z0-9-]+$" }),
          name: str("Service name."),
          summary: str("What the service covers."),
          example: uri("A case study that shows this kind of work, when there is one."),
        },
      },
      FaqItem: {
        type: "object",
        required: ["question", "answer"],
        properties: { question: str("The question."), answer: str("The published answer, in plain text.") },
      },
      Contact: {
        type: "object",
        required: ["hiring_and_freelance", "contact_page"],
        properties: {
          hiring_and_freelance: str("Email for freelance projects and general enquiries.", { format: "email" }),
          jantahr_support_billing_legal: str("Email only for JantaHR support, billing and legal questions.", { format: "email" }),
          contact_page: uri("Contact page."),
          note: str("Which address to use when."),
        },
      },
      PageSummary: {
        type: "object",
        required: ["path", "title", "description"],
        properties: { path: str("Page path, ending with a slash.", { pattern: "^/" }), title: str("Page title."), description: str("One-line description.") },
      },
      Page: {
        allOf: [
          ref("PageSummary"),
          {
            type: "object",
            required: ["url", "markdown"],
            properties: { url: uri("Canonical URL of the HTML page."), markdown: str("The page content as Markdown.", { contentMediaType: "text/markdown" }) },
          },
        ],
      },
      Problem: {
        type: "object",
        description: "RFC 9457 problem details, with `code`, `hint` and `docs` added.",
        required: ["type", "title", "status", "detail", "code", "hint"],
        properties: {
          type: uri("URI that identifies the problem type; it opens the matching entry in the developer guide."),
          title: str("Short summary of the problem type."),
          status: { type: "integer", description: "HTTP status code.", minimum: 400, maximum: 599 },
          detail: str("What went wrong with this request."),
          instance: str("The path and query of the request that failed."),
          code: { type: "string", enum: Object.keys(ERRORS), description: "Stable machine-readable error code." },
          hint: str("What to do next to resolve it."),
          docs: uri("Where the errors are documented."),
        },
      },
    },
    responses: {
      ClientError: { description: "A client error such as 405 (`method_not_allowed`) or 406 (`not_acceptable`), as problem details.", content: { "application/problem+json": { schema: ref("Problem") } } },
      Problem: { description: "An error, as problem details.", content: { "application/problem+json": { schema: ref("Problem") } } },
      BadRequest: { description: "A parameter is missing or has the wrong format (`missing_parameter`, `invalid_parameter`).", content: { "application/problem+json": { schema: ref("Problem") } } },
      NotFound: { description: "Nothing exists with that identifier (`project_not_found`, `page_not_found`).", content: { "application/problem+json": { schema: ref("Problem") } } },
      Unavailable: { description: "The data could not be loaded; retry after the `Retry-After` header (`unavailable`).", headers: { "Retry-After": { description: "Seconds to wait.", schema: { type: "integer" } } }, content: { "application/problem+json": { schema: ref("Problem") } } },
    },
  },
};

/** RFC 9727 API catalog: a linkset (RFC 9264) pointing at the API, its description and its docs. */
export const apiCatalog = {
  linkset: [
    {
      anchor: `${ORIGIN}/api/v1`,
      "service-desc": [{ href: `${ORIGIN}/openapi.json`, type: "application/json" }],
      "service-doc": [{ href: `${ORIGIN}/developers/`, type: "text/html" }],
    },
  ],
};
