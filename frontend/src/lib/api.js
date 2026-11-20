export const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function apiFetch(path, init) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include', // Ensures HttpOnly session cookies are transmitted
    headers: {
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = 'Request failed'
    try {
      const errJson = await response.json()
      message = errJson.detail || JSON.stringify(errJson)
    } catch {
      message = await response.text()
    }
    throw new Error(message || 'Request failed')
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
}

export function getCurrentUser() {
  return apiFetch('/auth/me')
}

export function loginUser(email, password, rememberMe = false) {
  return apiFetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      remember_me: rememberMe,
    }),
  })
}

export function registerUser(name, email, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  })
}

export function forgotPassword(email) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token, newPassword) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      new_password: newPassword,
    }),
  })
}

export function logoutUser() {
  return apiFetch('/auth/logout', {
    method: 'POST',
  })
}

export function getGoogleLoginUrl() {
  return `${API_URL}/auth/google/login`
}

export function listDocuments() {
  return apiFetch('/documents/')
}

export function getDocumentHistory(documentId) {
  return apiFetch(`/documents/${documentId}/history`)
}

export function uploadDocument(file, title) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)

  return apiFetch('/documents/upload', {
    method: 'POST',
    body: formData,
  })
}

export function sendMessage(documentId, message, conversationId) {
  return apiFetch('/chat/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_id: documentId,
      message,
      conversation_id: conversationId,
    }),
  })
}

export function deleteDocument(documentId) {
  return apiFetch(`/documents/${documentId}`, {
    method: 'DELETE',
  })
}

export function getDocumentPreview(documentId) {
  return apiFetch(`/documents/${documentId}/preview`)
}
