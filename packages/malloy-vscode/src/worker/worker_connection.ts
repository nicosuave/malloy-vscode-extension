/* eslint-disable no-console */
import * as child_process from "child_process";
import * as vscode from "vscode";
import { Message, WorkerMessage } from "./types";

export class WorkerConnection {
  worker!: child_process.ChildProcess;

  constructor(context: vscode.ExtensionContext) {
    const workerModule = context.asAbsolutePath("dist/worker.js");

    const startWorker = () => {
      this.worker = child_process
        .fork(workerModule, { execArgv: ["--no-lazy", "--inspect=6010"] })
        .on("error", console.error)
        .on("exit", (status) => {
          if (status !== 0) {
            // TODO: communicate with panels running queries
            console.error(`Worker exited with ${status}`);
            console.info(`Restarting in 5 seconds`);
            // Maybe exponential backoff? Not sure what our failure
            // modes are going to be
            setTimeout(startWorker, 5000);
          }
        });
    };
    startWorker();
  }

  send(message: Message): void {
    this.worker.send?.(message);
  }

  on(event: string, listener: (message: WorkerMessage) => void): void {
    this.worker.on(event, listener);
  }

  stop(): void {
    this.worker.kill("SIGHUP");
  }
}
