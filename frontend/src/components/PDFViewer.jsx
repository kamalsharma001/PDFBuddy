import { useState, useEffect, useRef } from 'react'

export function PDFViewer({
  title,
  url,
  targetPage = 1,
  totalPages: propTotalPages = 1,
  onPageChange,
}) {
  const [currentPage, setCurrentPage] = useState(targetPage)
  const [totalPages, setTotalPages] = useState(propTotalPages || 1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [fitMode, setFitMode] = useState('width') // 'width' | 'page' | 'custom'
  const [pageInputValue, setPageInputValue] = useState(String(targetPage))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const panelRef = useRef(null)

  // Sync total pages when prop changes
  useEffect(() => {
    if (propTotalPages && propTotalPages > 0) {
      setTotalPages(propTotalPages)
    }
  }, [propTotalPages])

  // Sync when parent requests a specific target page (e.g. from an AI citation click)
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage)
      setPageInputValue(String(targetPage))
    }
  }, [targetPage])

  // Track browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1
      setCurrentPage(nextP)
      setPageInputValue(String(nextP))
      onPageChange?.(nextP)
    }
  }

  const handleNextPage = () => {
    const maxP = totalPages > 0 ? totalPages : 9999
    if (currentPage < maxP) {
      const nextP = currentPage + 1
      setCurrentPage(nextP)
      setPageInputValue(String(nextP))
      onPageChange?.(nextP)
    }
  }

  const handlePageInputSubmit = (e) => {
    e.preventDefault()
    const p = parseInt(pageInputValue, 10)
    const maxP = totalPages > 0 ? totalPages : 9999
    if (!isNaN(p) && p >= 1 && p <= maxP) {
      setCurrentPage(p)
      onPageChange?.(p)
    } else {
      setPageInputValue(String(currentPage))
    }
  }

  const handleZoomIn = () => {
    setFitMode('custom')
    setZoomLevel((prev) => Math.min(prev + 15, 250))
  }

  const handleZoomOut = () => {
    setFitMode('custom')
    setZoomLevel((prev) => Math.max(prev - 15, 50))
  }

  const handleFitWidth = () => {
    setFitMode('width')
    setZoomLevel(100)
  }

  const handleFitPage = () => {
    setFitMode('page')
    setZoomLevel(100)
  }

  const toggleFullscreen = () => {
    if (!panelRef.current) return
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  // Construct iframe hash parameters for browser PDF engine:
  // - view=FitH: horizontally centered & fits container width (Default)
  // - view=Fit: fits entire page in viewport
  // - zoom=Z: custom zoom percentage
  let viewerParams = `#page=${currentPage}&view=FitH`
  if (fitMode === 'page') {
    viewerParams = `#page=${currentPage}&view=Fit`
  } else if (fitMode === 'custom') {
    viewerParams = `#page=${currentPage}&zoom=${zoomLevel}`
  }

  return (
    <section ref={panelRef} className="panel pdf-viewer-panel">
      {/* 1. Compact Cohesive PDF Toolbar */}
      <div className="pdf-toolbar" role="toolbar" aria-label="PDF Document Controls">
        {/* Left: Page Navigation */}
        <div className="pdf-toolbar-group page-nav-group">
          <button
            type="button"
            className="toolbar-btn icon-btn"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || !url}
            title="Previous Page"
            aria-label="Previous Page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <form onSubmit={handlePageInputSubmit} className="page-input-form">
            <input
              type="text"
              className="page-input"
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={handlePageInputSubmit}
              disabled={!url}
              title="Current page number"
              aria-label="Current page number"
            />
            <span className="page-total-label">/ {totalPages}</span>
          </form>

          <button
            type="button"
            className="toolbar-btn icon-btn"
            onClick={handleNextPage}
            disabled={!url || (totalPages > 0 && currentPage >= totalPages)}
            title="Next Page"
            aria-label="Next Page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Center: Zoom Controls & Percentage */}
        <div className="pdf-toolbar-group zoom-group">
          <button
            type="button"
            className="toolbar-btn icon-btn"
            onClick={handleZoomOut}
            disabled={!url || zoomLevel <= 50}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <span className="zoom-percentage-badge" title="Current zoom level">
            {fitMode === 'width' ? 'Fit W' : fitMode === 'page' ? 'Fit P' : `${zoomLevel}%`}
          </span>

          <button
            type="button"
            className="toolbar-btn icon-btn"
            onClick={handleZoomIn}
            disabled={!url || zoomLevel >= 250}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Fit Width / Fit Page Mode Toggles */}
        <div className="pdf-toolbar-group fit-group">
          <button
            type="button"
            className={`toolbar-btn text-btn ${fitMode === 'width' ? 'active' : ''}`}
            onClick={handleFitWidth}
            disabled={!url}
            title="Fit to Width"
          >
            Fit Width
          </button>
          <button
            type="button"
            className={`toolbar-btn text-btn ${fitMode === 'page' ? 'active' : ''}`}
            onClick={handleFitPage}
            disabled={!url}
            title="Fit Entire Page"
          >
            Fit Page
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Right: Fullscreen & External Open */}
        <div className="pdf-toolbar-group action-group">
          <button
            type="button"
            className={`toolbar-btn icon-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            disabled={!url}
            title={isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="toolbar-btn icon-btn"
              title="Open raw PDF in new browser tab"
              aria-label="Open PDF in new tab"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* 2. Maximized PDF Viewer Canvas */}
      <div className="pdf-frame-container">
        {url ? (
          <iframe
            key={`${url}-${currentPage}-${fitMode === 'custom' ? zoomLevel : fitMode}`}
            src={`${url}${viewerParams}`}
            title={title ?? 'PDF Document Viewer'}
            className="viewer-frame"
          />
        ) : (
          <div className="empty-state">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A3AFBF"
              strokeWidth="1.5"
              style={{ marginBottom: 12 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>Select a document from the sidebar to preview pages here.</p>
          </div>
        )}
      </div>
    </section>
  )
}
