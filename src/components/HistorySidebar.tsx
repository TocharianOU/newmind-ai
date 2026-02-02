import React, { useState, useCallback, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { closeAllSidebarsAtom, sidebarVisibleAtom } from "../atoms/sidebarState"
import { ChatHistoryItem, historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import Header from "./Header"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import Tooltip from "./Tooltip"
import { openDrawerAtom, type DrawerType } from "../atoms/drawerState"
import { closeAllDrawersAtom } from "../atoms/drawerState"
import { useSidebarLayer } from "../hooks/useLayer"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import { currentChatIdAtom, isChatStreamingAtom } from "../atoms/chatState"
import PopupConfirm from "./PopupConfirm"
import Dropdown from "./DropDown"
import { isLoggedInOAPAtom, OAPLevelAtom, oapUserAtom } from "../atoms/oapState"
import Button from "./Button"
import { settingTabAtom } from "../atoms/globalState"
import { ClickOutside } from "./ClickOutside"
import { oapGetToken } from "../ipc/oap"
import { ENV_CONFIG } from "../config/env"

interface Props {
  onNewConversation?: () => void
}

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
  onFinish: () => void
}

interface RenameConfirmProps {
  chat: ChatHistoryItem | null
  onConfirm: (newName: string) => void
  onCancel: () => void
  onFinish: () => void
}

const DeleteConfirmModal: React.FC<DeleteConfirmProps> = ({ onConfirm, onCancel, onFinish }) => {
  const { t } = useTranslation()
  const setCurrentChatId = useSetAtom(currentChatIdAtom)

  const _onConfirm = useCallback(() => {
    onConfirm()
    setCurrentChatId("")
  }, [onConfirm, setCurrentChatId])

  return (
    <PopupConfirm
      title={t("chat.confirmDelete")}
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={_onConfirm}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
      className="delete-confirm-modal"
      onFinish={onFinish}
    >
      {t("chat.confirmDeleteDescription")}
    </PopupConfirm>
  )
}

const RenameConfirmModal: React.FC<RenameConfirmProps> = ({ chat, onConfirm, onCancel, onFinish }) => {
  const { t } = useTranslation()
  const [newName, setNewName] = useState(chat?.title ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 0)
  }, [])

  return (
    <PopupConfirm
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={() => onConfirm(newName)}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
      className="rename-confirm-modal"
      disabled={newName === chat?.title}
      onFinish={onFinish}
    >
      <div className="rename-confirm-modal-content">
        {t("sidebar.chat.renameChat")}
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
      </div>
    </PopupConfirm>
  )
}

const HistorySidebar = ({ onNewConversation }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const histories = useAtomValue(historiesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const showToast = useSetAtom(showToastAtom)
  const _openDrawer = useSetAtom(openDrawerAtom)
  const closeAllDrawers = useSetAtom(closeAllDrawersAtom)
  const [isVisible, setVisible] = useSidebarLayer(sidebarVisibleAtom)
  const [currentChatId, setCurrentChatId] = useAtom(currentChatIdAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const oapUser = useAtomValue(oapUserAtom)
  const oapLevel = useAtomValue(OAPLevelAtom)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const [renamingChat, setRenamingChat] = useState<ChatHistoryItem | null>(null)
  const closeAllSidebars = useSetAtom(closeAllSidebarsAtom)
  const settingTab = useAtomValue(settingTabAtom)
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false) // 🔥 关键添加

  const openDrawer = useCallback((drawer: DrawerType) => {
    _openDrawer(drawer)
  }, [_openDrawer])

  useEffect(() => {
    if (isVisible) {
      loadHistories()
      containerRef.current?.focus()
    }
  }, [isVisible, loadHistories])

  useHotkeyEvent("chat:delete", () => {
    currentChatId && setDeletingChatId(currentChatId)
  })

  const confirmDelete = (chat: ChatHistoryItem) => {
    setDeletingChatId(chat.id)
    // maintain sidebar open - 🔥 关键机制
    setTimeout(() => {
      setIsSubMenuOpen(true)
    }, 0)
  }

  const handleDelete = async () => {
    if (!deletingChatId)
      return

    if (isChatStreaming) {
      return
    }

    try {
      const response = await fetch(`/api/chat/${deletingChatId}`, {
        method: "DELETE"
      })
      const data = await response.json()

      if (data.success) {
        showToast({
          message: t("chat.deleteSuccess"),
          type: "success"
        })

        if (location.pathname.includes(`/chat/${deletingChatId}`)) {
          navigate("/")
        }

        loadHistories()
      } else {
        showToast({
          message: t("chat.deleteFailed"),
          type: "error"
        })
      }
    } catch (_error) {
      showToast({
        message: t("chat.deleteFailed"),
        type: "error"
      })
    } finally {
      setDeletingChatId(null)
    }
  }

  const handleStarChat = async (chat: ChatHistoryItem, type: "starred" | "normal") => {
    const response = await fetch(`/api/chat/${chat.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        star: type === "starred" ? false : true
      })
    })
    const data = await response.json()
    if (type === "normal" && !data?.success) {
      showToast({
        message: t("sidebar.chat.starFailed"),
        type: "error"
      })
    }
    loadHistories()
  }

  const confirmRename = (chat: ChatHistoryItem) => {
    setRenamingChat(chat)
    // maintain sidebar open - 🔥 关键机制
    setTimeout(() => {
      setIsSubMenuOpen(true)
    }, 0)
  }

  const handleRename = async (newName: string) => {
    if (!renamingChat)
      return

    const response = await fetch(`/api/chat/${renamingChat.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: newName
      })
    })
    const data = await response.json()
    if (!data?.success) {
      showToast({
        message: t("sidebar.chat.renameFailed"),
        type: "error"
      })
    }
    loadHistories()

    setRenamingChat(null)
  }

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
    closeAllDrawers()
    navigate(`/chat/${chatId}`)
    if (window.innerWidth < 960) {
      setVisible(false)
    }
  }, [navigate, closeAllDrawers])

  const handleNewConversation = () => {
    setCurrentChatId("")
    closeAllDrawers()
    if (onNewConversation) {
      onNewConversation()
    } else {
      navigate("/")
    }
    if (window.innerWidth < 960) {
      setVisible(false)
    }
  }

  const handleTools = () => {
    setCurrentChatId("")
    openDrawer({ id: "Settings", page: "Settings", tab: settingTab })
    if (window.innerWidth < 960) {
      setVisible(false)
    }
  }

  // 打开 OAP Dashboard（带token自动登录）
  const handleOpenHub = async () => {
    try {
      const token = await oapGetToken()
      const url = `${ENV_CONFIG.HUB_BASE_URL}/dashboard${token ? `?token=${token}` : ''}`
      console.log('🔗 Opening OAP Dashboard:', url)
      
      if (window.ipcRenderer && window.ipcRenderer.invoke) {
        // 使用IPC在外部浏览器中打开
        window.ipcRenderer.invoke('open-external-url', url)
      } else {
        // 降级方案：使用window.open
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('🔗 Error opening OAP:', error)
      // 即使获取token失败，也尝试打开（不带token）
      const fallbackUrl = `${ENV_CONFIG.HUB_BASE_URL}/dashboard`
      if (window.ipcRenderer && window.ipcRenderer.invoke) {
        window.ipcRenderer.invoke('open-external-url', fallbackUrl)
      } else {
        window.open(fallbackUrl, '_blank')
      }
    }
  }

  const onBlur = () => {
    // 🔥 关键检查 - 防止在子菜单打开时意外关闭
    if (window.innerWidth < 960 &&
        containerRef.current &&
        !isSubMenuOpen) {
      closeAllSidebars()
      setVisible(false)
    }
  }

  return (
    <>
      <ClickOutside onClickOutside={onBlur}>
        <div
          className={`history-sidebar ${isVisible ? "visible" : ""}`}
          ref={containerRef}
          tabIndex={0}
        >
          <Header />
          <div className="history-header">
            <Tooltip
              content={`${t("chat.newChatTooltip")} Ctrl + Shift + O`}
            >
              <Button
                className="new-chat-btn"
                color="blue"
                size="full"
                padding="n"
                onClick={handleNewConversation}
              >
                + {t("chat.newChat")}
              </Button>
            </Tooltip>
          </div>
          <div className="history-list">

            {
              histories.starred.length > 0 && (
                <div className="history-list-starred">
                  <div className="history-star">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <mask id="path-1-inside-1_2277_3661" fill="white">
                        <path d="M12.9081 5.08098C13.1034 5.27624 13.1034 5.59283 12.9081 5.78809L12.201 6.4952C12.0058 6.69046 11.6892 6.69046 11.4939 6.4952L11.1272 6.12852L8.34853 8.90723C8.66427 10.0988 8.48374 11.3943 7.80577 12.4662C7.51057 12.9329 6.86566 12.9291 6.47512 12.5387L1.52537 7.589C1.13484 7.19848 1.13045 6.55291 1.59718 6.25765C2.67395 5.57658 3.97673 5.39734 5.17277 5.71904L7.94526 2.94654L7.60483 2.60611C7.40958 2.41085 7.40957 2.09426 7.60483 1.899L8.31194 1.19189C8.50719 0.996637 8.82378 0.996645 9.01904 1.19189L12.9081 5.08098Z"/>
                      </mask>
                      <path d="M12.9081 5.08098C13.1034 5.27624 13.1034 5.59283 12.9081 5.78809L12.201 6.4952C12.0058 6.69046 11.6892 6.69046 11.4939 6.4952L11.1272 6.12852L8.34853 8.90723C8.66427 10.0988 8.48374 11.3943 7.80577 12.4662C7.51057 12.9329 6.86566 12.9291 6.47512 12.5387L1.52537 7.589C1.13484 7.19848 1.13045 6.55291 1.59718 6.25765C2.67395 5.57658 3.97673 5.39734 5.17277 5.71904L7.94526 2.94654L7.60483 2.60611C7.40958 2.41085 7.40957 2.09426 7.60483 1.899L8.31194 1.19189C8.50719 0.996637 8.82378 0.996645 9.01904 1.19189L12.9081 5.08098Z" fill="currentColor"/>
                      <path d="M0.969304 12.0316C0.67641 12.3245 0.67641 12.7993 0.969304 13.0922C1.2622 13.3851 1.73707 13.3851 2.02996 13.0922L1.49963 12.5619L0.969304 12.0316ZM4.21973 9.8418L3.6894 9.31147L0.969304 12.0316L1.49963 12.5619L2.02996 13.0922L4.75006 10.3721L4.21973 9.8418Z" fill="currentColor"/>
                    </svg>
                    {t("sidebar.chat.starredChat")}
                  </div>
                  {histories.starred.map((chat: ChatHistoryItem) => (
                    <ChatHistoryListItem
                      key={chat.id}
                      chat={chat}
                      type="starred"
                      currentChatId={currentChatId}
                      loadChat={loadChat}
                      isChatStreaming={isChatStreaming}
                      onStarChat={() => handleStarChat(chat, "starred")}
                      onConfirmRename={confirmRename}
                      onConfirmDelete={confirmDelete}
                    />
                  ))}
                </div>
              )
            }

            {
              histories.normal.length > 0 && (
                <div className="history-list-normal">
                  <div className="history-normal">
                    {t("chat.history")}
                  </div>
                  {histories.normal.map((chat: ChatHistoryItem) => (
                    <ChatHistoryListItem
                      key={chat.id}
                      chat={chat}
                      type="normal"
                      currentChatId={currentChatId}
                      loadChat={loadChat}
                      isChatStreaming={isChatStreaming}
                      onStarChat={() => handleStarChat(chat, "normal")}
                      onConfirmRename={confirmRename}
                      onConfirmDelete={confirmDelete}
                    />
                  ))}
                </div>
              )
            }
          </div>
          <div className="history-footer">
            {isLoggedInOAP && oapUser ? (
              <div className="history-footer-user">
                <Tooltip content={t("chat.modelSettings")}>
                  <div className="user-info" onClick={() => openDrawer({ id: "Settings", page: "Settings", tab: "Model" })}>
                    <div className="user-avatar">
                      {oapUser.email?.charAt(0).toUpperCase() || oapUser.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="user-details">
                      <div className="user-name">{oapUser.username || oapUser.email}</div>
                      <div className="user-plan">{oapLevel || 'BASE'}</div>
                    </div>
                  </div>
                </Tooltip>
                <Tooltip content="Open OAP Dashboard">
                  <button className="hub-jump-btn" onClick={handleOpenHub}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 17 16" fill="none">
                      <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                    </svg>
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div className="history-footer-btn">
                <div className="sidemenu-btn" onClick={handleTools}>
                  <div className="oap-user-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 22 22" fill="none">
                      <path d="M11 15C13.2091 15 15 13.2091 15 11C15 8.79086 13.2091 7 11 7C8.79086 7 7 8.79086 7 11C7 13.2091 8.79086 15 11 15Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                      <path d="M13.5404 2.49103L12.4441 3.94267C11.3699 3.71161 10.2572 3.72873 9.19062 3.99275L8.04466 2.58391C6.85499 2.99056 5.76529 3.64532 4.84772 4.50483L5.55365 6.17806C4.82035 6.99581 4.28318 7.97002 3.98299 9.02659L2.19116 9.31422C1.94616 10.5476 1.96542 11.8188 2.24768 13.0442L4.05324 13.2691C4.38773 14.3157 4.96116 15.27 5.72815 16.0567L5.07906 17.7564C6.02859 18.5807 7.14198 19.1945 8.34591 19.5574L9.44108 18.1104C10.5154 18.3413 11.6283 18.3245 12.6951 18.0613L13.8405 19.4692C15.0302 19.0626 16.12 18.4079 17.0375 17.5483L16.3321 15.876C17.0654 15.0576 17.6027 14.0829 17.9031 13.0259L19.6949 12.7382C19.9396 11.5049 19.9203 10.2337 19.6384 9.00827L17.8291 8.77918C17.4946 7.73265 16.9211 6.77831 16.1541 5.99166L16.8023 4.29248C15.8544 3.46841 14.7427 2.85442 13.5404 2.49103Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                    </svg>
                    {t("sidebar.manageAndSettings")}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="16" height="16">
                    <path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9H7l4 4.5L15 9Z"></path>
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </ClickOutside>
      {deletingChatId && (
        <DeleteConfirmModal
          onConfirm={handleDelete}
          onCancel={() => {
            setDeletingChatId(null)
          }}
          onFinish={() => {
            setIsSubMenuOpen(false) // 🔥 重置状态
          }}
        />
      )}
      {renamingChat && (
        <RenameConfirmModal
          chat={renamingChat}
          onConfirm={handleRename}
          onCancel={() => {
            setRenamingChat(null)
          }}
          onFinish={() => {
            setIsSubMenuOpen(false) // 🔥 重置状态
          }}
        />
      )}
    </>
  )
}

interface ChatHistoryItemProps {
  chat: ChatHistoryItem
  type: "starred" | "normal"
  currentChatId: string
  loadChat: (id: string) => void
  isChatStreaming: boolean
  onStarChat: (chat: ChatHistoryItem) => void
  onConfirmRename: (chat: ChatHistoryItem) => void
  onConfirmDelete: (chat: ChatHistoryItem) => void
}

const ChatHistoryListItem = ({ chat, type, currentChatId, loadChat, isChatStreaming, onStarChat, onConfirmRename, onConfirmDelete }: ChatHistoryItemProps) => {
  const { t } = useTranslation()

  return (
    <div
      key={chat.id}
      className={`history-item ${chat.id === currentChatId ? "active" : ""}`}
      onClick={() => loadChat(chat.id)}
    >
      <div className="history-content">
        <div className="history-title">{chat.title || t("chat.untitledChat")}</div>
        <div className="history-date">
          {new Date(chat.createdAt).toLocaleString()}
        </div>
      </div>
      {!isChatStreaming && (
        <div onClick={e => e.stopPropagation()}>
          <Dropdown
            placement="right"
            options={[
              {
                label: (
                  <div className="sidebar-chat-menu-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <g clipPath="url(#clip0_2089_64)">
                        <mask id="path-1-inside-1_2089_64" fill="white">
                          <path d="M21.2782 7.77818C21.6686 8.16871 21.6687 8.8019 21.2782 9.19239L18.4497 12.0208C18.0593 12.4113 17.4261 12.4112 17.0355 12.0208L16.4141 11.3993L13.4234 14.39C13.9195 16.4017 13.6245 18.5683 12.5388 20.3956C11.9746 21.3452 10.6806 21.3369 9.89956 20.5558L1.41428 12.0705C0.633267 11.2895 0.624898 9.99552 1.57448 9.43131C3.49137 8.2924 5.78188 8.02298 7.87491 8.62477L10.7572 5.74248L9.96447 4.94975C9.57394 4.55922 9.57394 3.92606 9.96447 3.53554L12.7929 0.707109C13.1834 0.316584 13.8166 0.316584 14.2071 0.707109L21.2782 7.77818Z"/>
                        </mask>
                        <path d="M21.2782 7.77818L22.6926 6.36419L22.6924 6.36396L21.2782 7.77818ZM21.2782 9.19239L22.6924 10.6066L22.6924 10.6066L21.2782 9.19239ZM18.4497 12.0208L19.864 13.435L18.4497 12.0208ZM17.0355 12.0208L15.6213 13.435L15.6216 13.4353L17.0355 12.0208ZM16.4141 11.3993L17.8283 9.98512L16.4141 8.57091L14.9998 9.98512L16.4141 11.3993ZM13.4234 14.39L12.0091 12.9758L11.2114 13.7736L11.4815 14.869L13.4234 14.39ZM12.5388 20.3956L14.2582 21.4172L14.2582 21.4172L12.5388 20.3956ZM1.41428 12.0705L2.42865e-05 13.4847L6.30616e-05 13.4847L1.41428 12.0705ZM1.57448 9.43131L0.552894 7.71191L0.552882 7.71191L1.57448 9.43131ZM7.87491 8.62477L7.32226 10.5469L8.45541 10.8727L9.28913 10.039L7.87491 8.62477ZM10.7572 5.74248L12.1714 7.1567L13.5856 5.74248L12.1714 4.32827L10.7572 5.74248ZM9.96447 3.53554L8.55025 2.12132L9.96447 3.53554ZM12.7929 0.707109L11.3787 -0.707105L11.3787 -0.707105L12.7929 0.707109ZM21.2782 7.77818L19.8637 9.19216C19.4736 8.80193 19.4732 8.16897 19.864 7.77818L21.2782 9.19239L22.6924 10.6066C23.8642 9.43484 23.8635 7.53549 22.6926 6.36419L21.2782 7.77818ZM21.2782 9.19239L19.864 7.77818L17.0355 10.6066L18.4497 12.0208L19.864 13.435L22.6924 10.6066L21.2782 9.19239ZM18.4497 12.0208L17.0355 10.6066C17.4263 10.2158 18.0593 10.2163 18.4495 10.6064L17.0355 12.0208L15.6216 13.4353C16.7929 14.6062 18.6922 14.6068 19.864 13.435L18.4497 12.0208ZM17.0355 12.0208L18.4497 10.6066L17.8283 9.98512L16.4141 11.3993L14.9998 12.8136L15.6213 13.435L17.0355 12.0208ZM16.4141 11.3993L14.9998 9.98512L12.0091 12.9758L13.4234 14.39L14.8376 15.8043L17.8283 12.8136L16.4141 11.3993ZM13.4234 14.39L11.4815 14.869C11.8545 16.3813 11.6312 18.0076 10.8194 19.374L12.5388 20.3956L14.2582 21.4172C15.6177 19.129 15.9845 16.4221 15.3652 13.9111L13.4234 14.39ZM12.5388 20.3956L10.8194 19.374C10.8555 19.3133 10.9212 19.2426 11.0126 19.1908C11.0987 19.142 11.1752 19.1281 11.2233 19.1262C11.3069 19.123 11.3235 19.1513 11.3138 19.1416L9.89956 20.5558L8.48534 21.97C9.91605 23.4007 12.8432 23.7988 14.2582 21.4172L12.5388 20.3956ZM9.89956 20.5558L11.3138 19.1416L2.82849 10.6563L1.41428 12.0705L6.30616e-05 13.4847L8.48534 21.97L9.89956 20.5558ZM1.41428 12.0705L2.82853 10.6564C2.81882 10.6466 2.84714 10.6632 2.84392 10.7468C2.84206 10.7949 2.82807 10.8714 2.7793 10.9575C2.72754 11.0489 2.6568 11.1146 2.59608 11.1507L1.57448 9.43131L0.552882 7.71191C-1.8287 9.12695 -1.43055 12.0541 2.42865e-05 13.4847L1.41428 12.0705ZM1.57448 9.43131L2.59607 11.1507C4.02999 10.2988 5.74973 10.0948 7.32226 10.5469L7.87491 8.62477L8.42756 6.70264C5.81403 5.9512 2.95275 6.28603 0.552894 7.71191L1.57448 9.43131ZM7.87491 8.62477L9.28913 10.039L12.1714 7.1567L10.7572 5.74248L9.34299 4.32827L6.4607 7.21056L7.87491 8.62477ZM10.7572 5.74248L12.1714 4.32827L11.3787 3.53554L9.96447 4.94975L8.55025 6.36396L9.34299 7.1567L10.7572 5.74248ZM9.96447 4.94975L11.3787 3.53554C11.7692 3.92606 11.7692 4.55922 11.3787 4.94975L9.96447 3.53554L8.55025 2.12132C7.37868 3.2929 7.37868 5.19239 8.55025 6.36396L9.96447 4.94975ZM9.96447 3.53554L11.3787 4.94975L14.2071 2.12132L12.7929 0.707109L11.3787 -0.707105L8.55025 2.12132L9.96447 3.53554ZM12.7929 0.707109L14.2071 2.12132C13.8166 2.51185 13.1834 2.51185 12.7929 2.12132L14.2071 0.707109L15.6213 -0.707105C14.4497 -1.87868 12.5503 -1.87868 11.3787 -0.707105L12.7929 0.707109ZM14.2071 0.707109L12.7929 2.12132L19.864 9.19239L21.2782 7.77818L22.6924 6.36396L15.6213 -0.707105L14.2071 0.707109Z" fill="currentColor" mask="url(#path-1-inside-1_2089_64)"/>
                        <path d="M1.21387 19.3719C0.823341 19.7624 0.823341 20.3956 1.21387 20.7861C1.60439 21.1767 2.23755 21.1767 2.62808 20.7861L1.92097 20.079L1.21387 19.3719ZM6 16L5.29289 15.2929L1.21387 19.3719L1.92097 20.079L2.62808 20.7861L6.70711 16.7071L6 16Z" fill="currentColor"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_2089_64">
                          <rect width="22" height="22" fill="currentColor"/>
                        </clipPath>
                      </defs>
                    </svg>
                    {type === "starred" ? t("sidebar.chat.unStarChat") : t("sidebar.chat.starChat")}
                  </div>
                ),
                onClick: (_e) => onStarChat(chat),
              },
              {
                label: (
                  <div className="sidebar-chat-menu-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M3 13.6689V19.0003H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t("sidebar.chat.renameChat")}
                  </div>
                ),
                onClick: (_e) => onConfirmRename(chat),
              },
              {
                label: (
                  <div className="sidebar-chat-menu-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                    {t("sidebar.chat.deleteChat")}
                  </div>
                ),
                onClick: (_e) => onConfirmDelete(chat),
              }
            ]}
          >
            <div className="sidebar-chat-menu">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="18" height="18">
                <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
              </svg>
            </div>
          </Dropdown>
        </div>
      )}
    </div>
  )
}

export default React.memo(HistorySidebar)