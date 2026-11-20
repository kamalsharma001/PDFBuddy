import { useState } from 'react'
import { Logo } from '../components/Logo.jsx'

export function LandingPage({ user, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activePreviewDoc, setActivePreviewDoc] = useState(0)

  const previewDocuments = [
    { title: '2026_Global_Tech_Outlook.pdf', pages: 32, size: '2.4 MB' },
    { title: 'Transformer_Attention_Mechanisms.pdf', pages: 18, size: '1.1 MB' }
  ]

  const handleCta = () => {
    if (user) {
      onNavigate('/workspace')
    } else {
      onNavigate('/register')
    }
  }

  return (
    <div className="landing-page">
      {/* 1. Minimal Top Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Logo size={28} showWordmark={true} onClick={() => onNavigate('/')} />

          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <button
                type="button"
                className="btn-primary-teal"
                onClick={() => onNavigate('/workspace')}
              >
                Open Workspace
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 6 }}>
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-text-nav"
                  onClick={() => onNavigate('/login')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="btn-primary-teal"
                  onClick={() => onNavigate('/register')}
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <div className="mobile-nav-buttons">
              {user ? (
                <button type="button" className="btn-primary-teal" onClick={() => { setMobileMenuOpen(false); onNavigate('/workspace'); }}>
                  Open Workspace
                </button>
              ) : (
                <>
                  <button type="button" className="btn-secondary" onClick={() => { setMobileMenuOpen(false); onNavigate('/login'); }}>
                    Sign in
                  </button>
                  <button type="button" className="btn-primary-teal" onClick={() => { setMobileMenuOpen(false); onNavigate('/register'); }}>
                    Get Started Free
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. Visual Centerpiece Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content animate-fade-in">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            AI Document Intelligence Platform
          </div>

          <h1 className="hero-title">
            Your PDFs. <span className="text-teal">Understood.</span>
          </h1>

          <p className="hero-subtitle">
            Chat with documents, extract verified data, and click precision page citations that navigate directly to the source.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn-primary-teal btn-hero"
              onClick={handleCta}
            >
              Start Chatting Free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 8 }}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <a href="#features" className="btn-secondary btn-hero">
              See Capabilities
            </a>
          </div>

          <div className="hero-trust-row">
            <span>✓ Private Object Storage</span>
            <span>✓ Precision Page Citations</span>
            <span>✓ Instant Semantic Search</span>
            <span>✓ Enterprise-Grade Security</span>
          </div>
        </div>

        {/* DOMINANT PRODUCT DEMONSTRATION WORKSPACE */}
        <div className="hero-product-preview animate-fade-in-delayed">
          <div className="preview-window-frame">
            {/* Window Topbar */}
            <div className="preview-window-header">
              <div className="mock-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="preview-header-center">
                <Logo size={16} showWordmark={true} />
                <span className="preview-active-pill">2026_Global_Tech_Outlook.pdf</span>
              </div>
              <div className="preview-header-status">
                <span className="status-indicator"></span> 32 Pages Vectorized
              </div>
            </div>

            {/* Realistic 3-Panel Workspace */}
            <div className="preview-workspace-layout">
              {/* Left Panel: Document Sidebar (240px) */}
              <div className="preview-sidebar">
                <div className="preview-sidebar-header">
                  <span className="preview-label">Document Library</span>
                  <span className="preview-quota-badge">2/5</span>
                </div>

                <div className="preview-search-box">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span>Search documents...</span>
                </div>

                <div className="preview-doc-list">
                  {previewDocuments.map((doc, idx) => (
                    <div
                      key={doc.title}
                      className={`preview-doc-item ${activePreviewDoc === idx ? 'active' : ''}`}
                      onClick={() => setActivePreviewDoc(idx)}
                    >
                      <div className="preview-doc-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="preview-doc-meta">
                        <span className="preview-doc-title">{doc.title}</span>
                        <span className="preview-doc-sub">{doc.pages} pages • {doc.size}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="preview-sidebar-user">
                  <div className="preview-avatar">ER</div>
                  <div className="preview-user-text">
                    <strong>Elena Rostova</strong>
                    <small>elena@acme-corp.ai</small>
                  </div>
                </div>
              </div>

              {/* Center Panel: Primary AI Chat (flex: 1) */}
              <div className="preview-chat">
                <div className="preview-chat-top">
                  <div className="preview-doc-active-header">
                    <strong>2026_Global_Tech_Outlook.pdf</strong>
                    <span className="preview-context-tag">Grounded Context</span>
                  </div>
                </div>

                <div className="preview-messages">
                  <div className="preview-msg user">
                    <span className="preview-author">You</span>
                    <p>What are the key generative AI projections for enterprise adoption by 2027?</p>
                  </div>

                  <div className="preview-msg assistant">
                    <span className="preview-author text-teal">PDFBuddy AI</span>
                    <p>
                      According to executive projections on <span className="citation-pill animated-pulse">Page 4</span>, enterprise generative AI integration is expected to surge by <strong>142% over the next 24 months</strong>.
                    </p>
                    <div className="preview-bullet-list">
                      <div className="preview-bullet-item">
                        • <strong>Automated Intelligence:</strong> 68% of surveyed CTOs report migrating to retrieval-augmented systems <span className="citation-pill">Page 9</span>.
                      </div>
                      <div className="preview-bullet-item">
                        • <strong>Cost Efficiency:</strong> Intelligent semantic retrieval and serverless processing demonstrate a <strong>4.2x reduction</strong> in operational overhead <span className="citation-pill">Page 15</span>.
                      </div>
                    </div>
                    <p className="preview-followup">
                      Verified across Section 3.2 risk and architecture frameworks.
                    </p>
                  </div>
                </div>

                <div className="preview-input-container">
                  <div className="preview-input-bar">
                    <span>Ask a follow-up question...</span>
                    <button type="button" className="preview-send-btn" aria-label="Send">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel: Synchronized PDF Viewer (300px) */}
              <div className="preview-viewer">
                <div className="preview-viewer-toolbar">
                  <span className="preview-page-indicator">Page 4 of 32</span>
                  <div className="preview-viewer-actions">
                    <span className="preview-tool-btn">−</span>
                    <span className="preview-tool-btn">100%</span>
                    <span className="preview-tool-btn">+</span>
                    <span className="preview-tool-btn fit">Fit</span>
                  </div>
                </div>

                <div className="preview-page-sheet">
                  <div className="sheet-header-line">Section 3.2 — Enterprise AI Integration</div>
                  <div className="sheet-text-skeleton"></div>
                  <div className="sheet-highlight-box">
                    <div className="sheet-highlight-bar"></div>
                    <span>Enterprise adoption will accelerate 142% YoY driven by RAG pipelines.</span>
                  </div>
                  <div className="sheet-text-skeleton medium"></div>
                  <div className="sheet-text-skeleton"></div>
                  
                  <div className="sheet-table-mock">
                    <div className="sheet-table-row header">
                      <span>Initiative</span><span>Growth</span><span>Savings</span>
                    </div>
                    <div className="sheet-table-row">
                      <span>Doc Retrieval</span><span>+68%</span><span>3.2x</span>
                    </div>
                    <div className="sheet-table-row">
                      <span>Vector Ops</span><span>+142%</span><span>4.2x</span>
                    </div>
                  </div>
                  <div className="sheet-text-skeleton short"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Compact 4-Card Feature Highlights */}
      <section id="features" className="landing-section">
        <div className="section-header">
          <span className="section-badge">Core Capabilities</span>
          <h2>Built for Precision Research</h2>
          <p>Everything required to query, verify, and cite complex documents with complete confidence.</p>
        </div>

        <div className="compact-features-grid">
          <div className="compact-feature-card">
            <div className="feature-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3>Exact Page-Level Citations</h3>
            <p>Every response references the source page. Click any citation to instantly open and jump to that page in the PDF.</p>
          </div>

          <div className="compact-feature-card">
            <div className="feature-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <h3>Instant Semantic Retrieval</h3>
            <p>High-dimensional neural embeddings indexed for immediate, sub-second semantic retrieval across any document length.</p>
          </div>

          <div className="compact-feature-card">
            <div className="feature-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </div>
            <h3>Chat-First 3-Panel Workspace</h3>
            <p>Collapsible sidebar, dominant central AI chat copilot, and dedicated PDF viewer give you complete focus.</p>
          </div>

          <div className="compact-feature-card">
            <div className="feature-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3>Zero-Egress Private Storage</h3>
            <p>Documents are stored in private Cloudflare R2 object buckets, streaming securely via signed expiring URLs.</p>
          </div>
        </div>
      </section>

      {/* 4. Visual 3-Step How It Works */}
      <section id="how-it-works" className="landing-section bg-secondary">
        <div className="section-header">
          <span className="section-badge">How It Works</span>
          <h2>From PDF to Intelligence in Seconds</h2>
          <p>A simple 3-step pipeline designed for speed and verification.</p>
        </div>

        <div className="workflow-steps-container">
          <div className="workflow-step-card">
            <div className="workflow-num">01</div>
            <h3>Upload PDF</h3>
            <p>Drop any document up to 50MB. Text is securely extracted and chunked page-by-page.</p>
          </div>

          <div className="workflow-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <div className="workflow-step-card">
            <div className="workflow-num">02</div>
            <h3>Query Naturally</h3>
            <p>Ask about specific tables, metrics, summaries, or compare complex paragraphs.</p>
          </div>

          <div className="workflow-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <div className="workflow-step-card">
            <div className="workflow-num">03</div>
            <h3>Verify with Citations</h3>
            <p>Receive context-grounded answers with clickable citations that jump directly to the page.</p>
          </div>
        </div>
      </section>

      {/* 5. Final CTA Banner */}
      <section className="landing-closing-cta">
        <div className="closing-cta-card">
          <Logo size={36} showWordmark={true} />
          <h2>Ready to transform how you read documents?</h2>
          <p>Experience intelligent PDF conversation, instant page citations, and zero-compromise security.</p>
          <div className="closing-cta-buttons">
            <button
              type="button"
              className="btn-primary-teal btn-hero"
              onClick={handleCta}
            >
              Get Started for Free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 8 }}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            {!user && (
              <button
                type="button"
                className="btn-secondary btn-hero"
                onClick={() => onNavigate('/login')}
              >
                Sign in to your account
              </button>
            )}
          </div>
          <span className="closing-cta-note">Instant setup • Free tier includes 5 active documents</span>
        </div>
      </section>

      {/* 6. Clean Minimal Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand-col">
            <Logo size={24} showWordmark={true} onClick={() => onNavigate('/')} />
            <p className="footer-desc">
              AI-Powered PDF Chat & Document Intelligence Platform. Grounded RAG with page-level citations.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate(user ? '/workspace' : '/login')}>
              Workspace
            </button>
          </div>

          <div className="footer-links-col">
            <h4>Authentication</h4>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('/login')}>Sign in</button>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('/register')}>Create account</button>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('/forgot-password')}>Forgot password</button>
          </div>

          <div className="footer-links-col">
            <h4>Security</h4>
            <span className="footer-meta-item">Private Object Storage</span>
            <span className="footer-meta-item">High-Speed Semantic Search</span>
            <span className="footer-meta-item">Encrypted Authentication</span>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 PDFBuddy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
