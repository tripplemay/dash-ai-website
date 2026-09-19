// strip-types 测试钩子：server-only 是 Next 构建期标记（node_modules 无实体），
// @/ 是 tsconfig 路径别名（裸 node 不识别），src 内相对导入同样省略扩展名，统一补全。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = path.resolve(process.cwd(), "src");
const SERVER_ONLY_STUB = pathToFileURL(path.resolve(process.cwd(), "tests", "stubs", "server-only.mjs")).href;

function withExtension(filePath) {
  for (const candidate of [filePath, `${filePath}.ts`, `${filePath}.tsx`, `${filePath}.js`, `${filePath}.mjs`, path.join(filePath, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: SERVER_ONLY_STUB, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const resolved = withExtension(path.join(SRC_DIR, specifier.slice(2)));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    if (parentDir.startsWith(SRC_DIR)) {
      const resolved = withExtension(path.resolve(parentDir, specifier));
      if (resolved) return { url: resolved, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

// 裸 node ESM 要求 JSON import 带 attribute；Next 构建器则透明处理。测试时统一转成模块。
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = fs.readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source};\n`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
