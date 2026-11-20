import { useState } from 'react'
import { ChatWindow } from '../components/ChatWindow.jsx'
import { DocumentSidebar } from '../components/DocumentSidebar.jsx'
import { PDFViewer } from '../components/PDFViewer.jsx'
import { UploadPanel } from '../components/UploadPanel.jsx'
import { Logo } from '../components/Logo.jsx'

export function AppPage({
  user,
  documents = [],
  activeDocument,
  messages = [],
  previewUrl,
  loadingDocuments = false,
  loadingChat = false,
  uploading = false,
  error = null,
  onSelectDocument,
  onUpload,
  onSendMessage,
  onSignOut,
  onDeleteDocument,
  onNewDocument,
  onNavigateHome,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const [targetPage, setTargetPage] = useState(1)

  // Mobile active tab: 'docs', 'chat', 'pdf'
  const [mobileTab, setMobileTab] = useState('chat')

  // Handle citation badge click from ChatWindow
  const handleNavigateCitation = (pageNumber) => {
    // 1. Ensure PDF viewer is open
    setIsPreviewOpen(true)
    // 2. Set target page
    setTargetPage(pageNumber)
    // 3. Switch to PDF tab on mobile
    if (window.innerWidth <= 1024) {
      setMobileTab('pdf')
    }
  }

  // User avatar initials
  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? 'U')

  return (
    <main className="app-shell">
      {/* 1. Global Workspace Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <Logo size={28} showWordmark={true} onClick={onNavigateHome} />
          <button
            type="button"
            className={`panel-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? 'Collapse Document Sidebar' : 'Open Document Sidebar'}
            aria-label="Toggle Sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        <div className="topbar-center">
          {activeDocument ? (
            <div className="active-doc-badge">
              <span className="doc-icon">📄</span>
              <strong className="active-doc-title">{activeDocument.title}</strong>
              {activeDocument.page_count ? (
                <span className="doc-pages">{activeDocument.page_count} pages</span>
              ) : null}
            </div>
          ) : (
            <span className="topbar-muted-title">Document Intelligence Workspace</span>
          )}
        </div>

        <div className="topbar-right">
          {activeDocument && (
            <button
              type="button"
              className={`panel-toggle-btn ${isPreviewOpen ? 'active' : ''}`}
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              title={isPreviewOpen ? 'Collapse PDF Viewer' : 'Open PDF Viewer'}
              aria-label="Toggle PDF Viewer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              <span className="toggle-btn-label">PDF</span>
            </button>
          )}

          <div className="user-topbar-profile">
            <div className="user-avatar-circle" title={user?.email}>
              {userInitials}
            </div>
            <div className="user-details-mini">
              <strong>{user?.name ?? 'User'}</strong>
              <small>{user?.email}</small>
            </div>
            <button
              type="button"
              className="btn-logout-animated"
              onClick={onSignOut}
              title="Sign out of PDFBuddy"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="mobile-workspace-tabs" role="tablist" aria-label="Workspace navigation">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'docs'}
          className={`mob-tab-btn ${mobileTab === 'docs' ? 'active' : ''}`}
          onClick={() => setMobileTab('docs')}
        >
          Documents ({documents.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'chat'}
          className={`mob-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          AI Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'pdf'}
          className={`mob-tab-btn ${mobileTab === 'pdf' ? 'active' : ''}`}
          onClick={() => setMobileTab('pdf')}
          disabled={!activeDocument}
        >
          PDF Viewer
        </button>
      </div>

      {error ? <div className="banner error-text">{error}</div> : null}

      {/* 2. Three-Panel Workspace Grid (Chat-First) */}
      <section className="workspace-grid">
        {/* Left Column: Document Sidebar */}
        <div
          className={`left-column ${!isSidebarOpen ? 'closed' : ''} ${
            mobileTab === 'docs' ? 'mobile-visible' : ''
          }`}
        >
          <DocumentSidebar
            user={user}
            documents={documents}
            activeDocumentId={activeDocument?.id}
            loading={loadingDocuments}
            onSelect={(id) => {
              onSelectDocument(id)
              setMobileTab('chat')
            }}
            onDelete={onDeleteDocument}
            onNew={() => {
              onNewDocument()
              setMobileTab('chat')
            }}
            onSignOut={onSignOut}
            onNavigateHome={onNavigateHome}
          />
        </div>

        {/* Center Column: Primary AI Chat Workspace */}
        <div
          className={`center-column ${mobileTab === 'chat' ? 'mobile-visible' : ''}`}
        >
          {!activeDocument ? (
            <div className="empty-workspace-wrapper">
              <div className="empty-workspace-container">
                <UploadPanel loading={uploading} onUpload={onUpload} />
              </div>
            </div>
          ) : (
            <ChatWindow
              document={activeDocument}
              messages={messages}
              loading={loadingChat}
              onSend={onSendMessage}
              onNavigateCitation={handleNavigateCitation}
            />
          )}
        </div>

        {/* Right Column: Independently Collapsible PDF Viewer */}
        {activeDocument ? (
          <div
            className={`right-column ${!isPreviewOpen ? 'closed' : ''} ${
              mobileTab === 'pdf' ? 'mobile-visible' : ''
            }`}
          >
            <PDFViewer
              title={activeDocument?.title}
              url={previewUrl}
              targetPage={targetPage}
              onPageChange={(p) => setTargetPage(p)}
            />
          </div>
        ) : null}
      </section>
    </main>
  )
}
