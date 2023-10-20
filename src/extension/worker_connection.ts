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

import * as vscode from 'vscode';
import {
  GenericConnection,
  ListenerType,
  MessageMap,
  WorkerLogMessage,
  WorkerMessageMap,
  WorkerFetchBinaryMessage,
  WorkerFetchCellDataMessage,
  WorkerFetchMessage,
  ExtensionMessageHandler,
} from '../common/worker_message_types';
import {FileHandler} from '../common/types';
import {Disposable, NotificationHandler, ProgressType} from 'vscode-jsonrpc';

const logPrefix = (level: string) => {
  const stamp = new Date().toLocaleTimeString();
  return `[${level} - ${stamp}]`;
};

const workerLog = vscode.window.createOutputChannel('Malloy Worker');
export abstract class WorkerConnection implements ExtensionMessageHandler {
  constructor(
    private context: vscode.ExtensionContext,
    private fileHandler: FileHandler
  ) {}

  abstract get connection(): GenericConnection;

  subscribe() {
    this.context.subscriptions.push(
      this.onRequest('malloy/log', (message: WorkerLogMessage) => {
        workerLog.appendLine(message.message);
      })
    );

    this.context.subscriptions.push(
      this.onRequest('malloy/fetch', async (message: WorkerFetchMessage) => {
        workerLog.appendLine(
          `${logPrefix('Debug')} reading file ${message.uri}`
        );
        return await this.fileHandler.fetchFile(message.uri);
      })
    );

    this.context.subscriptions.push(
      this.onRequest(
        'malloy/fetchBinary',
        async (message: WorkerFetchBinaryMessage) => {
          workerLog.appendLine(
            `${logPrefix('Debug')} reading binary file ${message.uri}`
          );
          return await this.fileHandler.fetchBinaryFile(message.uri);
        }
      )
    );

    this.context.subscriptions.push(
      this.onRequest(
        'malloy/fetchCellData',
        async (message: WorkerFetchCellDataMessage) => {
          workerLog.appendLine(
            `${logPrefix('Debug')} reading cell data for ${message.uri}`
          );
          return await this.fileHandler.fetchCellData(message.uri);
        }
      )
    );

    this.context.subscriptions.push(this);
  }

  sendRequest<R, K extends keyof MessageMap>(
    type: K,
    message: MessageMap[K],
    cancellationToken?: vscode.CancellationToken | undefined
  ): Promise<R> {
    return this.connection.sendRequest(type, message, cancellationToken);
  }

  onRequest<K extends keyof WorkerMessageMap>(
    event: K,
    listener: ListenerType<WorkerMessageMap[K]>
  ): vscode.Disposable {
    return this.connection.onRequest(event, listener);
  }

  sendProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    value: P
  ): Promise<void> {
    return this.connection.sendProgress(type, token, value);
  }

  onProgress<P>(
    type: ProgressType<P>,
    token: string | number,
    handler: NotificationHandler<P>
  ): Disposable {
    return this.connection.onProgress(type, token, handler);
  }

  abstract dispose(): void;
}
