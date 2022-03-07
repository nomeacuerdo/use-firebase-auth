import React, {
  createContext,
  ReactNode,
  Dispatch,
  useEffect,
  useContext,
} from "react";
import { FirebaseOptions, FirebaseError, FirebaseApp } from "firebase/app";
import {
  // Functions
  applyActionCode as firebaseApplyActionCode,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  fetchSignInMethodsForEmail,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithPopup,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  updateProfile as firebaseUpdateProfile,
  useDeviceLanguage,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  // Classes
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  TwitterAuthProvider,
  // Interfaces
  AuthProvider,
  User,
  UserCredential,
} from "firebase/auth";
import { useReducedState } from "./use-reduced-state";

interface FirebaseContext {
  user?: User
  loading: boolean | undefined
  error?: FirebaseError
  app: FirebaseApp
  setState: Dispatch<FirebaseAuthState>
  firstCheck: boolean | undefined
}
const FirebaseContext = createContext<FirebaseContext | null>(null)

export enum SIGNIN_PROVIDERS {
  PASSWORD = "password",
  GOOGLE = "google",
  FACEBOOK = "facebook",
  TWITTER = "twitter",
  GITHUB = "github",
  MICROSOFT = "microsoft",
  YAHOO = "yahoo",
}

interface FirebaseAuthState {
  user?: User
  loading?: boolean
  error?: FirebaseError
  firstCheck?: boolean
}

export function FirebaseAuthProvider({
  initializeApp,
  firebaseConfig,
  children,
}: {
  initializeApp: Function
  firebaseConfig: FirebaseOptions
  children: ReactNode
}): JSX.Element {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firebaseCurrentUser = auth.currentUser
  const [{ user, loading, error, firstCheck }, setState] = useReducedState({
    user: firebaseCurrentUser === null ? undefined : firebaseCurrentUser,
    loading: false,
    firstCheck: false,
  } as FirebaseAuthState)

  useEffect(() => {
    !user && setState({ loading: true })
    return onAuthStateChanged(auth, function(user: User | null) {
        setState({
          loading: false,
          user: user === null ? undefined : user,
          firstCheck: true,
        })
      })
  }, [])

  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        error,
        app,
        setState,
        firstCheck,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  )
}

export function useFirebaseAuth() {
  const firebaseContext = useContext(FirebaseContext)

  if (firebaseContext === null) {
    throw new Error("No FirebaseAuthProvider found.")
  }

  const {
    user,
    loading,
    error,
    app,
    setState,
    firstCheck,
  } = firebaseContext;

  async function signInWithProvider(
    provider: string | AuthProvider,
    options?: { scopes?: string[] },
  ): Promise<UserCredential | null> {
    const auth = getAuth(app)
    setState({ loading: true })
    useDeviceLanguage(auth)

    let providerObj: AuthProvider
    if (typeof provider === "string") {
      switch (provider) {
        case SIGNIN_PROVIDERS.GOOGLE:
          providerObj = new GoogleAuthProvider()
          break

        case SIGNIN_PROVIDERS.FACEBOOK:
          providerObj = new FacebookAuthProvider()
          break

        case SIGNIN_PROVIDERS.TWITTER:
          providerObj = new TwitterAuthProvider()
          break

        case SIGNIN_PROVIDERS.GITHUB:
          providerObj = new GithubAuthProvider()
          break

        case SIGNIN_PROVIDERS.MICROSOFT:
          providerObj = new OAuthProvider("microsoft.com")
          break

        case SIGNIN_PROVIDERS.YAHOO:
          providerObj = new OAuthProvider("yahoo.com")
          break

        default:
          throw new Error(`Unrecognized provider: ${provider}`)
      }
    } else {
      providerObj = provider
    }

    const scopes: string[] =
      options && Array.isArray(options.scopes) ? options.scopes : []

    if (provider instanceof OAuthProvider) {
      scopes.forEach(scope =>
        (providerObj as OAuthProvider).addScope(scope),
      )
    }

    try {
      const userCredential = await signInWithPopup(auth, providerObj)
      return userCredential
    } catch (e: any | undefined) {
      // eslint-disable-next-line
      if ( e.email && e.credential && e.code === "auth/account-exists-with-different-credential") {
        const supportedPopupSignInMethods = [
          GoogleAuthProvider.PROVIDER_ID as string,
          FacebookAuthProvider.PROVIDER_ID as string,
          GithubAuthProvider.PROVIDER_ID as string,
        ]

        const getProvider = (providerId: string) => {
          switch (providerId) {
            case GoogleAuthProvider.PROVIDER_ID:
              return new GoogleAuthProvider()
            case FacebookAuthProvider.PROVIDER_ID:
              return new FacebookAuthProvider()
            case GithubAuthProvider.PROVIDER_ID:
              return new GithubAuthProvider()
            default:
              throw new Error(`No provider implemented for ${providerId}`)
          }
        }

        const providers = await fetchSignInMethodsForEmail(auth, e.email)
        const firstPopupProviderMethod = providers.find((p) =>
          supportedPopupSignInMethods.includes(p),
        )

        // Test: Could this happen with email link then trying social provider?
        if (!firstPopupProviderMethod) {
          throw new Error(
            `Your account is linked to a provider that isn't supported.`,
          )
        }

        const linkedProvider = getProvider(firstPopupProviderMethod)
        linkedProvider.setCustomParameters({ login_hint: e.email })

        const result = await signInWithPopup(auth, linkedProvider)
        result.user && linkWithCredential(result.user, e.credential)
      } else {
        setState({
          error: e,
          loading: false,
        })
      }
      return null
    }
  }

  async function signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void | UserCredential> {
    const auth = getAuth(app)
    setState({ loading: true })

    return firebaseSignInWithEmailAndPassword(auth, email, password)
      .catch((e: FirebaseError) => {
        setState({
          error: e,
          loading: false,
        })
      })
  }

  async function signOut(): Promise<void> {
    const auth = getAuth(app)
    setState({ loading: true })
    return firebaseSignOut(auth)
  }

  async function createUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void | UserCredential> {
    const auth = getAuth(app)
    setState({ loading: true })
    return firebaseCreateUserWithEmailAndPassword(auth, email, password)
      .catch((e: FirebaseError) => {
        setState({
          error: e,
          loading: false,
        })
      })
  }

  async function sendPasswordResetEmail(email: string): Promise<void> {
    const auth = getAuth(app)
    return firebaseSendPasswordResetEmail(auth, email)
  }

  async function verifyPasswordResetCode(code: string): Promise<string> {
    const auth = getAuth(app)
    return firebaseVerifyPasswordResetCode(auth, code)
  }

  async function confirmPasswordReset(
    code: string,
    newPassword: string,
  ): Promise<void> {
    const auth = getAuth(app)
    return firebaseConfirmPasswordReset(auth, code, newPassword)
  }

  async function applyActionCode(code: string): Promise<void> {
    const auth = getAuth(app)
    return firebaseApplyActionCode(auth, code)
  }

  async function updateProfile({
    displayName,
    photoURL,
  }: {
    displayName?: string
    photoURL?: string
  }): Promise<void> {
    if (!user) {
      throw new Error("User is not logged in")
    }
    return firebaseUpdateProfile(user, {
      displayName,
      photoURL,
    })
  }

  async function updatePassword(newPassword: string): Promise<void> {
    if (!user) {
      throw new Error("User is not logged in")
    }

    return firebaseUpdatePassword(user, newPassword)
  }

  return {
    user,
    loading,
    error,
    firstCheck,
    signInWithEmailAndPassword,
    signInWithProvider,
    signOut,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    confirmPasswordReset,
    updateProfile,
    updatePassword,
    applyActionCode,
  }
}
