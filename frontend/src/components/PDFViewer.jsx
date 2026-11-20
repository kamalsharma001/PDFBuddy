import { useState, useEffect } from 'react'

export function PDFViewer({ title, url, targetPage = 1, onPageChange }) {
  const [currentPage, setCurrentPage] = useState(targetPage)
  const [totalPages, setTotalPages] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [pageInputValue, setPageInputValue] = useState(String(targetPage))
  const [isFitWidth, setIsFitWidth] = useState(true)

  // Sync when parent requests a specific target page (e.g. from a citation click)
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage)
      setPageInputValue(String(targetPage))
    }
  }, [targetPage])

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1
      setCurrentPage(nextP)
      setPageInputValue(String(nextP))
      if (onPageChange) onPageChange(nextP)
    }
  }

  const handleNextPage = () => {
    const nextP = currentPage + 1
    setCurrentPage(nextP)
    setPageInputValue(String(nextP))
    if (onPageChange) onPageChange(nextP)
  }

  const handlePageInputSubmit = (e) => {
    e.preventDefault()
    const p = parseInt(pageInputValue, 10)
    if (!isNaN(p) && p >= 1) {
      setCurrentPage(p)
      if (onPageChange) onPageChange(p)
    } else {
      setPageInputValue(String(currentPage))
    }
  }

  const handleZoomIn = () => {
    setIsFitWidth(false)
    setZoomLevel((prev) => Math.min(prev + 25, 250))
  }

  const handleZoomOut = () => {
    setIsFitWidth(false)
    setZoomLevel((prev) => Math.max(prev - 25, 50))
  }

  const handleToggleFit = () => {
    setIsFitWidth(!isFitWidth)
    if (!isFitWidth) {
      setZoomLevel(100)
    }
  }

  // Construct iframe src with PDF parameters (supported by all modern PDF viewing engines)
  const viewerParams = isFitWidth
    ? `#page=${currentPage}&view=FitH`
    : `#page=${currentPage}&zoom=${zoomLevel}`

  return (
    <section className="panel pdf-viewer-panel">
      {/* 1. PDF Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <div className="pdf-nav-controls">
            <button
              type="button"
              className="toolbar-btn"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || !url}
              title="Previous Page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <form onSubmit={handlePageInputSubmit} className="page-input-form">
              <span className="page-label">Page</span>
              <input
                type="text"
                className="page-input"
                value={pageInputValue}
                onChange={(e) => setPageInputValue(e.target.value)}
                onBlur={handlePageInputSubmit}
                disabled={!url}
                title="Enter page number and press Enter"
              />
            </form>

            <button
              type="button"
              className="toolbar-btn"
              onClick={handleNextPage}
              disabled={!url}
              title="Next Page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pdf-toolbar-right">
          <div className="pdf-zoom-controls">
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleZoomOut}
              disabled={!url || zoomLevel <= 50}
              title="Zoom out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <button
              type="button"
              className={`toolbar-btn text-btn ${isFitWidth ? 'active' : ''}`}
              onClick={handleToggleFit}
              disabled={!url}
              title={isFitWidth ? 'Fit Width Active' : 'Fit to Width'}
            >
              {isFitWidth ? 'Fit' : `${zoomLevel}%`}
            </button>

            <button
              type="button"
              className="toolbar-btn"
              onClick={handleZoomIn}
              disabled={!url || zoomLevel >= 250}
              title="Zoom in"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="toolbar-btn external-link-btn"
              title="Open raw PDF in new browser tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* 2. PDF Viewer Canvas */}
      <div className="pdf-frame-container">
        {url ? (
          <iframe
            key={`${url}-${currentPage}-${isFitWidth ? 'fit' : zoomLevel}`}
            src={`${url}${viewerParams}`}
            title={title ?? 'PDF Document Viewer'}
            className="viewer-frame"
          />
        ) : (
          <div className="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#A3AFBF" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>Select a document from the sidebar to preview pages here.</p>
          </div>
        )}
      </div>
    </section>
  )
}
