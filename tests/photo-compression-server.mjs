import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import ts from "typescript";

// 운영 데이터와 연결하지 않고 실제 브라우저의 이미지 인코더를 검증합니다.
const files = {
  "/": new URL("./photo-compression.html", import.meta.url),
  "/compress-photo.ts": new URL(
    "../src/lib/compress-photo.ts",
    import.meta.url,
  ),
  "/proof-input.ts": new URL("../src/lib/proof-input.ts", import.meta.url),
};
createServer((request, response) => {
  const file = files[request.url];
  if (!file || request.method !== "GET") {
    response.writeHead(404).end();
    return;
  }
  const source = readFileSync(file, "utf8");
  const script = request.url.endsWith(".ts");
  response.writeHead(200, {
    "Content-Type": script ? "text/javascript" : "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(
    script
      ? ts.transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText
      : source,
  );
}).listen(3913, "127.0.0.1", () =>
  console.log("사진 압축 검증: http://127.0.0.1:3913"),
);
