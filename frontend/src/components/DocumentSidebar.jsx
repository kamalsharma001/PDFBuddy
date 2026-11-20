import { useState, useMemo } from 'react'
import { Logo } from './Logo.jsx'

export function DocumentSidebar({
  user,
  documents = [],
  activeDocumentId,
  loading = false,
  onSelect,
  onDelete,
  onNew,
  onSignOut,
  onNavigateHome,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  // Client-side filtering by document title
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase().trim()
    return documents.filter((doc) => doc.title.toLowerCase().includes(q))
  }, [documents, searchQuery])

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!user) return 'U'
    if (user.name) {
      const parts = user.name.trim().split(/\s+/)
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      return parts[0].slice(0, 2).toUpperCase()
    }
    if (user.email) return user.email.slice(0, 2).toUpperCase()
    return 'U'
  }, [user])

  return (
    <aside className="panel sidebar">
      {/* 1. Sidebar Brand Header */}
      <div className="sidebar-header">
        <Logo size={24} showWordmark={true} onClick={onNavigateHome} />
        <span className="count-badge" title="Active storage quota (Free tier)">
          {documents.length}/5
        </span>
      </div>

      {/* 2. New Document Action */}
      <button
        type="button"
        className="btn-new-chat"
        onClick={onNew}
        disabled={documents.length >= 5}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Document / Upload
      </button>

      {documents.length >= 5 && (
        <p className="limit-warning">
          Storage limit reached (5/5). Delete a document to upload a new one.
        </p>
      )}

      {/* 3. Client-Side Document Search */}
      {documents.length > 0 && (
        <div className="sidebar-search-wrapper">
          <svg
            className="search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {loading && <p className="loading-text">Loading documents...</p>}

      {!loading && documents.length === 0 && (
        <div className="sidebar-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#728095" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Your uploaded documents will appear here.</p>
        </div>
      )}

      {/* 4. Document List */}
      <div className="document-list">
        {filteredDocuments.map((document) => (
          <div
            key={document.id}
            className={`document-item ${document.id === activeDocumentId ? 'active' : ''} ${document.status}`}
            onClick={() => onSelect(document.id)}
          >
            <div className="document-info">
              <strong title={document.title}>{document.title}</strong>
              <div className="document-meta-row">
                {document.page_count ? (
                  <span className="doc-page-badge">{document.page_count}p</span>
                ) : null}
                <small>{document.last_message_preview ?? 'No messages yet'}</small>
              </div>
            </div>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`Delete "${document.title}"? This cannot be undone.`)) {
                  onDelete(document.id)
                }
              }}
              title="Delete Document"
              type="button"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        ))}

        {searchQuery && filteredDocuments.length === 0 && (
          <p className="muted-text" style={{ padding: '12px 8px', fontSize: 13 }}>
            No documents matching &quot;{searchQuery}&quot;.
          </p>
        )}
      </div>

      {/* 5. User Profile Card at Sidebar Bottom */}
      <div className="sidebar-user-footer">
        <div className="user-avatar-badge" title={user?.email}>
          {userInitials}
        </div>
        <div className="sidebar-user-text">
          <strong title={user?.name ?? user?.email}>{user?.name ?? 'User'}</strong>
          <small title={user?.email}>{user?.email}</small>
        </div>
        <button
          type="button"
          className="logout-icon-btn"
          onClick={onSignOut}
          title="Sign out of account"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
