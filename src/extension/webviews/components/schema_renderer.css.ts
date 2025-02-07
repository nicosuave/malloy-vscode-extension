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

import {css} from 'lit';

export const styles = css`
  :host {
    color: var(--vscode-foreground);
    display: block;
  }

  ul {
    margin: 5px 0;
    padding: 0 0.75em;
    list-style-type: none;
  }

  li.schema {
    list-style: none;
  }

  .hidden ul {
    display: none;
  }

  li.fields {
    margin: 2px 0;
  }

  li.fields label {
    display: block;
    font-size: 10px;
    margin-left: 5px;
    margin-top: 0.5em;
    text-transform: uppercase;
  }

  .explore_name {
    line-height: 2em;
    font-weight: 600;
  }

  .field {
    white-space: nowrap;
    display: flex;
    vertical-align: middle;
    border: 1px solid var(--vscode-notebook-cellBorderColor);
    border-radius: 8px;
    padding: 0.25em 0.75em;
    margin: 0.2em;

    &.clickable {
      cursor: pointer;
    }
  }

  .field_list {
    display: flex;
    flex-wrap: wrap;
    margin-top: 0.25em;
  }

  .field_name {
    padding-left: 0.5em;
  }

  svg {
    position: relative;
    left: -2px;
  }

  .field_name,
  svg,
  span,
  b {
    vertical-align: middle;
    display: inline-block;
  }

  .preview {
    color: var(--vscode-editorCodeLens-foreground);
    font-size: 0.8em;
    padding-left: 5px;
    cursor: pointer;

    &:hover {
      color: var(--vscode-editorLink-activeForeground);
    }
  }

  .chevron {
    color: var(--vscode-icon-foreground);
  }
`;
