import { generate } from "openapi-typescript-codegen";
import * as https from "https";
import * as http from "http";

const inputUrl =
  process.env.OPENAPI_URL || "http://localhost:8000/api/openapi.json";

function fetchJson(url: string): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as object);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main(): Promise<void> {
  try {
    const spec = await fetchJson(inputUrl);
    await generate({
      input: spec,
      output: "./lib/api/generated",
      exportCore: false,
      exportServices: false,
      exportModels: true,
    });
    console.log(`Generated client from ${inputUrl}`);
  } catch (err) {
    console.error("Failed to generate API types from OpenAPI document.");
    console.error("Is the backend running on the expected port?");
    console.error(err);
    process.exit(1);
  }
}

void main();
