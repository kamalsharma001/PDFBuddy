import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { useRouter } from './lib/router.js'
import { AppPage } from './pages/AppPage.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import {
  getCurrentUser,
  getDocumentHistory,
  getDocumentPreview,
  listDocuments,
  logoutUser,
  sendMessage,
  uploadDocument,
  deleteDocument,
} from './lib/api.js'

function App() {
  const { path, navigate } = useRouter()
  const [user, setUser] = useState(null)
  const [documents, setDocuments] = useState([])
  const [activeDocumentId, setActiveDocumentId] = useState(null)
  const [messages, setMessages] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) ?? null,
    [activeDocumentId, documents],
  )

  useEffect(() => {
    document.title = 'PDFBuddy'
    void bootstrapSession()
  }, [])

  useEffect(() => {
    if (!activeDocument?.id || !user) {
      setPreviewUrl(null)
      return
    }

    getDocumentPreview(activeDocument.id)
      .then((data) => setPreviewUrl(data.url))
      .catch(() => setPreviewUrl(null))
  }, [activeDocument?.id, user])

  async function bootstrapSession() {
    setLoadingAuth(true)
    setError(null)
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      await loadDocuments()
    } catch {
      setUser(null)
    } finally {
      setLoadingAuth(false)
    }
  }

  async function loadDocuments() {
    setLoadingDocuments(true)
    try {
      const userDocs = await listDocuments()
      setDocuments(userDocs)
      if (userDocs.length > 0 && !activeDocumentId) {
        await selectDocument(userDocs[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.')
    } finally {
      setLoadingDocuments(false)
    }
  }

  async function selectDocument(documentId) {
    if (activeDocumentId === documentId && messages.length > 0) return
    setActiveDocumentId(documentId)
    setMessages([])
    setLoadingChat(true)
    setError(null)
    try {
      const payload = await getDocumentHistory(documentId)
      setMessages(payload.history)
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === payload.document.id ? payload.document : doc)),
      )
    } catch (selectErr) {
      setError(
        selectErr instanceof Error
          ? selectErr.message
          : 'Failed to load document conversation.',
      )
    } finally {
      setLoadingChat(false)
    }
  }

  async function handleAuthSuccess(authenticatedUser) {
    setUser(authenticatedUser)
    navigate('/workspace')
    await loadDocuments()
  }

  async function handleSignOut() {
    try {
      await logoutUser()
    } catch {
      // Ignored on logout
    } finally {
      setUser(null)
      setDocuments([])
      setMessages([])
      setActiveDocumentId(null)
      setPreviewUrl(null)
      navigate('/')
    }
  }

  async function handleUpload(file, title) {
    if (!user) return
    setUploading(true)
    setError(null)
    try {
      const payload = await uploadDocument(file, title)
      setDocuments((prev) => [payload.document, ...prev])
      setActiveDocumentId(payload.document.id)
      setMessages(payload.history)
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSendMessage(message) {
    if (!user || !activeDocument) return

    const tempId = `temp-${Date.now()}`
    const tempUserMessage = {
      id: tempId,
      role: 'user',
      content: message,
    }

    setMessages((prev) => [...prev, tempUserMessage])
    setLoadingChat(true)
    setError(null)
    try {
      const response = await sendMessage(activeDocument.id, message)
      const newHistory = response.history.map((m, index) => {
        if (index === response.history.length - 1 && m.role === 'assistant') {
          return { ...m, animate: true }
        }
        return m
      })
      setMessages(newHistory)
    } catch (chatErr) {
      setError(chatErr instanceof Error ? chatErr.message : 'Chat response failed.')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setLoadingChat(false)
    }
  }

  async function handleDeleteDocument(documentId) {
    if (!user) return
    try {
      await deleteDocument(documentId)
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
      if (activeDocumentId === documentId) {
        setMessages([])
        setActiveDocumentId(null)
        setPreviewUrl(null)
      }
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Delete failed.')
    }
  }

  function handleNewDocument() {
    setActiveDocumentId(null)
    setMessages([])
    setPreviewUrl(null)
  }

  if (loadingAuth) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <img src="/favicon.svg" alt="PDFBuddy Logo" className="loading-logo" width="48" height="48" />
          <div className="spinner-icon"></div>
          <p>Loading PDFBuddy...</p>
        </div>
      </main>
    )
  }

  // Routing Switch
  if (path === '/') {
    return <LandingPage user={user} onNavigate={navigate} />
  }

  if (path === '/login') {
    if (user) {
      navigate('/workspace')
      return null
    }
    return <AuthPage initialMode="login" onNavigate={navigate} onSuccess={handleAuthSuccess} />
  }

  if (path === '/register') {
    if (user) {
      navigate('/workspace')
      return null
    }
    return <AuthPage initialMode="register" onNavigate={navigate} onSuccess={handleAuthSuccess} />
  }

  if (path === '/forgot-password') {
    return <AuthPage initialMode="forgot" onNavigate={navigate} />
  }

  if (path === '/reset-password') {
    return <AuthPage initialMode="reset" onNavigate={navigate} />
  }

  if (path === '/workspace') {
    if (!user) {
      return <AuthPage initialMode="login" onNavigate={navigate} onSuccess={handleAuthSuccess} />
    }
    return (
      <AppPage
        user={user}
        documents={documents}
        activeDocument={activeDocument}
        messages={messages}
        previewUrl={previewUrl}
        loadingDocuments={loadingDocuments}
        loadingChat={loadingChat}
        uploading={uploading}
        error={error}
        onSelectDocument={(docId) => void selectDocument(docId)}
        onUpload={handleUpload}
        onSendMessage={handleSendMessage}
        onSignOut={handleSignOut}
        onDeleteDocument={handleDeleteDocument}
        onNewDocument={handleNewDocument}
        onNavigateHome={() => navigate('/')}
      />
    )
  }

  // Default fallback route
  if (user) {
    return (
      <AppPage
        user={user}
        documents={documents}
        activeDocument={activeDocument}
        messages={messages}
        previewUrl={previewUrl}
        loadingDocuments={loadingDocuments}
        loadingChat={loadingChat}
        uploading={uploading}
        error={error}
        onSelectDocument={(docId) => void selectDocument(docId)}
        onUpload={handleUpload}
        onSendMessage={handleSendMessage}
        onSignOut={handleSignOut}
        onDeleteDocument={handleDeleteDocument}
        onNewDocument={handleNewDocument}
        onNavigateHome={() => navigate('/')}
      />
    )
  }

  return <LandingPage user={user} onNavigate={navigate} />
}

export default App
