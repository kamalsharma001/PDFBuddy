import { useState, useEffect } from 'react'

export function useRouter() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
      setCurrentPath(path)
      window.scrollTo(0, 0)
    }
  }

  return { path: currentPath, navigate }
}
