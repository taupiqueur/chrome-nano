// This module contains the background service worker to run commands via messages,
// using keyboard shortcuts or menu commands.
//
// Service workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
// Messaging: https://developer.chrome.com/docs/extensions/develop/concepts/messaging

import nano from './nano.js'
import optionsWorker from './options/service_worker.js'
import manualWorker from './manual/service_worker.js'

const { TAB_GROUP_ID_NONE } = chrome.tabGroups

/**
 * Adds items to the browser’s context menu.
 *
 * https://developer.chrome.com/docs/extensions/reference/api/contextMenus
 *
 * @returns {void}
 */
function createMenuItems() {
  chrome.contextMenus.create({
    id: 'open_nano',
    title: 'Open with nano',
    contexts: ['editable', 'selection']
  })

  chrome.contextMenus.create({
    id: 'open_documentation',
    title: 'Documentation',
    contexts: ['action']
  })

  chrome.contextMenus.create({
    id: 'open_support_chat',
    title: 'Support Chat',
    contexts: ['action']
  })

  chrome.contextMenus.create({
    id: 'open_sponsorship_page',
    title: 'Sponsor this project',
    contexts: ['action']
  })

  chrome.contextMenus.create({
    id: 'copy_debug_info',
    title: 'Copy debug info',
    contexts: ['action']
  })
}

/**
 * Handles the initial setup when the extension is first installed or updated to a new version.
 *
 * https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onInstalled
 *
 * @param {object} details
 * @returns {void}
 */
function onInstalled(details) {
  switch (details.reason) {
    case 'install':
      onInstall()
      break

    case 'update':
      onUpdate(details.previousVersion)
      break
  }
  createMenuItems()
}

/**
 * Handles the initial setup when the extension is first installed.
 *
 * @returns {Promise<void>}
 */
async function onInstall() {
  const defaults = await optionsWorker.getDefaults()
  await chrome.storage.sync.set(defaults)
  await chrome.tabs.create({
    active: true,
    url: 'src/manual/manual.html'
  })
}

/**
 * Handles the setup when the extension is updated to a new version.
 *
 * @param {string} previousVersion
 * @returns {Promise<void>}
 */
async function onUpdate(previousVersion) {
  const defaults = await optionsWorker.getDefaults()
  const localStorage = await chrome.storage.sync.get()
  await chrome.storage.sync.set({
    ...defaults,
    ...localStorage
  })
}

/**
 * Handles option changes.
 *
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 *
 * @param {object} changes
 * @param {string} areaName
 * @returns {void}
 */
function onOptionsChange(changes, areaName) {
  switch (areaName) {
    case 'local':
    case 'sync':
      Object.assign(nano, changes.nano.newValue)
      break
  }
}

/**
 * Handles messages by using a discriminator field. Each message has a `type` field,
 * and the rest of the fields, and their meaning, depend on its value.
 *
 * https://crystal-lang.org/api/master/JSON/Serializable.html#discriminator-field
 *
 * @param {object} wrappedMessage
 * @param {chrome.runtime.MessageSender} sender
 * @param {function} sendResponse
 * @returns {boolean}
 */
function onMessage(wrappedMessage, sender, sendResponse) {
  switch (wrappedMessage.type) {
    case 'shell': {
      const { type, ...message } = wrappedMessage
      chrome.runtime.sendNativeMessage('shell', message)
        .then(sendResponse)
      break
    }

    default:
      sendResponse({
        type: 'error',
        message: 'Unknown request'
      })
  }
  // A return value of “true” causes the messaging channel
  // to remain open for `sendResponse`.
  return true
}

/**
 * Handles the browser action on click.
 *
 * https://developer.chrome.com/docs/extensions/reference/api/action#event-onClicked
 *
 * @param {chrome.tabs.Tab} tab
 * @returns {void}
 */
function onAction(tab) {
  nano.open({
    tabId: tab.id,
    allFrames: true
  })
}

/**
 * Handles the context menu on click.
 *
 * https://developer.chrome.com/docs/extensions/reference/api/contextMenus#event-onClicked
 *
 * @param {chrome.contextMenus.OnClickData} info
 * @param {chrome.tabs.Tab} tab
 * @returns {Promise<void>}
 */
async function onMenuItemClicked(info, tab) {
  switch (info.menuItemId) {
    case 'open_nano':
      nano.open({
        tabId: tab.id,
        frameIds: [
          info.frameId
        ]
      })
      break

    case 'open_documentation':
      openNewTab({
        active: true,
        url: 'src/manual/manual.html',
        openerTabId: tab.id,
      })
      break

    case 'open_support_chat':
      openNewTab({
        active: true,
        url: 'https://web.libera.chat/gamja/#taupiqueur',
        openerTabId: tab.id,
      })
      break

    case 'open_sponsorship_page':
      openNewTab({
        active: true,
        url: 'https://github.com/sponsors/taupiqueur',
        openerTabId: tab.id,
      })
      break

    case 'copy_debug_info': {
      const debugInfo = await getDebugInfo()

      await chrome.scripting.executeScript({
        target: {
          tabId: tab.id
        },
        func: (text) => {
          return navigator.clipboard.writeText(text)
        },
        args: [
          JSON.stringify(debugInfo, null, 2)
        ]
      })
      break
    }
  }
}

/**
 * Opens a new tab to the right.
 *
 * @param {object} createProperties
 * @param {boolean} createProperties.active
 * @param {string} createProperties.url
 * @param {number} createProperties.openerTabId
 * @returns {Promise<void>}
 */
async function openNewTab({
  active,
  url,
  openerTabId,
}) {
  const openerTab = await chrome.tabs.get(openerTabId)
  const createdTab = await chrome.tabs.create({
    active,
    url,
    index: openerTab.index + 1,
    openerTabId,
    windowId: openerTab.windowId
  })

  if (openerTab.groupId !== TAB_GROUP_ID_NONE) {
    await chrome.tabs.group({
      groupId: openerTab.groupId,
      tabIds: [
        createdTab.id
      ]
    })
  }
}

/**
 * Returns debug info.
 *
 * https://github.com/lydell/LinkHints/blob/main/src/popup/Program.tsx
 *
 * @typedef {object} DebugInfo
 * @property {string} version
 * @property {string} userAgent
 * @property {chrome.runtime.PlatformInfo} platformInfo
 * @property {object} syncStorage
 * @property {object} localStorage
 * @property {object} sessionStorage
 * @property {string} language
 *
 * @returns {Promise<DebugInfo>}
 */
async function getDebugInfo() {
  const manifest = chrome.runtime.getManifest()

  const [
    platformInfo,
    syncStorage,
    localStorage,
    sessionStorage,
  ] = await Promise.all([
    chrome.runtime.getPlatformInfo(),
    chrome.storage.sync.get(),
    chrome.storage.local.get(),
    chrome.storage.session.get(),
  ])

  return {
    version: manifest.version,
    userAgent: navigator.userAgent,
    platformInfo,
    syncStorage,
    localStorage,
    sessionStorage,
    language: navigator.language,
  }
}

/**
 * Handles long-lived connections.
 * Uses the channel name to distinguish different types of connections.
 *
 * https://developer.chrome.com/docs/extensions/develop/concepts/messaging#connect
 *
 * @param {chrome.runtime.Port} port
 * @returns {void}
 */
function onConnect(port) {
  switch (port.name) {
    case 'options':
      optionsWorker.onConnect(port)
      break

    case 'manual':
      manualWorker.onConnect(port)
      break

    default:
      port.postMessage({
        type: 'error',
        message: `Unknown type of connection: ${port.name}`
      })
  }
}

// Configure nano.
chrome.storage.sync.get((options) => Object.assign(nano, options.nano))

// Set up listeners.
// https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events
chrome.runtime.onInstalled.addListener(onInstalled)
chrome.storage.onChanged.addListener(onOptionsChange)
chrome.action.onClicked.addListener(onAction)
chrome.contextMenus.onClicked.addListener(onMenuItemClicked)
chrome.runtime.onMessage.addListener(onMessage)
chrome.runtime.onConnect.addListener(onConnect)
