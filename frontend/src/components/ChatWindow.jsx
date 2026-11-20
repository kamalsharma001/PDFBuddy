import { useState, useRef, useEffect, Children } from 'react'
import ReactMarkdown from 'react-markdown'
import { Logo } from './Logo.jsx'

function processTextForCitations(str, onNavigateCitation) {
  if (typeof str !== 'string') return str
  const regex = /\[Page\s+(\d+)\]|\(Page\s+(\d+)\)|\[p\.\s*(\d+)\]/gi
  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index))
    }
    const pageNum = parseInt(match[1] || match[2] || match[3], 10)
    parts.push(
      <button
        key={`cite-${match.index}-${pageNum}`}
        type="button"
        className="citation-pill"
        onClick={() => onNavigateCitation && onNavigateCitation(pageNum)}
        title={`Jump to Page ${pageNum} in PDF viewer`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Page {pageNum}
      </button>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex))
  }

  return parts.length > 0 ? parts : str
}

function processChildren(children, onNavigateCitation) {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return processTextForCitations(child, onNavigateCitation)
    }
    return child
  })
}

function TypewriterMarkdown({ text, animate, onNavigateCitation }) {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text)

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text)
      return
    }

    let currentIndex = 0
    const interval = setInterval(() => {
      currentIndex += 4
      if (currentIndex >= text.length) {
        setDisplayedText(text)
        clearInterval(interval)
      } else {
        setDisplayedText(text.slice(0, currentIndex))
      }
    }, 8)

    return () => clearInterval(interval)
  }, [text, animate])

  const customComponents = {
    p: ({ children }) => <p>{processChildren(children, onNavigateCitation)}</p>,
    li: ({ children }) => <li>{processChildren(children, onNavigateCitation)}</li>,
    code: ({ inline, children }) => {
      if (inline) {
        return <code className="inline-code">{children}</code>
      }
      return (
        <div className="code-block-wrapper">
          <pre className="code-block">
            <code>{children}</code>
          </pre>
        </div>
      )
    },
  }

  return <ReactMarkdown components={customComponents}>{displayedText}</ReactMarkdown>
}

const STARTER_PROMPTS = [
  'Summarize the core takeaways and executive summary.',
  'Identify key operational risks, bottlenecks, or challenges.',
  'Extract financial performance metrics and revenue drivers.',
  'Explain the main technical architectural decisions.',
]

export function ChatWindow({
  document,
  messages = [],
  loading = false,
  onSend,
  onNavigateCitation,
}) {
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(event) {
    event?.preventDefault()
    const value = draft.trim()
    if (!value || !document || loading) return
    setDraft('')
    await onSend(value)
  }

  const handlePromptClick = (promptText) => {
    if (!document || loading || document.status !== 'ready') return
    onSend(promptText)
  }

  return (
    <section className="panel chat-window">
      {/* 1. Chat Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{document?.title ?? 'Select a Document'}</h3>
          <p>
            {document
              ? `${document.page_count ? `${document.page_count} pages • ` : ''}Grounded document context with exact page citations.`
              : 'Select or upload a PDF from the sidebar to start a conversation.'}
          </p>
        </div>
      </div>

      {/* 2. Message List */}
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="empty-state chat-empty-state">
            <div className="empty-brand-wrap">
              <Logo size={44} showWordmark={false} />
            </div>
            <h4>Ask anything about this document</h4>
            <p>
              Grounded AI answers extracted directly from your PDF with verifiable page citations.
            </p>

            {document && document.status === 'ready' && (
              <div className="starter-prompts-container">
                <span className="starter-prompts-label">Suggested questions:</span>
                <div className="starter-prompts-grid">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-pill-btn"
                      onClick={() => handlePromptClick(prompt)}
                      disabled={loading}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2EC4B6" strokeWidth="2" style={{ marginRight: 6 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id ?? `${message.role}-${message.content}`}
              className={`message ${message.role}`}
            >
              <div className="message-header-row">
                <span className="message-role">
                  {message.role === 'user' ? 'You' : 'PDFBuddy AI'}
                </span>
                {message.created_at && (
                  <span className="message-time">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="markdown-body">
                <TypewriterMarkdown
                  text={message.content}
                  animate={message.animate}
                  onNavigateCitation={onNavigateCitation}
                />
              </div>
            </article>
          ))
        )}

        {loading && (
          <article className="message assistant loading-message">
            <span className="message-role">PDFBuddy AI</span>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </article>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Composer / Input Form */}
      <form className="chat-form" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim() && document?.status === 'ready' && !loading) {
                  void handleSubmit(e)
                }
              }
            }}
            placeholder={
              !document
                ? 'Select a document to begin...'
                : document.status !== 'ready'
                ? 'Analyzing document, please wait...'
                : 'Ask a question about this document... (Enter to send, Shift+Enter for newline)'
            }
            disabled={!document || loading || document.status !== 'ready'}
            rows={1}
            className="chat-input"
          />
          <button
            type="submit"
            className="send-button"
            disabled={!document || loading || !draft.trim() || document.status !== 'ready'}
            title="Send question"
          >
            {loading ? (
              <span className="spinner">...</span>
            ) : (
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
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
