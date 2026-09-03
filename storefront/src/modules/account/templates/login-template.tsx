"use client"

import { useState } from "react"
import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import { AnimatePresence, motion } from "framer-motion"
import type { CopyBlock } from "@lib/util/site-copy"
import AuthPortal from "../components/auth-portal"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

type LoginTemplateProps = {
  redirectTo?: string
  /** Blok `global.prihlaseni` — fotka vedle formuláře. */
  block?: CopyBlock
}

const LoginTemplate = ({ redirectTo, block }: LoginTemplateProps) => {
  const [currentView, setCurrentView] = useState<LOGIN_VIEW>(LOGIN_VIEW.SIGN_IN)
  const isSignIn = currentView === LOGIN_VIEW.SIGN_IN

  return (
    <AuthPortal mode={isSignIn ? "login" : "register"} block={block}>
      {/* No `initial={false}`: it sets a presence context that suppresses mount animations for
          everything beneath it, so the sign-in heading's own entrance never ran. Switching
          between the two views still animates — that is `mode="wait"` and `exit`, not this. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={transition}
          style={styleObj}
        >
          {isSignIn ? (
            <Login setCurrentView={setCurrentView} redirectTo={redirectTo} />
          ) : (
            <Register setCurrentView={setCurrentView} redirectTo={redirectTo} />
          )}
        </motion.div>
      </AnimatePresence>
    </AuthPortal>
  )
}

export default LoginTemplate


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, x: 18 }
const animate = { opacity: 1, x: 0 }
const exit = { opacity: 0, x: -18 }
const transition = { duration: .42, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const styleObj = { width: "100%" as const }
