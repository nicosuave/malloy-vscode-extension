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

import {connectionManager} from '../connection_manager';
import {
  ConnectionConfig,
  getDefaultIndex,
} from '../../../common/connection_manager_types';
import {deletePassword, setPassword} from 'keytar';
import {EditConnectionPanel} from '../../connection_editor';
import {ConnectionItem} from '../../tree_views/connections_view';

let panel: EditConnectionPanel | null = null;

export function editConnectionsCommand(item?: ConnectionItem): void {
  if (!panel) {
    panel = new EditConnectionPanel(
      connectionManager,
      handleConnectionsPreSave
    );
    panel.onDidDispose(() => (panel = null));
  }
  panel.reveal(item?.id);
}

/**
 * Perform cleanup on the connections object received from the webview,
 * and prepare to save the config.
 *
 * @param connections The connection configs received from the webview.
 * @returns An updated list of connections
 *
 * - Fixes up `isDefault` issues.
 * - Handles scrubbing passwords and putting them in the keychain.
 */
async function handleConnectionsPreSave(
  connections: ConnectionConfig[]
): Promise<ConnectionConfig[]> {
  const defaultIndex = getDefaultIndex(connections);
  const modifiedConnections = [];
  for (let index = 0; index < connections.length; index++) {
    const connection = connections[index];
    connection.isDefault = index === defaultIndex;
    if ('password' in connection) {
      if (connection.useKeychainPassword === false) {
        connection.useKeychainPassword = undefined;
        await deletePassword(
          'com.malloy-lang.vscode-extension',
          `connections.${connection.id}.password`
        );
      }
      if (connection.password) {
        modifiedConnections.push({
          ...connection,
          password: undefined,
          useKeychainPassword: true,
        });
        await setPassword(
          'com.malloy-lang.vscode-extension',
          `connections.${connection.id}.password`,
          connection.password
        );
      }
    } else if (!connection.isGenerated) {
      modifiedConnections.push(connection);
    }
  }
  return modifiedConnections;
}
