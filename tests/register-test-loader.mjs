// node:test（strip-types）加载器注册：stub server-only、映射 @/ → src/。
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-loader-hooks.mjs", pathToFileURL("./tests/"));
