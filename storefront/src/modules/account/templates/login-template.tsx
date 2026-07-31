"use client"

import { useState } from "react"
import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import { AnimatePresence, motion } from "framer-motion"
import AuthPortal from "../components/auth-portal"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

type LoginTemplateProps = {
  redirectTo?: string
}

const LoginTemplate = ({ redirectTo }: LoginTemplateProps) => {
  const [currentView, setCurrentView] = useState<LOGIN_VIEW>(LOGIN_VIEW.SIGN_IN)
  const isSignIn = currentView === LOGIN_VIEW.SIGN_IN

  return (
    <AuthPortal mode={isSignIn ? "login" : "register"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: .42, ease: [0.76, 0, 0.24, 1] }}
          style={{ width: "100%" }}
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
