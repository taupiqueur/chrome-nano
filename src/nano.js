// This module provides the functionality to edit text areas in webpages
// with a text editor program—such as nano.

import '../@types/chrome_shell.js'

/**
 * Opens the current text area—`<input>`, `<textarea>`, `"contenteditable"` or
 * selected text—of the specified tab with the given text editor.
 *
 * - https://github.com/taupiqueur/chrome-shell/blob/master/docs/api.md
 * - https://developer.chrome.com/docs/extensions/reference/api/scripting#type-InjectionTarget
 *
 * @param {Command} editorCommand
 * @param {chrome.scripting.InjectionTarget} injectionTarget
 * @returns {void}
 */
export function nano(editorCommand, injectionTarget) {
  chrome.scripting.executeScript({
    target: injectionTarget,
    func: editTextArea,
    args: [editorCommand.command, editorCommand.args]
  })
}

/**
 * Opens the current text area—`<input>`, `<textarea>`, `"contenteditable"` or
 * selected text—with the given text editor.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function editTextArea(command, args) {
  /**
   * Opens specified input with the provided text editor.
   * Returns the command result with the file contents.
   *
   * @param {string} input
   * @returns {Promise<CommandResult>}
   */
  const editTextArea = input => chrome.runtime.sendMessage({
    type: 'shell',
    command: 'sh',
    args: ['-c', `tmpdir=$(mktemp -d) file=$tmpdir/chrome-nano.txt && trap 'rm -Rf "$tmpdir"' EXIT && cat > "$file" && "$@" "$file" && cat "$file"`, '--', command, ...args],
    input,
    output: true
  })

  /**
   * Dispatches a paste event with the given text.
   *
   * @param {HTMLElement} eventTarget
   * @param {string} text
   * @returns {void}
   */
  function dispatchPaste(eventTarget, text) {
    const dataTransfer = new DataTransfer
    dataTransfer.setData('text/plain', text)

    eventTarget.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
    )
  }

  /**
   * Returns the element within the DOM—including “open” shadow roots—that currently has focus.
   *
   * https://github.com/lydell/LinkHints/blob/main/src/worker/ElementManager.ts
   *
   * @param {Document | ShadowRoot} documentOrShadowRoot
   * @returns {HTMLElement}
   */
  function getActiveElement(documentOrShadowRoot) {
    const { activeElement } = documentOrShadowRoot
    const { shadowRoot } = activeElement

    return shadowRoot
      ? getActiveElement(shadowRoot)
      : activeElement
  }

  const activeElement = getActiveElement(document)
  const selection = window.getSelection()

  switch (true) {
    case activeElement instanceof HTMLInputElement:
    case activeElement instanceof HTMLTextAreaElement: {
      const selectedText = activeElement.value
      const commandResult = await editTextArea(selectedText)
      if (
        commandResult.status === 0 &&
        commandResult.output !== selectedText
      ) {
        activeElement.focus()
        activeElement.value = commandResult.output
        activeElement.dispatchEvent(new InputEvent('input'))
      }
      break
    }

    case activeElement.isContentEditable: {
      // Get text area contents and keep a reference to the original ranges
      // in order to restore them later.
      const selection = window.getSelection()
      const savedRanges = Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index)
      )
      selection.selectAllChildren(activeElement)
      const selectedText = selection.toString()
      selection.removeAllRanges()
      for (const range of savedRanges) {
        selection.addRange(range)
      }

      const commandResult = await editTextArea(selectedText)
      if (
        commandResult.status === 0 &&
        commandResult.output !== selectedText
      ) {
        activeElement.focus()
        selection.selectAllChildren(activeElement)
        setTimeout(() => {
          // Inserting text in content editable elements
          // usually works by dispatching a clipboard event.
          dispatchPaste(activeElement, commandResult.output)
        }, 200)

        // Also write the command output to the system clipboard,
        // and let user paste it.
        await navigator.clipboard.writeText(commandResult.output)
      }
      break
    }

    case selection.type === 'Range': {
      const selectedText = selection.toString()
      await editTextArea(selectedText)
      break
    }
  }
}

export default {
  command: 'xterm',
  args: ['-e', 'nano', '--'],
  open(injectionTarget) {
    return nano(this, injectionTarget)
  }
}
