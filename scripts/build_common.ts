/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable no-console */
import fs from "fs";
import { build, BuildOptions, context, Plugin } from "esbuild";
import { nativeNodeModulesPlugin } from "../third_party/github.com/evanw/esbuild/native-modules-plugin";
import * as path from "path";
import { execSync } from "child_process";
import { noNodeModulesSourceMaps } from "../third_party/github.com/evanw/esbuild/no-node-modules-sourcemaps";
import svgrPlugin from "esbuild-plugin-svgr";
import { fetchKeytar, targetKeytarMap } from "./utils/fetch_keytar";
import { fetchDuckDB, targetDuckDBMap } from "./utils/fetch_duckdb";

import { generateDisclaimer } from "./license_disclaimer";

export type Target =
  | "linux-x64"
  | "linux-arm64"
  | "linux-armhf"
  | "alpine-x64"
  | "alpine-arm64"
  | "darwin-x64"
  | "darwin-arm64"
  | "win32-x64";

export const outDir = "dist/";

// This plugin replaces keytar's attempt to load the keytar.node native binary (built in node_modules
// on npm install) with a require function to load a .node file from the filesystem
const keytarReplacerPlugin: Plugin = {
  name: "keytarReplacer",
  setup(build) {
    build.onResolve({ filter: /build\/Release\/keytar.node/ }, (args) => {
      return {
        path: args.path,
        namespace: "keytar-replacer",
      };
    });
    build.onLoad(
      { filter: /build\/Release\/keytar.node/, namespace: "keytar-replacer" },
      (_args) => {
        return {
          contents: `
            try { module.exports = require('./keytar-native.node')}
            catch {}
          `,
        };
      }
    );
  },
};

function makeDuckdbNoNodePreGypPlugin(target: Target | undefined): Plugin {
  const localPath = require.resolve("duckdb/lib/binding/duckdb.node");
  const posixPath = localPath.split(path.sep).join(path.posix.sep);
  const isDuckDBAvailable =
    target === undefined || targetDuckDBMap[target] !== undefined;
  return {
    name: "duckdbNoNodePreGypPlugin",
    setup(build) {
      build.onResolve({ filter: /duckdb-binding\.js/ }, (args) => {
        return {
          path: args.path,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        };
      });
      build.onLoad(
        {
          filter: /duckdb-binding\.js/,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        },
        (_args) => {
          return {
            contents: `
              var path = require("path");
              var os = require("os");

              var binding_path = ${
                target
                  ? `require.resolve("./duckdb-native.node")`
                  : `"${posixPath}"`
              };

              // dlopen is used because we need to specify the RTLD_GLOBAL flag to be able to resolve duckdb symbols
              // on linux where RTLD_LOCAL is the default.
              process.dlopen(module, binding_path, os.constants.dlopen.RTLD_NOW | os.constants.dlopen.RTLD_GLOBAL);
            `,
            resolveDir: ".",
          };
        }
      );
      build.onResolve({ filter: /duckdb_availability/ }, (args) => {
        return {
          path: args.path,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        };
      });
      build.onLoad(
        {
          filter: /duckdb_availability/,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        },
        (_args) => {
          return {
            contents: `
              export const isDuckDBAvailable = ${isDuckDBAvailable};
            `,
            resolveDir: ".",
          };
        }
      );
      if (!isDuckDBAvailable) {
        build.onResolve({ filter: /^duckdb$/ }, (args) => {
          return {
            path: args.path,
            namespace: "duckdb-no-node-pre-gyp-plugin",
          };
        });
        build.onLoad(
          { filter: /^duckdb$/, namespace: "duckdb-no-node-pre-gyp-plugin" },
          (_args) => {
            return {
              contents: `
              module.exports = {};
            `,
              resolveDir: ".",
            };
          }
        );
      }
    },
  };
}

const DEFINITIONS: Record<string, string> = {};

const ENV_PASSTHROUGH = ["GA_API_SECRET", "GA_MEASUREMENT_ID"];

for (const variable of ENV_PASSTHROUGH) {
  DEFINITIONS[`process.env.${variable}`] = JSON.stringify(
    process.env[variable] || ""
  );
}

// building without a target does a default build using whatever keytar native lib is in node_modules
export async function doBuild(
  development: boolean,
  target?: Target,
  metadata = false
): Promise<void> {
  development = development || process.env.NODE_ENV == "development";

  if (target && !targetKeytarMap[target])
    throw new Error(`Invalid target: ${target}`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const fullLicenseFilePath = path.join(
    __dirname,
    "..",
    outDir,
    "third_party_notices.txt"
  );

  if (fs.existsSync(fullLicenseFilePath)) {
    fs.rmSync(fullLicenseFilePath);
  }
  if (!development) {
    generateDisclaimer(
      path.join(__dirname, "..", "package.json"),
      path.join(__dirname, "..", "node_modules"),
      fullLicenseFilePath
    );
  } else {
    fs.writeFileSync(fullLicenseFilePath, "LICENSES GO HERE\n");
  }

  fs.writeFileSync(
    path.join(outDir, "build-sha"),
    execSync("git rev-parse HEAD")
  );

  if (target) {
    const file = await fetchKeytar(target);
    fs.copyFileSync(file, path.join(outDir, "keytar-native.node"));
    const duckDBBinaryName = targetDuckDBMap[target];
    const isDuckDBAvailable = duckDBBinaryName !== undefined;
    if (isDuckDBAvailable) {
      const file = await fetchDuckDB(target);
      fs.copyFileSync(file, path.join(outDir, "duckdb-native.node"));
    }
  }
  const duckDBPlugin = makeDuckdbNoNodePreGypPlugin(target);
  const extensionPlugins = [duckDBPlugin];

  if (development) {
    extensionPlugins.push(noNodeModulesSourceMaps);
    console.log("Entering watch mode");
  }

  const nodeExtensionPlugins = extensionPlugins;
  // if we're building with a target, replace keytar imports using plugin that imports
  // binary builds of keytar. if we're building for dev, use a .node plugin to
  // ensure ketyar's node_modules .node file is in the build
  if (target) {
    nodeExtensionPlugins.push(keytarReplacerPlugin);
  } else {
    nodeExtensionPlugins.push(nativeNodeModulesPlugin);
  }

  const baseOptions: BuildOptions = {
    bundle: true,
    minify: !development,
    sourcemap: development ? "inline" : false,
    outdir: outDir,
    loader: { [".svg"]: "file" },
    metafile: true,
    logLevel: "info",
  };

  // build the extension and server
  const nodeOptions: BuildOptions = {
    ...baseOptions,
    entryPoints: [
      "./src/extension/node/extension_node.ts",
      "./src/server/node/server_node.ts",
      "./src/worker/node/worker_node.ts",
    ],
    entryNames: "[name]",
    platform: "node",
    external: [
      "vscode",
      "pg-native",
      "./keytar-native.node",
      "./duckdb-native.node",
      "@duckdb/duckdb-wasm",
    ],
    loader: { [".png"]: "file", [".svg"]: "file" },
    plugins: nodeExtensionPlugins,
    define: DEFINITIONS,
  };

  const webviewPlugins = [
    svgrPlugin({
      typescript: true,
    }),
    duckDBPlugin,
  ];

  if (development) {
    webviewPlugins.push(noNodeModulesSourceMaps);
  }

  // build the webviews
  const webviewOptions: BuildOptions = {
    ...baseOptions,
    entryPoints: [
      "./src/extension/webviews/query_page/entry.ts",
      "./src/extension/webviews/connections_page/entry.ts",
    ],
    entryNames: "[dir]",
    platform: "browser",
    external: ["vscode"],
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
    },
    plugins: webviewPlugins,
  };

  // build the web extension
  const browserOptions: BuildOptions = {
    ...baseOptions,
    entryPoints: [
      "./src/extension/browser/extension_browser.ts",
      "./src/server/browser/server_browser.ts",
      "./src/worker/browser/worker_browser.ts",
    ],
    entryNames: "[name]",
    format: "cjs",
    platform: "browser",
    external: ["vscode"],
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
      ...DEFINITIONS,
    },
    tsconfig: "./tsconfig.browser.json",
    plugins: extensionPlugins,
    banner: {
      js: "globalThis.require = globalThis.require || null;\nglobalThis.module = globalThis.module || {};",
    },
  };

  if (development) {
    console.log("[watch] build started");
    const nodeContext = await context(nodeOptions);
    const webviewContext = await context(webviewOptions);
    const browserContext = await context(browserOptions);
    await nodeContext.watch();
    await webviewContext.watch();
    await browserContext.watch();
  } else {
    const nodeResult = await build(nodeOptions);
    const webviewResult = await build(webviewOptions);
    const browserResult = await build(browserOptions);

    if (metadata) {
      fs.writeFileSync("meta-node.json", JSON.stringify(nodeResult.metafile));
      fs.writeFileSync(
        "meta-webview.json",
        JSON.stringify(webviewResult.metafile)
      );
      fs.writeFileSync(
        "meta-browser.json",
        JSON.stringify(browserResult.metafile)
      );
    }
  }
}
