import { useState } from 'react'

export function UploadPanel({
  disabled = false,
  loading = false,
  onUpload,
}) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a PDF file first.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50 MB.')
      return
    }

    setError(null)
    await onUpload(file, title.trim() || file.name.replace(/\.pdf$/i, ''))
    setFile(null)
    setTitle('')
    event.currentTarget.reset()
  }

  return (
    <form className="panel upload-panel" onSubmit={handleSubmit}>
      <div className="upload-header">
        <h3>Upload Document</h3>
        <p className="muted-text">
          Upload a PDF to analyze its contents and start querying with AI immediately.
        </p>
      </div>

      <div
        className="drop-zone"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="upload-icon"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <p><strong>Click or drag to choose a PDF</strong></p>
        <small className="muted-text">
          {file ? file.name : 'Max file size 50 MB (application/pdf)'}
        </small>
        <input
          id="file-upload"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || loading}
          style={{ display: 'none' }}
        />
      </div>

      <label className="field">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional: Custom document title..."
          disabled={disabled || loading}
          className="title-input"
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <button
        type="submit"
        disabled={disabled || loading || !file}
        className={`btn-upload ${loading ? 'loading' : ''}`}
      >
        {loading ? (
          <>
            <span className="btn-upload-spinner" aria-hidden="true" />
            <span>Processing & Indexing...</span>
          </>
        ) : (
          <span>Upload & Start Chat</span>
        )}
      </button>
    </form>
  )
}
