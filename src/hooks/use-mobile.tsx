import * as React from "react"

const MOBILE_BREAKPOINT = 768
const IPHONE_BREAKPOINT = 480

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

export function useIsIPhone() {
  const [isIPhone, setIsIPhone] = React.useState<boolean>(false)

  React.useEffect(() => {
    const detectIPhone = () => {
      const userAgent = navigator.userAgent
      // Check for iPhone specifically in user agent
      return /iPhone/.test(userAgent)
    }

    setIsIPhone(detectIPhone())
  }, [])

  return isIPhone
}

export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = React.useState({
    isIOS: false,
    isIPhone: false,
    isSafari: false,
    supportsViewportUnits: true,
    hasNotch: false
  })

  React.useEffect(() => {
    const userAgent = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isIPhone = /iPhone/.test(userAgent) || (isIOS && window.innerWidth <= IPHONE_BREAKPOINT)
    const isSafari = /Safari/.test(userAgent) && !/Chrome|Edg/.test(userAgent)
    
    // Detect iPhone with notch (iPhone X and later)
    const hasNotch = isIOS && (
      window.screen.height >= 812 || // iPhone X+ portrait
      window.screen.width >= 812     // iPhone X+ landscape
    )

    // Check viewport unit support
    const supportsViewportUnits = CSS.supports('height', '100dvh') || 
                                 CSS.supports('height', '100vh')

    setDeviceInfo({
      isIOS,
      isIPhone,
      isSafari,
      supportsViewportUnits,
      hasNotch
    })
  }, [])

  return deviceInfo
}
